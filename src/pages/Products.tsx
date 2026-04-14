import { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '@/firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { Product } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Search, Edit2, Trash2, Package, Upload, Download, FileSpreadsheet, X, ArrowUpDown } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Timestamp } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<string>('name-asc');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<Omit<Product, 'id'>>({
    type: 'Hàng hóa',
    category: '',
    code: '',
    name: '',
    brand: '',
    sellPrice: 0,
    buyPrice: 0,
    stockLevel: 0,
    minStock: 0,
    maxStock: 999999999,
    unit: '',
    images: '',
    weight: 1,
    isDirectlySold: true,
  });

  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const prods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(prods);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products');
    });
    return () => unsubscribe();
  }, []);

  const handleSave = async () => {
    try {
      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct.id!), formData);
        toast.success('Đã cập nhật hàng hóa');
      } else {
        await addDoc(collection(db, 'products'), formData);
        toast.success('Đã thêm hàng hóa mới');
      }
      setIsAddDialogOpen(false);
      setEditingProduct(null);
      setFormData({
        type: 'Hàng hóa',
        category: '',
        code: '',
        name: '',
        brand: '',
        sellPrice: 0,
        buyPrice: 0,
        stockLevel: 0,
        minStock: 0,
        maxStock: 999999999,
        unit: '',
        images: '',
        weight: 1,
        isDirectlySold: true,
      });
    } catch (error) {
      toast.error('Lỗi khi lưu hàng hóa');
    }
  };

  const handleDelete = async () => {
    if (!productToDelete) return;
    try {
      await deleteDoc(doc(db, 'products', productToDelete));
      toast.success('Đã xóa hàng hóa');
      setIsDeleteDialogOpen(false);
      setProductToDelete(null);
      setSelectedProductIds(prev => prev.filter(id => id !== productToDelete));
    } catch (error) {
      toast.error('Lỗi khi xóa hàng hóa');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedProductIds.length === 0) return;
    try {
      const promises = selectedProductIds.map(id => deleteDoc(doc(db, 'products', id)));
      await Promise.all(promises);
      toast.success(`Đã xóa ${selectedProductIds.length} hàng hóa`);
      setSelectedProductIds([]);
      setIsBulkDeleteDialogOpen(false);
    } catch (error) {
      toast.error('Lỗi khi xóa hàng loạt');
    }
  };

  const exportToExcel = () => {
    if (products.length === 0) {
      toast.error('Không có dữ liệu để xuất');
      return;
    }
    
    const exportData = products.map(p => ({
      'Loại hàng': p.type || 'Hàng hóa',
      'Nhóm hàng': p.category,
      'Mã hàng': p.code,
      'Tên hàng': p.name,
      'Thương hiệu': p.brand || '',
      'Giá bán': p.sellPrice,
      'Giá vốn': p.buyPrice,
      'Tồn kho': p.stockLevel,
      'ĐVT': p.unit,
      'Trọng lượng': p.weight || 1
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "HangHoa");
    XLSX.writeFile(workbook, `DanhSachHangHoa_${new Date().getTime()}.xlsx`);
    toast.success('Đã xuất file Excel');
  };

  const toggleSelectAll = () => {
    if (selectedProductIds.length === filteredProducts.length) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(filteredProducts.map(p => p.id!));
    }
  };

  const toggleSelectProduct = (id: string) => {
    setSelectedProductIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        if (jsonData.length === 0) {
          toast.error('Tệp tin không có dữ liệu');
          return;
        }

        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < jsonData.length; i++) {
          const row: any = jsonData[i];
          
          // Helper to get value from multiple possible keys
          const getVal = (possibleHeaders: string[]) => {
            const key = Object.keys(row).find(k => possibleHeaders.includes(k.trim()));
            return key ? row[key] : '';
          };

          try {
            await addDoc(collection(db, 'products'), {
              type: getVal(['Loại hàng', 'Loai hang', 'Loại']) || 'Hàng hóa',
              category: getVal(['Nhóm hàng', 'Nhom hang', 'Nhóm']) || '',
              code: getVal(['Mã hàng', 'Ma hang', 'Mã']) || `SP${Date.now()}${i}`,
              name: getVal(['Tên hàng', 'Ten hang', 'Tên']) || '',
              brand: getVal(['Thương hiệu', 'Thuong hieu']) || '',
              sellPrice: Number(getVal(['Giá bán', 'Gia ban', 'Giá niêm yết']).toString().replace(/[^0-9.-]+/g, "")) || 0,
              buyPrice: Number(getVal(['Giá vốn', 'Gia von']).toString().replace(/[^0-9.-]+/g, "")) || 0,
              stockLevel: Number(getVal(['Tồn kho', 'Ton kho', 'Tồn']).toString().replace(/[^0-9.-]+/g, "")) || 0,
              unit: getVal(['ĐVT', 'Don vi tinh', 'Đơn vị tính']) || '',
              images: getVal(['Hình ảnh', 'Hinh anh', 'Ảnh']) || '',
              weight: Number(getVal(['Trọng lượng', 'Trong luong']).toString().replace(/[^0-9.-]+/g, "")) || 1,
              isDirectlySold: true,
              createdAt: Timestamp.now()
            });
            successCount++;
          } catch (err) {
            console.error('Import row error:', err);
            errorCount++;
          }
        }
        toast.success(`Đã nhập thành công ${successCount} mặt hàng. Thất bại: ${errorCount}`);
      } catch (err) {
        console.error('Import file error:', err);
        toast.error('Lỗi định dạng tệp tin');
      }
      // Reset input
      e.target.value = '';
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, isFolder: boolean) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      toast.error('Không tìm thấy tệp hình ảnh nào');
      return;
    }

    toast.info(`Đang xử lý ${imageFiles.length} hình ảnh...`);

    const readers = imageFiles.map(file => {
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          resolve(event.target?.result as string);
        };
        reader.readAsDataURL(file);
      });
    });

    Promise.all(readers).then(base64Images => {
      const currentImages = formData.images ? formData.images.split(',') : [];
      const updatedImages = [...currentImages, ...base64Images].join(',');
      
      // Check Firestore limit (approx 1MB)
      if (updatedImages.length > 800000) {
        toast.error('Tổng dung lượng ảnh quá lớn (>800KB). Vui lòng chọn ít ảnh hơn hoặc ảnh nhẹ hơn.');
        return;
      }
      
      setFormData({ ...formData, images: updatedImages });
      toast.success(`Đã thêm ${base64Images.length} hình ảnh`);
    });

    // Reset input
    e.target.value = '';
  };

  const filteredProducts = products
    .filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.code.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortBy) {
        case 'price-asc':
          return a.sellPrice - b.sellPrice;
        case 'price-desc':
          return b.sellPrice - a.sellPrice;
        case 'stock-asc':
          return a.stockLevel - b.stockLevel;
        case 'stock-desc':
          return b.stockLevel - a.stockLevel;
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        default:
          return 0;
      }
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Package className="h-6 w-6 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Quản lý Hàng hóa</h1>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            className="border-green-200 text-green-700 hover:bg-green-50"
            onClick={exportToExcel}
          >
            <Download className="mr-2 h-4 w-4" /> Xuất Excel
          </Button>

          <div className="relative">
            <input
              type="file"
              accept=".csv, .xlsx, .xls"
              onChange={handleFileImport}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              id="csv-upload"
            />
            <Button variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-50">
              <Upload className="mr-2 h-4 w-4" /> Nhập Excel/CSV
            </Button>
          </div>
          
          <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
            setIsAddDialogOpen(open);
            if (!open) {
              setEditingProduct(null);
              setFormData({
                type: 'Hàng hóa',
                category: '',
                code: '',
                name: '',
                brand: '',
                sellPrice: 0,
                buyPrice: 0,
                stockLevel: 0,
                minStock: 0,
                maxStock: 999999999,
                unit: '',
                images: '',
                weight: 1,
                isDirectlySold: true,
              });
            }
          }}>
          <DialogTrigger render={
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="mr-2 h-4 w-4" /> Thêm hàng hóa
            </Button>
          } />
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{editingProduct ? 'Sửa hàng hóa' : 'Thêm hàng hóa mới'}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto px-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="type">Loại hàng</Label>
                  <Input 
                    id="type" 
                    value={formData.type} 
                    onChange={e => setFormData({...formData, type: e.target.value})} 
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="category">Nhóm hàng</Label>
                  <Input 
                    id="category" 
                    value={formData.category} 
                    onChange={e => setFormData({...formData, category: e.target.value})} 
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="code">Mã hàng</Label>
                  <Input 
                    id="code" 
                    value={formData.code} 
                    onChange={e => setFormData({...formData, code: e.target.value})} 
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="name">Tên hàng</Label>
                  <Input 
                    id="name" 
                    value={formData.name} 
                    onChange={e => setFormData({...formData, name: e.target.value})} 
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="brand">Thương hiệu</Label>
                  <Input 
                    id="brand" 
                    value={formData.brand} 
                    onChange={e => setFormData({...formData, brand: e.target.value})} 
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="unit">ĐVT</Label>
                  <Input 
                    id="unit" 
                    value={formData.unit} 
                    onChange={e => setFormData({...formData, unit: e.target.value})} 
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="sellPrice">Giá bán</Label>
                  <Input 
                    id="sellPrice" 
                    type="number"
                    value={formData.sellPrice} 
                    onChange={e => setFormData({...formData, sellPrice: Number(e.target.value)})} 
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="buyPrice">Giá vốn</Label>
                  <Input 
                    id="buyPrice" 
                    type="number"
                    value={formData.buyPrice} 
                    onChange={e => setFormData({...formData, buyPrice: Number(e.target.value)})} 
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="stock">Tồn kho</Label>
                  <Input 
                    id="stock" 
                    type="number"
                    value={formData.stockLevel} 
                    onChange={e => setFormData({...formData, stockLevel: Number(e.target.value)})} 
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="minStock">Tồn nhỏ nhất</Label>
                  <Input 
                    id="minStock" 
                    type="number"
                    value={formData.minStock} 
                    onChange={e => setFormData({...formData, minStock: Number(e.target.value)})} 
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="maxStock">Tồn lớn nhất</Label>
                  <Input 
                    id="maxStock" 
                    type="number"
                    value={formData.maxStock} 
                    onChange={e => setFormData({...formData, maxStock: Number(e.target.value)})} 
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Hình ảnh</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {formData.images && formData.images.split(',').map((img, idx) => (
                    <div key={idx} className="relative h-16 w-16 rounded border overflow-hidden group">
                      <img src={img} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                      <button 
                        onClick={() => {
                          const imgs = formData.images.split(',');
                          imgs.splice(idx, 1);
                          setFormData({...formData, images: imgs.join(',')});
                        }}
                        className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-4 w-4 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, false)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <Button variant="outline" className="w-full text-xs">
                      <Upload className="mr-2 h-3 w-3" /> Chọn file
                    </Button>
                  </div>
                  <div className="relative flex-1">
                    <input
                      type="file"
                      multiple
                      {...{ webkitdirectory: "", directory: "" } as any}
                      onChange={(e) => handleImageUpload(e, true)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <Button variant="outline" className="w-full text-xs">
                      <Upload className="mr-2 h-3 w-3" /> Chọn thư mục
                    </Button>
                  </div>
                </div>
                <Input 
                  id="images" 
                  value={formData.images} 
                  onChange={e => setFormData({...formData, images: e.target.value})} 
                  placeholder="Hoặc nhập URL hình ảnh (phân cách bằng dấu phẩy)"
                  className="text-xs mt-1"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Hủy</Button>
              <Button onClick={handleSave}>Lưu</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>

    <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="Tìm kiếm theo tên hoặc nhóm hàng..." 
                  className="pl-10"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
              
              <div className="flex items-center gap-2 min-w-[200px]">
                <ArrowUpDown className="h-4 w-4 text-slate-400" />
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sắp xếp theo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name-asc">Tên (A-Z)</SelectItem>
                    <SelectItem value="name-desc">Tên (Z-A)</SelectItem>
                    <SelectItem value="price-asc">Giá bán tăng dần</SelectItem>
                    <SelectItem value="price-desc">Giá bán giảm dần</SelectItem>
                    <SelectItem value="stock-asc">Tồn kho tăng dần</SelectItem>
                    <SelectItem value="stock-desc">Tồn kho giảm dần</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedProductIds.length > 0 && (
              <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2">
                <span className="text-sm font-medium text-slate-600">
                  Đã chọn {selectedProductIds.length}
                </span>
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={() => setIsBulkDeleteDialogOpen(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Xóa tất cả đã chọn
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <input 
                      type="checkbox" 
                      className="h-4 w-4 rounded border-slate-300"
                      checked={filteredProducts.length > 0 && selectedProductIds.length === filteredProducts.length}
                      onChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="w-[80px]">Ảnh</TableHead>
                  <TableHead>Loại hàng</TableHead>
                  <TableHead>Nhóm hàng</TableHead>
                  <TableHead>Mã hàng</TableHead>
                  <TableHead>Tên hàng</TableHead>
                  <TableHead>Thương hiệu</TableHead>
                  <TableHead className="text-right">Giá bán</TableHead>
                  <TableHead className="text-right">Giá vốn</TableHead>
                  <TableHead className="text-right">Tồn kho</TableHead>
                  <TableHead>ĐVT</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-8 text-slate-500">
                      Chưa có hàng hóa nào
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((product) => (
                    <TableRow key={product.id} className={cn(selectedProductIds.includes(product.id!) && "bg-blue-50/50")}>
                      <TableCell>
                        <input 
                          type="checkbox" 
                          className="h-4 w-4 rounded border-slate-300"
                          checked={selectedProductIds.includes(product.id!)}
                          onChange={() => toggleSelectProduct(product.id!)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="h-10 w-10 rounded border bg-slate-50 overflow-hidden flex items-center justify-center">
                          {product.images ? (
                            <img src={product.images} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <Package className="h-5 w-5 text-slate-300" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">{product.type}</TableCell>
                      <TableCell className="text-xs">{product.category}</TableCell>
                      <TableCell className="font-mono text-xs font-bold text-blue-600">{product.code}</TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate">{product.name}</TableCell>
                      <TableCell className="text-xs">{product.brand}</TableCell>
                      <TableCell className="text-right font-bold text-blue-600">{product.sellPrice.toLocaleString()}đ</TableCell>
                      <TableCell className="text-right text-slate-500">{product.buyPrice.toLocaleString()}đ</TableCell>
                      <TableCell className="text-right">
                        <span className={cn(
                          "px-2 py-1 rounded-full text-xs font-medium",
                          product.stockLevel <= (product.minStock || 5) ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                        )}>
                          {product.stockLevel}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs">{product.unit}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => {
                              setEditingProduct(product);
                              setFormData({
                                type: product.type || 'Hàng hóa',
                                category: product.category,
                                code: product.code,
                                name: product.name,
                                brand: product.brand || '',
                                sellPrice: product.sellPrice,
                                buyPrice: product.buyPrice,
                                stockLevel: product.stockLevel,
                                minStock: product.minStock || 0,
                                maxStock: product.maxStock || 999999999,
                                unit: product.unit,
                                images: product.images || '',
                                weight: product.weight || 1,
                                isDirectlySold: product.isDirectlySold ?? true,
                              });
                              setIsAddDialogOpen(true);
                            }}
                          >
                            <Edit2 className="h-4 w-4 text-blue-600" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => {
                              setProductToDelete(product.id!);
                              setIsDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Xác nhận xóa</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            Bạn có chắc chắn muốn xóa hàng hóa này? Hành động này không thể hoàn tác.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Hủy</Button>
            <Button variant="destructive" onClick={handleDelete}>Xác nhận xóa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Xác nhận xóa hàng loạt</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            Bạn có chắc chắn muốn xóa <strong>{selectedProductIds.length}</strong> hàng hóa đã chọn? Hành động này không thể hoàn tác.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkDeleteDialogOpen(false)}>Hủy</Button>
            <Button variant="destructive" onClick={handleBulkDelete}>Xác nhận xóa tất cả</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

