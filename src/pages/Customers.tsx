import { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '@/firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { Customer } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Search, Edit2, Trash2, Users, Download } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<string | null>(null);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState<Omit<Customer, 'id'>>({
    name: '',
    phone: '',
    address: '',
    currentDebt: 0,
  });

  useEffect(() => {
    const q = query(collection(db, 'customers'), orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const custs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
      setCustomers(custs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'customers');
    });
    return () => unsubscribe();
  }, []);

  const handleSave = async () => {
    try {
      if (editingCustomer) {
        await updateDoc(doc(db, 'customers', editingCustomer.id!), formData);
        toast.success('Đã cập nhật thông tin khách hàng');
      } else {
        await addDoc(collection(db, 'customers'), formData);
        toast.success('Đã thêm khách hàng mới');
      }
      setIsAddDialogOpen(false);
      setEditingCustomer(null);
      setFormData({ name: '', phone: '', address: '', currentDebt: 0 });
    } catch (error) {
      toast.error('Lỗi khi lưu khách hàng');
    }
  };

  const handleDelete = async () => {
    if (!customerToDelete) return;
    try {
      await deleteDoc(doc(db, 'customers', customerToDelete));
      toast.success('Đã xóa khách hàng');
      setIsDeleteDialogOpen(false);
      setCustomerToDelete(null);
      setSelectedCustomerIds(prev => prev.filter(id => id !== customerToDelete));
    } catch (error) {
      toast.error('Lỗi khi xóa khách hàng');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedCustomerIds.length === 0) return;
    try {
      const promises = selectedCustomerIds.map(id => deleteDoc(doc(db, 'customers', id)));
      await Promise.all(promises);
      toast.success(`Đã xóa ${selectedCustomerIds.length} khách hàng`);
      setSelectedCustomerIds([]);
      setIsBulkDeleteDialogOpen(false);
    } catch (error) {
      toast.error('Lỗi khi xóa hàng loạt');
    }
  };

  const exportToExcel = () => {
    if (customers.length === 0) {
      toast.error('Không có dữ liệu để xuất');
      return;
    }
    
    const exportData = customers.map(c => ({
      'Tên khách hàng': c.name,
      'Số điện thoại': c.phone,
      'Địa chỉ': c.address,
      'Nợ hiện tại': c.currentDebt
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "KhachHang");
    XLSX.writeFile(workbook, `DanhSachKhachHang_${new Date().getTime()}.xlsx`);
    toast.success('Đã xuất file Excel');
  };

  const toggleSelectAll = () => {
    if (selectedCustomerIds.length === filteredCustomers.length) {
      setSelectedCustomerIds([]);
    } else {
      setSelectedCustomerIds(filteredCustomers.map(c => c.id!));
    }
  };

  const toggleSelectCustomer = (id: string) => {
    setSelectedCustomerIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm) ||
    c.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <Users className="h-6 w-6 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Quản lý Khách hàng</h1>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            className="border-green-200 text-green-700 hover:bg-green-50"
            onClick={exportToExcel}
          >
            <Download className="mr-2 h-4 w-4" /> Xuất Excel
          </Button>

          <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
            setIsAddDialogOpen(open);
            if (!open) {
              setEditingCustomer(null);
              setFormData({ name: '', phone: '', address: '', currentDebt: 0 });
            }
          }}>
            <DialogTrigger render={
              <Button className="bg-green-600 hover:bg-green-700">
                <Plus className="mr-2 h-4 w-4" /> Thêm khách hàng
              </Button>
            } />
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>{editingCustomer ? 'Sửa khách hàng' : 'Thêm khách hàng mới'}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Tên khách hàng</Label>
                  <Input 
                    id="name" 
                    value={formData.name} 
                    onChange={e => setFormData({...formData, name: e.target.value})} 
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">Số điện thoại</Label>
                  <Input 
                    id="phone" 
                    value={formData.phone} 
                    onChange={e => setFormData({...formData, phone: e.target.value})} 
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="address">Địa chỉ</Label>
                  <Input 
                    id="address" 
                    value={formData.address} 
                    onChange={e => setFormData({...formData, address: e.target.value})} 
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="debt">Nợ hiện tại</Label>
                  <Input 
                    id="debt" 
                    type="number" 
                    value={formData.currentDebt} 
                    onChange={e => setFormData({...formData, currentDebt: Number(e.target.value)})} 
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Hủy</Button>
                <Button onClick={handleSave} className="bg-green-600 hover:bg-green-700">Lưu</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Tìm kiếm theo tên hoặc số điện thoại..." 
                className="pl-10"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            {selectedCustomerIds.length > 0 && (
              <div className="flex items-center gap-2 ml-4 animate-in fade-in slide-in-from-right-2">
                <span className="text-sm font-medium text-slate-600">
                  Đã chọn {selectedCustomerIds.length}
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
                      checked={filteredCustomers.length > 0 && selectedCustomerIds.length === filteredCustomers.length}
                      onChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Tên khách hàng</TableHead>
                  <TableHead>Số điện thoại</TableHead>
                  <TableHead>Địa chỉ</TableHead>
                  <TableHead className="text-right">Nợ hiện tại</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                      Chưa có khách hàng nào
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCustomers.map((customer) => (
                    <TableRow key={customer.id} className={cn(selectedCustomerIds.includes(customer.id!) && "bg-blue-50/50")}>
                      <TableCell>
                        <input 
                          type="checkbox" 
                          className="h-4 w-4 rounded border-slate-300"
                          checked={selectedCustomerIds.includes(customer.id!)}
                          onChange={() => toggleSelectCustomer(customer.id!)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{customer.name}</TableCell>
                      <TableCell>{customer.phone}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{customer.address}</TableCell>
                      <TableCell className="text-right font-semibold">
                        <span className={cn(
                          customer.currentDebt > 0 ? "text-red-600" : "text-slate-600"
                        )}>
                          {customer.currentDebt.toLocaleString()}đ
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => {
                              setEditingCustomer(customer);
                              setFormData({
                                name: customer.name,
                                phone: customer.phone,
                                address: customer.address,
                                currentDebt: customer.currentDebt,
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
                              setCustomerToDelete(customer.id!);
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
            Bạn có chắc chắn muốn xóa khách hàng này? Hành động này không thể hoàn tác.
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
            Bạn có chắc chắn muốn xóa <strong>{selectedCustomerIds.length}</strong> khách hàng đã chọn? Hành động này không thể hoàn tác.
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

