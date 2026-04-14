import { useState, useEffect } from 'react';
import { supabase, type Customer } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Search, Edit2, Trash2, Users, Download } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { useAuth } from '@/App';

const emptyForm = { name: '', phone: '', address: '', current_debt: 0 };

export default function Customers() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    fetchCustomers();
    const channel = supabase.channel('customers-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, fetchCustomers)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchCustomers = async () => {
    const { data, error } = await supabase.from('customers').select('*').order('name');
    if (error) toast.error(error.message);
    else setCustomers(data as Customer[]);
    setLoading(false);
  };

  const openAdd = () => { setEditing(null); setForm(emptyForm); setIsFormOpen(true); };
  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({ name: c.name, phone: c.phone || '', address: c.address || '', current_debt: c.current_debt });
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Vui lòng nhập tên khách hàng');
    try {
      if (editing) {
        const { error } = await supabase.from('customers').update(form).eq('id', editing.id);
        if (error) throw error;
        toast.success('Đã cập nhật khách hàng');
      } else {
        const { error } = await supabase.from('customers').insert(form);
        if (error) throw error;
        toast.success('Đã thêm khách hàng mới');
      }
      setIsFormOpen(false);
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('customers').delete().eq('id', deleteId);
    if (error) toast.error(error.message);
    else { toast.success('Đã xóa khách hàng'); setSelectedIds(p => p.filter(i => i !== deleteId)); }
    setIsDeleteOpen(false); setDeleteId(null);
  };

  const handleBulkDelete = async () => {
    const { error } = await supabase.from('customers').delete().in('id', selectedIds);
    if (error) toast.error(error.message);
    else { toast.success(`Đã xóa ${selectedIds.length} khách hàng`); setSelectedIds([]); }
    setIsBulkDeleteOpen(false);
  };

  const exportExcel = () => {
    const data = customers.map(c => ({
      'Tên': c.name, 'Điện thoại': c.phone || '', 'Địa chỉ': c.address || '',
      'Nợ hiện tại': c.current_debt, 'Tổng chi tiêu': c.total_spent || 0, 'Số đơn': c.total_orders || 0,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'KhachHang');
    XLSX.writeFile(wb, `KhachHang_${Date.now()}.xlsx`);
    toast.success('Đã xuất Excel');
  };

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.phone || '').includes(searchTerm) ||
    (c.address || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleAll = () => setSelectedIds(selectedIds.length === filtered.length ? [] : filtered.map(c => c.id));
  const toggleOne = (id: string) => setSelectedIds(p => p.includes(id) ? p.filter(i => i !== id) : [...p, id]);

  const totalDebt = customers.reduce((s, c) => s + c.current_debt, 0);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 rounded-lg"><Users className="h-5 w-5 text-emerald-600" /></div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Quản lý Khách hàng</h1>
            <p className="text-sm text-slate-500">{customers.length} khách hàng</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && isAdmin && (
            <Button variant="destructive" size="sm" onClick={() => setIsBulkDeleteOpen(true)}>
              <Trash2 className="h-4 w-4 mr-1.5" /> Xóa ({selectedIds.length})
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={exportExcel}>
            <Download className="h-4 w-4 mr-1.5" /> Excel
          </Button>
          <Button size="sm" onClick={openAdd} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="h-4 w-4 mr-1.5" /> Thêm khách
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Tổng khách hàng', value: customers.length, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Khách có nợ', value: customers.filter(c => c.current_debt > 0).length, color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: 'Tổng công nợ', value: `${totalDebt.toLocaleString()}đ`, color: 'text-red-600', bg: 'bg-red-50' },
        ].map((s, i) => (
          <div key={i} className={cn('rounded-xl p-4', s.bg)}>
            <p className="text-sm text-slate-500">{s.label}</p>
            <p className={cn('text-2xl font-black mt-1', s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Tìm theo tên, điện thoại, địa chỉ..." className="pl-9"
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
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
                  <TableHead>Tên khách hàng</TableHead>
                  <TableHead>Điện thoại</TableHead>
                  <TableHead>Địa chỉ</TableHead>
                  <TableHead className="text-right">Nợ hiện tại</TableHead>
                  <TableHead className="text-right">Tổng chi tiêu</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      {[...Array(6)].map((_, j) => (
                        <TableCell key={j}><div className="h-4 bg-slate-100 rounded animate-pulse" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-slate-400">
                      <Users className="h-10 w-10 mx-auto mb-3 opacity-20" />
                      Chưa có khách hàng nào
                    </TableCell>
                  </TableRow>
                ) : filtered.map(c => (
                  <TableRow key={c.id} className={cn(selectedIds.includes(c.id) && 'bg-blue-50/50')}>
                    {isAdmin && <TableCell className="pl-4">
                      <input type="checkbox" className="h-4 w-4 rounded"
                        checked={selectedIds.includes(c.id)} onChange={() => toggleOne(c.id)} />
                    </TableCell>}
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm flex-shrink-0">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-semibold">{c.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-600">{c.phone || '—'}</TableCell>
                    <TableCell className="text-slate-500 text-sm max-w-[180px] truncate">{c.address || '—'}</TableCell>
                    <TableCell className="text-right">
                      <span className={cn('font-bold', c.current_debt > 0 ? 'text-red-600' : 'text-slate-400')}>
                        {c.current_debt > 0 ? `${c.current_debt.toLocaleString()}đ` : '—'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-slate-500 text-sm">
                      {(c.total_spent || 0) > 0 ? `${(c.total_spent || 0).toLocaleString()}đ` : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}>
                          <Edit2 className="h-3.5 w-3.5 text-blue-600" />
                        </Button>
                        {isAdmin && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setDeleteId(c.id); setIsDeleteOpen(true); }}>
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader><DialogTitle>{editing ? 'Sửa khách hàng' : 'Thêm khách hàng'}</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5"><Label>Tên *</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid gap-1.5"><Label>Số điện thoại</Label>
              <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="grid gap-1.5"><Label>Địa chỉ</Label>
              <Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
            <div className="grid gap-1.5"><Label>Nợ hiện tại</Label>
              <Input type="number" value={form.current_debt} onChange={e => setForm({ ...form, current_debt: +e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>Hủy</Button>
            <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700">Lưu</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader><DialogTitle>Xác nhận xóa</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600 py-2">Xóa khách hàng này?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Hủy</Button>
            <Button variant="destructive" onClick={handleDelete}>Xóa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isBulkDeleteOpen} onOpenChange={setIsBulkDeleteOpen}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader><DialogTitle>Xóa hàng loạt</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600 py-2">Xóa <strong>{selectedIds.length}</strong> khách hàng?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkDeleteOpen(false)}>Hủy</Button>
            <Button variant="destructive" onClick={handleBulkDelete}>Xóa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
