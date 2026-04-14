import { useState, useEffect, useRef } from 'react';
import { supabase, type Product } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Search, Edit2, Trash2, Package, Upload, Download, X, ArrowUpDown } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/App';

const emptyForm: Omit<Product, 'id' | 'created_at' | 'updated_at'> = {
  type: 'Hàng hóa', category: '', code: '', name: '', brand: '',
  sell_price: 0, buy_price: 0, stock_level: 0, min_stock: 0,
  max_stock: 999999999, unit: 'cái', images: '', weight: 1, is_directly_sold: true,
};

export default function Products() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name-asc');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProducts();
    const channel = supabase.channel('products-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, fetchProducts)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchProducts = async () => {
    const { data, error } = await supabase.from('products').select('*').order('name');
    if (error) toast.error('Lỗi tải dữ liệu: ' + error.message);
    else setProducts(data as Product[]);
    setLoading(false);
  };

  const openAdd = () => { setEditing(null); setForm(emptyForm); setIsFormOpen(true); };
  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({ type: p.type, category: p.category, code: p.code, name: p.name, brand: p.brand || '', sell_price: p.sell_price, buy_price: p.buy_price, stock_level: p.stock_level, min_stock: p.min_stock || 0, max_stock: p.max_stock || 999999999, unit: p.unit, images: p.images || '', weight: p.weight || 1, is_directly_sold: p.is_directly_sold ?? true });
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Vui lòng nhập tên hàng hóa');
    try {
      if (editing) {
        const { error } = await supabase.from('products').update(form).eq('id', editing.id);
        if (error) throw error;
        toast.success('Đã cập nhật hàng hóa');
      } else {
        const { error } = await supabase.from('products').insert(form);
        if (error) throw error;
        toast.success('Đã thêm hàng hóa mới');
      }
      setIsFormOpen(false);
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('products').delete().eq('id', deleteId);
    if (error) toast.error(e.message);
    else { toast.success('Đã xóa hàng hóa'); setSelectedIds(p => p.filter(i => i !== deleteId)); }
    setIsDeleteOpen(false);
    setDeleteId(null);
  };

  const handleBulkDelete = async () => {
    const { error } = await supabase.from('products').delete().in('id', selectedIds);
    if (error) toast.error(error.message);
    else { toast.success(`Đã xóa ${selectedIds.length} hàng hóa`); setSelectedIds([]); }
    setIsBulkDeleteOpen(false);
  };

  const exportExcel = () => {
    const data = products.map(p => ({
      'Loại hàng': p.type, 'Nhóm hàng': p.category, 'Mã hàng': p.code, 'Tên hàng': p.name,
      'Thương hiệu': p.brand || '', 'Giá bán': p.sell_price, 'Giá vốn': p.buy_price,
      'Tồn kho': p.stock_level, 'ĐVT': p.unit,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'HangHoa');
    XLSX.writeFile(wb, `HangHoa_${Date.now()}.xlsx`);
    toast.success('Đã xuất Excel');
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(ws);
    if (!rows.length) return toast.error('File không có dữ liệu');
    const get = (row: any, keys: string[]) => {
      const k = Object.keys(row).find(k => keys.includes(k.trim()));
      return k ? String(row[k]) : '';
    };
    const inserts = rows.map((r, i) => ({
      type: get(r, ['Loại hàng']) || 'Hàng hóa', category: get(r, ['Nhóm hàng']) || '',
      code: get(r, ['Mã hàng']) || `SP${Date.now()}${i}`, name: get(r, ['Tên hàng']) || `Sản phẩm ${i+1}`,
      brand: get(r, ['Thương hiệu']) || '', unit: get(r, ['ĐVT']) || 'cái',
      sell_price: Number(get(r, ['Giá bán', 'Giá niêm yết']).replace(/\D/g, '')) || 0,
      buy_price: Number(get(r, ['Giá vốn']).replace(/\D/g, '')) || 0,
      stock_level: Number(get(r, ['Tồn kho', 'Tồn']).replace(/\D/g, '')) || 0,
      weight: 1, is_directly_sold: true,
    }));
    const { error } = await supabase.from('products').insert(inserts);
    if (error) toast.error(error.message);
    else toast.success(`Đã nhập ${inserts.length} mặt hàng`);
    e.target.value = '';
  };

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.code.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => {
    switch (sortBy) {
      case 'price-asc': return a.sell_price - b.sell_price;
      case 'price-desc': return b.sell_price - a.sell_price;
      case 'stock-asc': return a.stock_level - b.stock_level;
      case 'stock-desc': return b.stock_level - a.stock_level;
      case 'name-desc': return b.name.localeCompare(a.name);
      default: return a.name.localeCompare(b.name);
    }
  });

  const toggleAll = () => setSelectedIds(selectedIds.length === filtered.length ? [] : filtered.map(p => p.id));
  const toggleOne = (id: string) => setSelectedIds(p => p.includes(id) ? p.filter(i => i !== id) : [...p, id]);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg"><Package className="h-5 w-5 text-blue-600" /></div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Quản lý Hàng hóa</h1>
            <p className="text-sm text-slate-500">{products.length} mặt hàng</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {selectedIds.length > 0 && isAdmin && (
            <Button variant="destructive" size="sm" onClick={() => setIsBulkDeleteOpen(true)}>
              <Trash2 className="h-4 w-4 mr-1.5" /> Xóa ({selectedIds.length})
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={exportExcel}>
            <Download className="h-4 w-4 mr-1.5" /> Excel
          </Button>
          {isAdmin && (
            <>
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4 mr-1.5" /> Nhập
              </Button>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
              <Button size="sm" onClick={openAdd} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-1.5" /> Thêm mới
              </Button>
            </>
          )}
        </div>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input placeholder="Tìm theo tên, mã, nhóm hàng..." className="pl-9"
                value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[180px]">
                <ArrowUpDown className="h-3.5 w-3.5 mr-2 text-slate-400" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name-asc">Tên A→Z</SelectItem>
                <SelectItem value="name-desc">Tên Z→A</SelectItem>
                <SelectItem value="price-asc">Giá tăng dần</SelectItem>
                <SelectItem value="price-desc">Giá giảm dần</SelectItem>
                <SelectItem value="stock-asc">Tồn kho tăng</SelectItem>
                <SelectItem value="stock-desc">Tồn kho giảm</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  {isAdmin && <TableHead className="w-10 pl-4">
                    <input type="checkbox" className="h-4 w-4 rounded"
                      checked={filtered.length > 0 && selectedIds.length === filtered.length}
                      onChange={toggleAll} />
                  </TableHead>}
                  <TableHead className="w-12">Ảnh</TableHead>
                  <TableHead>Mã hàng</TableHead>
                  <TableHead>Tên hàng</TableHead>
                  <TableHead>Nhóm</TableHead>
                  <TableHead className="text-right">Giá bán</TableHead>
                  <TableHead className="text-right">Giá vốn</TableHead>
                  <TableHead className="text-right">Tồn kho</TableHead>
                  <TableHead>ĐVT</TableHead>
                  {isAdmin && <TableHead className="w-20" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      {[...Array(isAdmin ? 9 : 7)].map((_, j) => (
                        <TableCell key={j}><div className="h-4 bg-slate-100 rounded animate-pulse" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 9 : 7} className="text-center py-12 text-slate-400">
                      <Package className="h-10 w-10 mx-auto mb-3 opacity-20" />
                      Chưa có hàng hóa nào
                    </TableCell>
                  </TableRow>
                ) : filtered.map(p => (
                  <TableRow key={p.id} className={cn(selectedIds.includes(p.id) && 'bg-blue-50/50')}>
                    {isAdmin && <TableCell className="pl-4">
                      <input type="checkbox" className="h-4 w-4 rounded"
                        checked={selectedIds.includes(p.id)} onChange={() => toggleOne(p.id)} />
                    </TableCell>}
                    <TableCell>
                      <div className="h-9 w-9 rounded-lg border bg-slate-50 overflow-hidden flex items-center justify-center">
                        {p.images ? (
                          <img src={p.images.split(',')[0]} alt="" className="h-full w-full object-cover" />
                        ) : <Package className="h-4 w-4 text-slate-300" />}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs font-bold text-blue-600">{p.code}</TableCell>
                    <TableCell className="font-medium max-w-[200px]">
                      <div className="truncate">{p.name}</div>
                      {p.brand && <div className="text-xs text-slate-400">{p.brand}</div>}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">{p.category}</TableCell>
                    <TableCell className="text-right font-bold text-blue-600">{p.sell_price.toLocaleString()}đ</TableCell>
                    <TableCell className="text-right text-slate-400 text-sm">{p.buy_price.toLocaleString()}đ</TableCell>
                    <TableCell className="text-right">
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-semibold',
                        p.stock_level <= 0 ? 'bg-red-100 text-red-700' :
                        p.stock_level <= (p.min_stock || 5) ? 'bg-orange-100 text-orange-700' :
                        'bg-emerald-100 text-emerald-700'
                      )}>
                        {p.stock_level}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">{p.unit}</TableCell>
                    {isAdmin && <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}>
                          <Edit2 className="h-3.5 w-3.5 text-blue-600" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setDeleteId(p.id); setIsDeleteOpen(true); }}>
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Sửa hàng hóa' : 'Thêm hàng hóa mới'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Nhóm hàng</Label>
                <Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="VD: Đồ uống" />
              </div>
              <div className="grid gap-1.5">
                <Label>Mã hàng</Label>
                <Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="VD: SP001" />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Tên hàng *</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Tên hàng hóa" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Thương hiệu</Label>
                <Input value={form.brand || ''} onChange={e => setForm({ ...form, brand: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label>Đơn vị tính</Label>
                <Input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="cái, hộp, kg..." />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Giá bán</Label>
                <Input type="number" value={form.sell_price} onChange={e => setForm({ ...form, sell_price: +e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label>Giá vốn</Label>
                <Input type="number" value={form.buy_price} onChange={e => setForm({ ...form, buy_price: +e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1.5">
                <Label>Tồn kho</Label>
                <Input type="number" value={form.stock_level} onChange={e => setForm({ ...form, stock_level: +e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label>Tồn min</Label>
                <Input type="number" value={form.min_stock || 0} onChange={e => setForm({ ...form, min_stock: +e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label>Tồn max</Label>
                <Input type="number" value={form.max_stock || 999999} onChange={e => setForm({ ...form, max_stock: +e.target.value })} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>URL Hình ảnh</Label>
              <Input value={form.images || ''} onChange={e => setForm({ ...form, images: e.target.value })} placeholder="https://..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>Hủy</Button>
            <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">Lưu</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader><DialogTitle>Xác nhận xóa</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600 py-2">Bạn có chắc muốn xóa hàng hóa này?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Hủy</Button>
            <Button variant="destructive" onClick={handleDelete}>Xóa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete */}
      <Dialog open={isBulkDeleteOpen} onOpenChange={setIsBulkDeleteOpen}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader><DialogTitle>Xóa hàng loạt</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600 py-2">Xóa <strong>{selectedIds.length}</strong> mặt hàng đã chọn?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkDeleteOpen(false)}>Hủy</Button>
            <Button variant="destructive" onClick={handleBulkDelete}>Xóa tất cả</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
