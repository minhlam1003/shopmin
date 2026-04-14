import { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '@/firebase';
import { collection, onSnapshot, query, orderBy, getDocs, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { Order, OrderDetail } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { History, Eye, Search, Download, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Printer, FileText } from 'lucide-react';
import { numberToWordsVietnamese } from '@/lib/utils';
import { auth } from '@/firebase';

interface StoreSettings {
  storeName: string;
  phone: string;
  address: string;
  website: string;
  logoUrl: string;
  invoiceHeader: string;
  invoiceFooter: string;
}

const defaultSettings: StoreSettings = {
  storeName: 'ANVIỆT 262',
  phone: '0367633716',
  address: 'Hà Nội, Việt Nam',
  website: 'anviet262.vn',
  logoUrl: '',
  invoiceHeader: 'HÓA ĐƠN BÁN HÀNG',
  invoiceFooter: 'Cảm ơn và hẹn gặp lại!',
};

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderDetails, setOrderDetails] = useState<OrderDetail[]>([]);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [storeSettings, setStoreSettings] = useState<StoreSettings>(defaultSettings);

  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
    });

    const unsubSettings = onSnapshot(doc(db, 'settings', 'store_config'), (docSnap) => {
      if (docSnap.exists()) {
        setStoreSettings({ ...defaultSettings, ...docSnap.data() } as StoreSettings);
      }
    });

    return () => {
      unsubscribe();
      unsubSettings();
    };
  }, []);

  const downloadPDF = async () => {
    const element = document.getElementById('invoice-export-template');
    if (!element) {
      toast.error('Không tìm thấy mẫu hóa đơn');
      return;
    }

    try {
      toast.info('Đang tạo file PDF...');
      
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 800
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`HoaDon_${selectedOrder?.orderCode || 'Export'}.pdf`);
      toast.success('Đã tải xuống hóa đơn PDF');
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error('Lỗi khi tạo file PDF');
    }
  };

  const viewDetails = async (order: Order) => {
    setSelectedOrder(order);
    try {
      const detailsSnap = await getDocs(collection(db, `orders/${order.id}/details`));
      setOrderDetails(detailsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as OrderDetail)));
      setIsDetailsOpen(true);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, `orders/${order.id}/details`);
    }
  };

  const filteredOrders = orders.filter(o => 
    o.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.orderCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const exportToExcel = () => {
    if (orders.length === 0) {
      toast.error('Không có dữ liệu để xuất');
      return;
    }
    
    const exportData = orders.map(o => ({
      'Mã đơn': o.orderCode,
      'Thời gian': o.createdAt.toDate().toLocaleString('vi-VN'),
      'Khách hàng': o.customerName,
      'Tổng tiền': o.totalAmount,
      'Trạng thái': o.status === 'paid' ? 'Đã thanh toán' : 'Nợ'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "GiaoDich");
    XLSX.writeFile(workbook, `DanhSachGiaoDich_${new Date().getTime()}.xlsx`);
    toast.success('Đã xuất file Excel');
  };

  const handleBulkDelete = async () => {
    if (selectedOrderIds.length === 0) return;
    
    setIsDeleting(true);
    try {
      const batch = writeBatch(db);
      
      for (const orderId of selectedOrderIds) {
        // Delete order details first
        const detailsSnap = await getDocs(collection(db, `orders/${orderId}/details`));
        detailsSnap.docs.forEach(detailDoc => {
          batch.delete(detailDoc.ref);
        });
        
        // Delete the order itself
        batch.delete(doc(db, 'orders', orderId));
      }
      
      await batch.commit();
      toast.success(`Đã xóa ${selectedOrderIds.length} giao dịch`);
      setSelectedOrderIds([]);
      setIsBulkDeleteDialogOpen(false);
    } catch (error) {
      console.error(error);
      toast.error('Lỗi khi xóa giao dịch');
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedOrderIds.length === filteredOrders.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(filteredOrders.map(o => o.id!));
    }
  };

  const toggleSelectOrder = (id: string) => {
    setSelectedOrderIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <History className="h-6 w-6 text-purple-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Lịch sử Giao dịch</h1>
        </div>
        
        <div className="flex items-center gap-2">
          {selectedOrderIds.length > 0 && (
            <Button 
              variant="destructive" 
              onClick={() => setIsBulkDeleteDialogOpen(true)}
              className="bg-red-600 hover:bg-red-700"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Xóa ({selectedOrderIds.length})
            </Button>
          )}
          
          <Button 
            variant="outline" 
            className="border-purple-200 text-purple-700 hover:bg-purple-50"
            onClick={exportToExcel}
          >
            <Download className="mr-2 h-4 w-4" /> Xuất Excel
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Tìm theo mã đơn hoặc tên khách hàng..." 
              className="pl-10"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox 
                      checked={selectedOrderIds.length === filteredOrders.length && filteredOrders.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Mã đơn</TableHead>
                  <TableHead>Thời gian</TableHead>
                  <TableHead>Khách hàng</TableHead>
                  <TableHead className="text-right">Tổng tiền</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                      Chưa có giao dịch nào
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrders.map((order) => (
                    <TableRow key={order.id} className={selectedOrderIds.includes(order.id!) ? "bg-blue-50/50" : ""}>
                      <TableCell>
                        <Checkbox 
                          checked={selectedOrderIds.includes(order.id!)}
                          onCheckedChange={() => toggleSelectOrder(order.id!)}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs font-bold text-blue-600">{order.orderCode}</TableCell>
                      <TableCell>{order.createdAt.toDate().toLocaleString('vi-VN')}</TableCell>
                      <TableCell>{order.customerName}</TableCell>
                      <TableCell className="text-right font-semibold">{order.totalAmount.toLocaleString()}đ</TableCell>
                      <TableCell>
                        <Badge variant={order.status === 'paid' ? 'default' : 'destructive'}>
                          {order.status === 'paid' ? 'Đã thanh toán' : 'Nợ'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => viewDetails(order)}>
                          <Eye className="h-4 w-4 text-blue-600" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Chi tiết đơn hàng {selectedOrder?.orderCode}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500">Khách hàng:</p>
                <p className="font-medium">{selectedOrder?.customerName}</p>
              </div>
              <div>
                <p className="text-slate-500">Thời gian:</p>
                <p className="font-medium">{selectedOrder?.createdAt.toDate().toLocaleString('vi-VN')}</p>
              </div>
            </div>
            
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sản phẩm</TableHead>
                    <TableHead className="text-right">SL</TableHead>
                    <TableHead className="text-right">Đơn giá</TableHead>
                    <TableHead className="text-right">Thành tiền</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orderDetails.map((detail) => (
                    <TableRow key={detail.id}>
                      <TableCell>{detail.productName}</TableCell>
                      <TableCell className="text-right">{detail.quantity}</TableCell>
                      <TableCell className="text-right">{detail.unitPrice.toLocaleString()}đ</TableCell>
                      <TableCell className="text-right font-medium">{detail.subtotal.toLocaleString()}đ</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-between items-center pt-4 border-t">
              <div className="flex gap-2">
                <Badge variant={selectedOrder?.status === 'paid' ? 'default' : 'destructive'}>
                  {selectedOrder?.status === 'paid' ? 'Đã thanh toán' : 'Nợ'}
                </Badge>
                <Button variant="outline" size="sm" onClick={downloadPDF}>
                  <FileText className="mr-2 h-4 w-4" /> Xuất PDF
                </Button>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-500">Tổng cộng:</p>
                <p className="text-xl font-bold text-blue-600">{selectedOrder?.totalAmount.toLocaleString()}đ</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hidden PDF Template */}
      {selectedOrder && (
        <div className="fixed -left-[9999px] top-0 pointer-events-none" aria-hidden="true">
          <div id="invoice-export-template" className="p-8 text-slate-900 font-sans bg-white w-[800px]">
            <div className="flex justify-between text-[10px] text-slate-900 mb-4">
              <span>{selectedOrder.createdAt.toDate().getHours()}:{selectedOrder.createdAt.toDate().getMinutes().toString().padStart(2, '0')} {selectedOrder.createdAt.toDate().getDate()}/{selectedOrder.createdAt.toDate().getMonth() + 1}/{selectedOrder.createdAt.toDate().getFullYear().toString().slice(-2)}</span>
              <span>Chi nhánh trung tâm - Bán hàng</span>
            </div>

            <div className="text-[11px] mb-4 space-y-0.5 ml-24">
              <p>Tên cửa hàng: {storeSettings.storeName}</p>
              <p>Chi nhánh: - -</p>
              <p>Điện thoại: {storeSettings.phone}</p>
            </div>

            <div className="border-b border-dotted border-slate-900 mb-4" />

            <div className="mb-6">
              <p className="text-sm font-medium">
                Ngày bán: {selectedOrder.createdAt.toDate().getDate()} tháng {selectedOrder.createdAt.toDate().getMonth() + 1} năm {selectedOrder.createdAt.toDate().getFullYear()}
              </p>
            </div>

            <div className="text-center mb-8">
              <h2 className="text-lg font-bold uppercase tracking-widest">{storeSettings.invoiceHeader}</h2>
              <p className="text-xs font-bold">Số HĐ: {selectedOrder.orderCode}</p>
            </div>

            <div className="mb-6 text-[11px] space-y-1 ml-4">
              <p>Khách hàng: {selectedOrder.customerName}</p>
              <p>Địa chỉ: - -</p>
              <p>Khu vực: - -</p>
              <p>Người bán: {auth.currentUser?.displayName || 'Admin'}</p>
            </div>

            <div className="border-b border-dotted border-slate-900 mb-4" />

            <table className="w-full text-[11px] mb-4">
              <thead>
                <tr className="text-slate-900">
                  <th className="py-1 text-left font-medium">Đơn giá</th>
                  <th className="py-1 text-center font-medium">SL</th>
                  <th className="py-1 text-right font-medium">Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {orderDetails.map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-2" colSpan={3}>
                      <div className="font-medium mb-0.5">{item.productName}</div>
                      <div className="flex justify-between">
                        <span>{item.unitPrice.toLocaleString()}</span>
                        <span className="text-center w-20">{item.quantity}</span>
                        <span className="text-right">{(item.unitPrice * item.quantity).toLocaleString()}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="border-b border-dotted border-slate-900 mb-4" />

            <div className="space-y-1 text-[11px] ml-auto w-48">
              <div className="flex justify-between">
                <span>Tổng tiền hàng:</span>
                <span className="font-bold">{selectedOrder.subtotal?.toLocaleString() || selectedOrder.totalAmount.toLocaleString()}</span>
              </div>
              {selectedOrder.discount > 0 && (
                <div className="flex justify-between">
                  <span>Chiết khấu:</span>
                  <span className="font-bold">{selectedOrder.discount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between pt-1">
                <span className="font-bold">Tiền khách trả:</span>
                <span className="font-bold">{selectedOrder.totalAmount.toLocaleString()}</span>
              </div>
            </div>

            <div className="mt-auto pt-20 flex justify-between text-[9px] text-slate-500">
              <span>https://anviet2622.kiotviet.vn/sale/#/</span>
              <span>1/1</span>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xác nhận xóa giao dịch</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-slate-600">
              Bạn có chắc chắn muốn xóa <span className="font-bold text-red-600">{selectedOrderIds.length}</span> giao dịch đã chọn? 
              Hành động này không thể hoàn tác.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkDeleteDialogOpen(false)} disabled={isDeleting}>
              Hủy
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleBulkDelete} 
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Đang xóa..." : "Xác nhận xóa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

