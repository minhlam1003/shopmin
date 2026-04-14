import { useState, useEffect } from 'react';
import { supabase, type Order, type OrderDetail } from '@/lib/supabase';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { History, Eye, Search, Download, Trash2, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/App';

export default function Orders() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderDetails, setOrderDetails] = useState<OrderDetail[]>([]);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchOrders();
    const channel = supabase.channel('orders-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchOrders = async () => {
    const { data, error } = await supabase.from('orders')
      .select('*').order('created_at', { ascending: false });
    if (error) toast.error(error.message);
    else setOrders(data as Order[]);
    setLoading(false);
  };

  const viewDetails = async (order: Order) => {
    setSelectedOrder(order);
    const { data, error } = await supabase.from('order_details').select('*').eq('order_id', order.id);
    if (error) toast.error(error.message);
    else setOrderDetails(data as OrderDetail[]);
    setIsDetailsOpen(true);
  };

  const exportExcel = () => {
    const data = filtered.map(o => ({
      'Mã đơn': o.order_code,
      'Thời gian': new Date(o.created_at).toLocaleString('vi-VN'),
      'Khách hàng': o.customer_name,
      'Tổng tiền': o.total_amount,
      'Giảm giá': o.discount,
      'Trạng thái': o.status === 'paid' ? 'Đã thanh toán' : 'Ghi nợ',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'GiaoDich');
    XLSX.writeFile(wb, `GiaoDich_${Date.now()}.xlsx`);
    toast.success('Đã xuất Excel');
  };

  const handleBulkDelete = async () => {
    setDeleting(true);
    try {
      // Delete details first
      await supabase.from('order_details').delete().in('order_id', selectedIds);
      // Delete orders
      const { error } = await supabase.from('orders').delete().in('id', selectedIds);
      if (error) throw error;
      toast.success(`Đã xóa ${selectedIds.length} giao dịch`);
      setSelectedIds([]);
      setIsBulkDeleteOpen(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDeleting(false);
    }
  };

  const filtered = orders.filter(o => {
    const matchSearch = o.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.order_code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const toggleAll = () => setSelectedIds(selectedIds.length === filtered.length ? [] : filtered.map(o => o.id!));
  const toggleOne = (id: string) => setSelectedIds(p => p.includes(id) ? p.filter(i => i !== id) : [...p, id]);

  // Stats
  const totalRevenue = orders.filter(o => o.status === 'paid').reduce((s, o) => s + o.total_amount, 0);
  const totalDebt = orders.filter(o => o.status === 'debt').reduce((s, o) => s + o.total_amount, 0);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg"><History className="h-5 w-5 text-purple-600" /></div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Lịch sử Giao dịch</h1>
            <p className="text-sm text-slate-500">{orders.length} đơn hàng</p>
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
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Tổng đơn', value: orders.length, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Đã thanh toán', value: `${totalRevenue.toLocaleString()}đ`, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Tổng nợ', value: `${totalDebt.toLocaleString()}đ`, color: 'text-red-600', bg: 'bg-red-50' },
        ].map((s, i) => (
          <div key={i} className={cn('rounded-xl p-4', s.bg)}>
            <p className="text-sm text-slate-500">{s.label}</p>
            <p className={cn('text-2xl font-black mt-1', s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input placeholder="Tìm theo mã đơn hoặc khách hàng..." className="pl-9"
                value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <Filter className="h-3.5 w-3.5 mr-2 text-slate-400" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="paid">Đã thanh toán</SelectItem>
                <SelectItem value="debt">Ghi nợ</SelectItem>
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
                    <Checkbox checked={selectedIds.length === filtered.length && filtered.length > 0}
                      onCheckedChange={toggleAll} />
                  </TableHead>}
                  <TableHead>Mã đơn</TableHead>
                  <TableHead>Thời gian</TableHead>
                  <TableHead>Khách hàng</TableHead>
                  <TableHead className="text-right">Tổng tiền</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      {[...Array(isAdmin ? 7 : 6)].map((_, j) => (
                        <TableCell key={j}><div className="h-4 bg-slate-100 rounded animate-pulse" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 7 : 6} className="text-center py-12 text-slate-400">
                      <History className="h-10 w-10 mx-auto mb-3 opacity-20" />
                      Chưa có giao dịch nào
                    </TableCell>
                  </TableRow>
                ) : filtered.map(o => (
                  <TableRow key={o.id} className={cn(selectedIds.includes(o.id!) && 'bg-blue-50/50')}>
                    {isAdmin && <TableCell className="pl-4">
                      <Checkbox checked={selectedIds.includes(o.id!)} onCheckedChange={() => toggleOne(o.id!)} />
                    </TableCell>}
                    <TableCell className="font-mono text-xs font-bold text-blue-600">{o.order_code}</TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {new Date(o.created_at).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}
                    </TableCell>
                    <TableCell className="font-medium">{o.customer_name}</TableCell>
                    <TableCell className="text-right font-bold">{o.total_amount.toLocaleString()}đ</TableCell>
                    <TableCell>
                      <Badge variant={o.status === 'paid' ? 'default' : 'destructive'}
                        className={o.status === 'paid' ? 'bg-emerald-100 text-emerald-700 border-0' : 'bg-red-100 text-red-700 border-0'}>
                        {o.status === 'paid' ? 'Đã thanh toán' : 'Ghi nợ'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => viewDetails(o)}>
                        <Eye className="h-4 w-4 text-blue-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="font-mono text-blue-600">{selectedOrder?.order_code}</span>
              <Badge variant={selectedOrder?.status === 'paid' ? 'default' : 'destructive'}
                className={selectedOrder?.status === 'paid' ? 'bg-emerald-100 text-emerald-700 border-0' : 'bg-red-100 text-red-700 border-0'}>
                {selectedOrder?.status === 'paid' ? 'Đã thanh toán' : 'Ghi nợ'}
              </Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 rounded-lg p-3">
              <div><span className="text-slate-500">Khách hàng:</span> <strong>{selectedOrder?.customer_name}</strong></div>
              <div><span className="text-slate-500">Thời gian:</span> <strong>{selectedOrder && new Date(selectedOrder.created_at).toLocaleString('vi-VN')}</strong></div>
            </div>
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Sản phẩm</TableHead>
                    <TableHead className="text-right">SL</TableHead>
                    <TableHead className="text-right">Đơn giá</TableHead>
                    <TableHead className="text-right">Thành tiền</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orderDetails.map(d => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.product_name}</TableCell>
                      <TableCell className="text-right">{d.quantity}</TableCell>
                      <TableCell className="text-right">{d.unit_price.toLocaleString()}đ</TableCell>
                      <TableCell className="text-right font-bold">{d.subtotal.toLocaleString()}đ</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Tổng hàng:</span><span>{selectedOrder?.subtotal.toLocaleString()}đ</span>
              </div>
              {(selectedOrder?.discount || 0) > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Giảm giá:</span><span>-{selectedOrder?.discount.toLocaleString()}đ</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base pt-2 border-t">
                <span>Tổng thanh toán:</span>
                <span className="text-blue-600">{selectedOrder?.total_amount.toLocaleString()}đ</span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete */}
      <Dialog open={isBulkDeleteOpen} onOpenChange={setIsBulkDeleteOpen}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader><DialogTitle>Xác nhận xóa giao dịch</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600 py-2">
            Xóa <strong>{selectedIds.length}</strong> giao dịch đã chọn? Hành động không thể hoàn tác.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkDeleteOpen(false)} disabled={deleting}>Hủy</Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={deleting}>
              {deleting ? 'Đang xóa...' : 'Xóa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
