import { useState, useEffect } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '@/firebase';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  query, 
  orderBy, 
  runTransaction, 
  Timestamp 
} from 'firebase/firestore';
import { Product, Customer, Order, OrderDetail } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, ShoppingCart, User, Trash2, Plus, Minus, CheckCircle2, ArrowLeft, Printer, UserPlus, QrCode, X, Scan, Zap, Store, Truck, ChevronDown, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { cn, numberToWordsVietnamese } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogTrigger
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

interface CartItem extends Product {
  quantity: number;
}

interface StoreSettings {
  storeName: string;
  phone: string;
  address: string;
  website: string;
  logoUrl: string;
  invoiceHeader: string;
  invoiceFooter: string;
  bankName: string;
  bankAccount: string;
  bankOwner: string;
}

const defaultSettings: StoreSettings = {
  storeName: 'ANVIỆT 262',
  phone: '0367633716',
  address: 'Hà Nội, Việt Nam',
  website: 'anviet262.vn',
  logoUrl: '',
  invoiceHeader: 'HÓA ĐƠN BÁN HÀNG',
  invoiceFooter: 'Cảm ơn và hẹn gặp lại!',
  bankName: '',
  bankAccount: '',
  bankOwner: '',
};

interface POSTab {
  id: string;
  name: string;
  cart: CartItem[];
  selectedCustomerId: string;
  discount: number;
  paymentStatus: 'paid' | 'debt';
  saleMode: 'quick' | 'normal' | 'delivery';
  deliveryInfo: {
    receiverName: string;
    receiverPhone: string;
    address: string;
    area: string;
    ward: string;
    note: string;
    cod: boolean;
  };
}

export default function POS() {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  
  // Tab Management
  const [tabs, setTabs] = useState<POSTab[]>([
    { 
      id: '1', 
      name: 'Hóa đơn 1', 
      cart: [], 
      selectedCustomerId: '', 
      discount: 0, 
      paymentStatus: 'paid',
      saleMode: 'normal',
      deliveryInfo: {
        receiverName: '',
        receiverPhone: '',
        address: '',
        area: '',
        ward: '',
        note: '',
        cod: false
      }
    }
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('1');
  
  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastOrder, setLastOrder] = useState<{ order: Order, items: CartItem[] } | null>(null);
  const [storeSettings, setStoreSettings] = useState<StoreSettings>(defaultSettings);

  // Quick customer creation state
  const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false);
  const [newCustomerData, setNewCustomerData] = useState({ name: '', phone: '', address: '' });
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);

  useEffect(() => {
    const unsubProds = onSnapshot(query(collection(db, 'products'), orderBy('name')), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    });
    const unsubCusts = onSnapshot(query(collection(db, 'customers'), orderBy('name')), (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
    });
    const unsubSettings = onSnapshot(doc(db, 'settings', 'store_config'), (docSnap) => {
      if (docSnap.exists()) {
        setStoreSettings({ ...defaultSettings, ...docSnap.data() } as StoreSettings);
      }
    });
    return () => {
      unsubProds();
      unsubCusts();
      unsubSettings();
    };
  }, []);

  const downloadPDF = async () => {
    const element = document.getElementById('invoice-template');
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
      pdf.save(`HoaDon_${lastOrder?.order.orderCode || 'Export'}.pdf`);
      toast.success('Đã tải xuống hóa đơn PDF');
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error('Lỗi khi tạo file PDF. Vui lòng thử lại.');
    }
  };

  const updateActiveTab = (updates: Partial<POSTab>) => {
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, ...updates } : t));
  };

  const updateDeliveryInfo = (updates: Partial<POSTab['deliveryInfo']>) => {
    updateActiveTab({
      deliveryInfo: { ...activeTab.deliveryInfo, ...updates }
    });
  };

  const addNewTab = () => {
    const newId = Date.now().toString();
    const newName = `Hóa đơn ${tabs.length + 1}`;
    const newTab: POSTab = {
      id: newId,
      name: newName,
      cart: [],
      selectedCustomerId: '',
      discount: 0,
      paymentStatus: 'paid',
      saleMode: 'normal',
      deliveryInfo: {
        receiverName: '',
        receiverPhone: '',
        address: '',
        area: '',
        ward: '',
        note: '',
        cod: false
      }
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newId);
  };

  const closeTab = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (tabs.length === 1) {
      // Reset the only tab instead of closing
      updateActiveTab({ cart: [], selectedCustomerId: '', discount: 0, paymentStatus: 'paid' });
      return;
    }
    const newTabs = tabs.filter(t => t.id !== id);
    setTabs(newTabs);
    if (activeTabId === id) {
      setActiveTabId(newTabs[newTabs.length - 1].id);
    }
  };

  const addToCart = (product: Product) => {
    if (product.stockLevel <= 0) {
      toast.error('Sản phẩm đã hết hàng');
      return;
    }

    const newCart = [...activeTab.cart];
    const existing = newCart.find(item => item.id === product.id);
    
    if (existing) {
      if (existing.quantity >= product.stockLevel) {
        toast.error('Không đủ tồn kho');
        return;
      }
      existing.quantity += 1;
    } else {
      newCart.push({ ...product, quantity: 1 });
    }
    
    updateActiveTab({ cart: newCart });
    setSearchTerm(''); // Clear search after adding
  };

  const updateQuantity = (id: string, delta: number) => {
    const newCart = activeTab.cart.map(item => {
      if (item.id === id) {
        const newQty = item.quantity + delta;
        const product = products.find(p => p.id === id);
        if (newQty > (product?.stockLevel || 0)) {
          toast.error('Không đủ tồn kho');
          return item;
        }
        return newQty > 0 ? { ...item, quantity: newQty } : item;
      }
      return item;
    });
    updateActiveTab({ cart: newCart });
  };

  const removeFromCart = (id: string) => {
    updateActiveTab({ cart: activeTab.cart.filter(item => item.id !== id) });
  };

  const subtotal = activeTab.cart.reduce((sum, item) => sum + item.sellPrice * item.quantity, 0);
  const totalAmount = Math.max(0, subtotal - activeTab.discount);

  const handleCheckout = async (shouldPrint = false) => {
    if (activeTab.cart.length === 0) {
      toast.error('Giỏ hàng trống');
      return;
    }

    setIsProcessing(true);
    try {
      let orderCode = '';
      let finalCustomerName = 'Khách lẻ';
      let finalCustomerPhone = '';
      let finalCustomerAddress = '';

      await runTransaction(db, async (transaction) => {
        // 1. ALL READS FIRST
        let customerData: Customer | null = null;
        if (activeTab.selectedCustomerId) {
          const customerRef = doc(db, 'customers', activeTab.selectedCustomerId);
          const customerSnap = await transaction.get(customerRef);
          if (customerSnap.exists()) {
            customerData = customerSnap.data() as Customer;
            finalCustomerName = customerData.name;
            finalCustomerPhone = customerData.phone;
            finalCustomerAddress = customerData.address;
          }
        }

        // Read all products in cart
        const productSnaps = await Promise.all(
          activeTab.cart.map(item => transaction.get(doc(db, 'products', item.id!)))
        );

        // Validate stock levels
        const productUpdates = activeTab.cart.map((item, index) => {
          const snap = productSnaps[index];
          if (!snap.exists()) throw new Error(`Sản phẩm ${item.name} không tồn tại`);
          const currentStock = snap.data().stockLevel;
          if (currentStock < item.quantity) throw new Error(`Sản phẩm ${item.name} không đủ tồn kho`);
          return { ref: snap.ref, newStock: currentStock - item.quantity };
        });

        // 2. ALL WRITES AFTER READS
        const orderRef = doc(collection(db, 'orders'));
        orderCode = `HD${Date.now().toString().slice(-6)}`;
        
        // Create Order
        const orderData: any = {
          orderCode,
          customerId: activeTab.selectedCustomerId || 'guest',
          customerName: finalCustomerName,
          subtotal,
          discount: activeTab.discount,
          totalAmount,
          status: activeTab.paymentStatus,
          createdAt: Timestamp.now(),
        };
        transaction.set(orderRef, orderData);

        // Create Order Details & Update Stock
        for (let i = 0; i < activeTab.cart.length; i++) {
          const item = activeTab.cart[i];
          const update = productUpdates[i];
          
          const detailRef = doc(collection(db, `orders/${orderRef.id}/details`));
          transaction.set(detailRef, {
            orderId: orderRef.id,
            productId: item.id,
            productName: item.name,
            quantity: item.quantity,
            unitPrice: item.sellPrice,
            subtotal: item.sellPrice * item.quantity,
          });

          transaction.update(update.ref, {
            stockLevel: update.newStock
          });
        }

        // Update Customer Debt if status is 'debt' and customer exists
        if (activeTab.paymentStatus === 'debt' && activeTab.selectedCustomerId && customerData) {
          transaction.update(doc(db, 'customers', activeTab.selectedCustomerId), {
            currentDebt: (customerData.currentDebt || 0) + totalAmount
          });
        }

        if (shouldPrint) {
          setLastOrder({
            order: { ...orderData, id: orderRef.id },
            items: [...activeTab.cart]
          });
        }
      });

      toast.success(shouldPrint ? 'Đã lưu và đang in hóa đơn...' : 'Thanh toán thành công');
      
      if (shouldPrint) {
        setTimeout(() => {
          window.print();
        }, 500);
      }

      // Reset current tab
      updateActiveTab({
        cart: [],
        selectedCustomerId: '',
        discount: 0,
        paymentStatus: 'paid'
      });
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Lỗi khi thanh toán');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleQuickCreateCustomer = async () => {
    if (!newCustomerData.name) {
      toast.error('Vui lòng nhập tên khách hàng');
      return;
    }

    setIsCreatingCustomer(true);
    try {
      const docRef = await addDoc(collection(db, 'customers'), {
        name: newCustomerData.name,
        phone: newCustomerData.phone,
        address: newCustomerData.address,
        currentDebt: 0,
        createdAt: Timestamp.now()
      });
      
      updateActiveTab({ selectedCustomerId: docRef.id });
      setIsCustomerDialogOpen(false);
      setNewCustomerData({ name: '', phone: '', address: '' });
      toast.success('Đã thêm khách hàng mới');
    } catch (error) {
      console.error(error);
      toast.error('Lỗi khi thêm khách hàng');
    } finally {
      setIsCreatingCustomer(false);
    }
  };

  const filteredProducts = products
    .filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.code.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      // Prioritize items with stock > 0
      if (a.stockLevel > 0 && b.stockLevel <= 0) return -1;
      if (a.stockLevel <= 0 && b.stockLevel > 0) return 1;
      return 0;
    });

  return (
    <div className="fixed inset-0 bg-slate-100 flex flex-col z-50">
      {/* Blue Header */}
      <header className="bg-blue-600 h-14 flex items-center px-4 gap-4 shrink-0">
        <Link to="/" className="text-white hover:bg-blue-700 p-2 rounded-full transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-200" />
          <Input 
            placeholder="Tìm hàng hóa (F3)" 
            className="bg-blue-700/50 border-none text-white placeholder:text-blue-200 pl-10 pr-10 h-10 focus-visible:ring-1 focus-visible:ring-blue-300"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            autoFocus
          />
          <QrCode className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-200 cursor-pointer hover:text-white" />
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 h-full overflow-x-auto no-scrollbar">
          {tabs.map(tab => (
            <div 
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={cn(
                "h-10 px-4 flex items-center gap-2 cursor-pointer transition-all rounded-t-lg text-sm font-medium min-w-[120px] relative group",
                activeTabId === tab.id 
                  ? "bg-slate-100 text-blue-600" 
                  : "text-blue-100 hover:bg-blue-500/50"
              )}
            >
              <ShoppingCart className="h-4 w-4 shrink-0" />
              <span className="truncate">{tab.name}</span>
              <button 
                onClick={(e) => closeTab(e, tab.id)}
                className="ml-auto p-0.5 hover:bg-slate-200 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <button 
            onClick={addNewTab}
            className="p-2 text-blue-100 hover:bg-blue-500/50 rounded-full transition-colors"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>

        <div className="ml-auto flex items-center gap-4">
          <div className="flex items-center gap-2 text-white">
            <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center font-bold text-sm">
              A
            </div>
            <span className="text-sm font-medium hidden md:inline">Admin</span>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Product Area */}
        <main className="flex-1 overflow-y-auto p-4">
          {searchTerm ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredProducts.map(product => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="flex flex-col text-left p-3 rounded-xl border border-white hover:border-blue-500 hover:shadow-md transition-all bg-white group"
                >
                  <div className="flex-1">
                    <p className="text-[10px] font-mono text-slate-400 mb-1">{product.code}</p>
                    <p className="font-semibold text-sm line-clamp-2 group-hover:text-blue-600">{product.name}</p>
                    <p className="text-[10px] text-slate-500 mt-1">{product.category} {product.unit ? `| ${product.unit}` : ''}</p>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-blue-600 font-bold">{product.sellPrice.toLocaleString()}đ</p>
                    <p className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded",
                      product.stockLevel <= 5 ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"
                    )}>
                      Tồn: {product.stockLevel}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
              <Search className="h-16 w-16 mb-4 opacity-10" />
              <p className="text-lg font-medium opacity-50">Tìm kiếm hàng hóa để thêm vào đơn hàng</p>
              <p className="text-sm opacity-30 mt-1">Nhập tên, mã hoặc loại hàng hóa vào ô tìm kiếm</p>
            </div>
          )}
        </main>

        {/* Sidebar */}
        <aside className="w-[400px] bg-white border-l flex flex-col shrink-0">
          {/* Customer Selection */}
          <div className="p-4 border-b space-y-4">
            <div className="flex items-center justify-between text-sm text-slate-500">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-900">Phùng Minh Lâm</span>
                <ChevronDown className="h-4 w-4" />
              </div>
              <div className="flex items-center gap-4">
                <User className="h-4 w-4" />
                <span>13/04/2026 14:55</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-slate-400" />
              <div className="flex-1">
                <Select value={activeTab.selectedCustomerId} onValueChange={(val) => updateActiveTab({ selectedCustomerId: val })}>
                  <SelectTrigger className="border-none shadow-none focus:ring-0 p-0 h-auto text-slate-600">
                    <SelectValue placeholder="Tìm khách hàng (F4)" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map(c => (
                      <SelectItem key={c.id} value={c.id!}>{c.name} - {c.phone}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Dialog open={isCustomerDialogOpen} onOpenChange={setIsCustomerDialogOpen}>
                <DialogTrigger render={
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600">
                    <Plus className="h-5 w-5" />
                  </Button>
                } />
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Thêm khách hàng nhanh</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Tên khách hàng</Label>
                      <Input 
                        id="name" 
                        value={newCustomerData.name}
                        onChange={e => setNewCustomerData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Nguyễn Văn A"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="phone">Số điện thoại</Label>
                      <Input 
                        id="phone" 
                        value={newCustomerData.phone}
                        onChange={e => setNewCustomerData(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="090..."
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="address">Địa chỉ</Label>
                      <Input 
                        id="address" 
                        value={newCustomerData.address}
                        onChange={e => setNewCustomerData(prev => ({ ...prev, address: e.target.value }))}
                        placeholder="Địa chỉ khách hàng"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsCustomerDialogOpen(false)}>Hủy</Button>
                    <Button 
                      onClick={handleQuickCreateCustomer} 
                      disabled={isCreatingCustomer}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {isCreatingCustomer ? "Đang lưu..." : "Lưu & Chọn"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {activeTab.saleMode === 'delivery' && (
              <div className="space-y-4 pt-2 border-t">
                <div className="flex border rounded-md overflow-hidden">
                  <button className="flex-1 py-2 text-xs font-bold bg-blue-50 text-blue-600">TỰ GIAO HÀNG</button>
                </div>

                <div className="bg-blue-50 p-3 rounded-md flex gap-3 items-start">
                  <div className="bg-white p-1 rounded-full text-blue-500 shrink-0">
                    <Zap className="h-4 w-4 fill-current" />
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Nhập đầy đủ địa chỉ lấy và giao để hoàn tất đơn hàng tự giao.
                  </p>
                </div>

                <div className="flex items-center gap-2 text-blue-600">
                  <div className="h-2 w-2 rounded-full bg-blue-600" />
                  <Input 
                    className="border-none shadow-none p-0 h-auto text-sm" 
                    placeholder="Địa chỉ lấy hàng (Mặc định tại kho)"
                    value={activeTab.deliveryInfo.receiverPhone}
                    onChange={e => updateDeliveryInfo({ receiverPhone: e.target.value })}
                  />
                </div>
                <div className="flex gap-4">
                  <div className="flex-1 space-y-1">
                    <Label className="text-[10px] text-slate-400 uppercase">Tên người nhận</Label>
                    <Input 
                      className="border-none border-b rounded-none shadow-none p-0 h-8 focus-visible:ring-0" 
                      value={activeTab.deliveryInfo.receiverName}
                      onChange={e => updateDeliveryInfo({ receiverName: e.target.value })}
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label className="text-[10px] text-slate-400 uppercase">Số điện thoại</Label>
                    <Input 
                      className="border-none border-b rounded-none shadow-none p-0 h-8 focus-visible:ring-0" 
                      value={activeTab.deliveryInfo.receiverPhone}
                      onChange={e => updateDeliveryInfo({ receiverPhone: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-slate-400 uppercase">Địa chỉ chi tiết (Số nhà, ngõ, đường)</Label>
                  <Input 
                    className="border-none border-b rounded-none shadow-none p-0 h-8 focus-visible:ring-0" 
                    value={activeTab.deliveryInfo.address}
                    onChange={e => updateDeliveryInfo({ address: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-slate-400 uppercase">Khu vực</Label>
                  <Input 
                    className="border-none border-b rounded-none shadow-none p-0 h-8 focus-visible:ring-0" 
                    value={activeTab.deliveryInfo.area}
                    onChange={e => updateDeliveryInfo({ area: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-slate-400 uppercase">Phường/Xã</Label>
                  <Input 
                    className="border-none border-b rounded-none shadow-none p-0 h-8 focus-visible:ring-0" 
                    value={activeTab.deliveryInfo.ward}
                    onChange={e => updateDeliveryInfo({ ward: e.target.value })}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-slate-400" />
                  <Input 
                    className="border-none shadow-none p-0 h-auto text-sm" 
                    placeholder="Ghi chú cho bưu tá"
                    value={activeTab.deliveryInfo.note}
                    onChange={e => updateDeliveryInfo({ note: e.target.value })}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto">
            {activeTab.cart.length > 0 ? (
              <div className="divide-y">
                {activeTab.cart.map(item => (
                  <div key={item.id} className="p-4 group">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium text-sm line-clamp-2 flex-1">{item.name}</span>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeFromCart(item.id!)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center border rounded-md">
                        <button 
                          className="px-2 py-1 hover:bg-slate-50 text-slate-500"
                          onClick={() => updateQuantity(item.id!, -1)}
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="px-3 py-1 text-sm font-medium border-x min-w-[40px] text-center">
                          {item.quantity}
                        </span>
                        <button 
                          className="px-2 py-1 hover:bg-slate-50 text-slate-500"
                          onClick={() => updateQuantity(item.id!, 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <span className="font-bold text-blue-600">
                        {(item.sellPrice * item.quantity).toLocaleString()}đ
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 p-8">
                <ShoppingCart className="h-16 w-16 mb-4 opacity-20" />
                <p className="text-sm font-medium">Chưa có hàng hóa nào</p>
              </div>
            )}
          </div>

          {/* Totals & Actions */}
          <div className="p-4 bg-slate-50 border-t space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between text-sm text-slate-600">
                <span>Tổng tiền hàng ({activeTab.cart.length})</span>
                <span className="font-bold text-slate-900">{subtotal.toLocaleString()} đ</span>
              </div>
              <div className="flex justify-between items-center text-sm text-slate-600">
                <span>Giảm giá</span>
                <div className="flex items-center gap-1 border-b border-slate-300">
                  <input 
                    type="number" 
                    className="w-20 bg-transparent text-right focus:outline-none font-bold text-slate-900"
                    value={activeTab.discount}
                    onChange={e => updateActiveTab({ discount: Number(e.target.value) })}
                  />
                  <span className="text-[10px] text-slate-400">đ</span>
                </div>
              </div>
              <div className="pt-2 flex justify-between items-center">
                <span className="text-sm font-bold text-slate-900 uppercase">Khách cần trả</span>
                <span className="text-2xl font-bold text-blue-600">{totalAmount.toLocaleString()} đ</span>
              </div>
            </div>

            {activeTab.saleMode === 'delivery' && (
              <div className="flex items-center justify-between py-2 border-t">
                <span className="text-sm font-medium">Thu hộ tiền (COD)</span>
                <div className="flex items-center gap-2">
                  <Switch 
                    checked={activeTab.deliveryInfo.cod} 
                    onCheckedChange={val => updateDeliveryInfo({ cod: val })} 
                  />
                  <span className="font-bold text-blue-600">{activeTab.deliveryInfo.cod ? totalAmount.toLocaleString() : 0}</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Button 
                variant="outline" 
                className="h-12 border-blue-200 text-blue-600 hover:bg-blue-50 font-bold uppercase"
                disabled={isProcessing || activeTab.cart.length === 0}
                onClick={() => handleCheckout(true)}
              >
                <Printer className="mr-2 h-5 w-5" /> Lưu & In
              </Button>
              <Button 
                className="h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold uppercase"
                disabled={isProcessing || activeTab.cart.length === 0}
                onClick={() => handleCheckout(false)}
              >
                {isProcessing ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  "Thanh toán"
                )}
              </Button>
            </div>
            
            <div className="flex justify-center gap-4">
              <button 
                onClick={() => updateActiveTab({ paymentStatus: 'paid' })}
                className={cn(
                  "text-[10px] uppercase font-bold px-2 py-1 rounded",
                  activeTab.paymentStatus === 'paid' ? "bg-blue-100 text-blue-600" : "text-slate-400"
                )}
              >
                Tiền mặt
              </button>
              <button 
                onClick={() => updateActiveTab({ paymentStatus: 'debt' })}
                className={cn(
                  "text-[10px] uppercase font-bold px-2 py-1 rounded",
                  activeTab.paymentStatus === 'debt' ? "bg-orange-100 text-orange-600" : "text-slate-400"
                )}
              >
                Ghi nợ
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* Bottom Sale Mode Bar */}
      <div className="h-12 bg-white border-t flex items-center px-4 gap-8 shrink-0">
        <button 
          onClick={() => updateActiveTab({ saleMode: 'quick' })}
          className={cn(
            "flex items-center gap-2 text-sm font-medium h-full border-t-2 transition-all",
            activeTab.saleMode === 'quick' ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500"
          )}
        >
          <Zap className="h-4 w-4" />
          Bán nhanh
        </button>
        <button 
          onClick={() => updateActiveTab({ saleMode: 'normal' })}
          className={cn(
            "flex items-center gap-2 text-sm font-medium h-full border-t-2 transition-all",
            activeTab.saleMode === 'normal' ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500"
          )}
        >
          <Store className="h-4 w-4" />
          Bán thường
        </button>
        <button 
          onClick={() => updateActiveTab({ saleMode: 'delivery' })}
          className={cn(
            "flex items-center gap-2 text-sm font-medium h-full border-t-2 transition-all",
            activeTab.saleMode === 'delivery' ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500"
          )}
        >
          <Truck className="h-4 w-4" />
          Bán giao hàng
        </button>

        <div className="ml-auto flex items-center gap-6 text-slate-400">
          <div className="flex items-center gap-2 hover:text-blue-600 cursor-pointer">
            <ShoppingCart className="h-4 w-4" />
            <span className="text-xs">1900 6522</span>
          </div>
        </div>
      </div>

      {/* Print Template */}
      {lastOrder && (
        <div className="fixed -left-[9999px] top-0 bg-white z-[9999] p-8 text-slate-900 font-sans overflow-y-auto print:visible print:left-0 print:inset-0" id="invoice-print-container">
          <div className="w-[800px] mx-auto relative min-h-screen pb-12" id="invoice-template">
            {/* PDF Download Button (Visible only on screen, not in print) */}
            <div className="absolute top-0 right-0 print:hidden flex gap-2">
              <Button variant="outline" size="sm" onClick={downloadPDF}>
                Tải PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => setLastOrder(null)}>
                Đóng
              </Button>
            </div>

            {/* Top Bar */}
            <div className="flex justify-between text-[10px] text-slate-900 mb-4">
              <span>{new Date().getHours()}:{new Date().getMinutes().toString().padStart(2, '0')} {new Date().getDate()}/{new Date().getMonth() + 1}/{new Date().getFullYear().toString().slice(-2)}</span>
              <span>Chi nhánh trung tâm - Bán hàng</span>
            </div>

            {/* Store Info */}
            <div className="text-[11px] mb-4 space-y-0.5 ml-24">
              <p>Tên cửa hàng: {storeSettings.storeName}</p>
              <p>Chi nhánh: - -</p>
              <p>Điện thoại: {storeSettings.phone}</p>
            </div>

            {/* Divider */}
            <div className="border-b border-dotted border-slate-900 mb-4" />

            {/* Date of Sale */}
            <div className="mb-6">
              <p className="text-sm font-medium">
                Ngày bán: {lastOrder.order.createdAt.toDate().getDate()} tháng {lastOrder.order.createdAt.toDate().getMonth() + 1} năm {lastOrder.order.createdAt.toDate().getFullYear()}
              </p>
            </div>

            {/* Title */}
            <div className="text-center mb-8">
              <h2 className="text-lg font-bold uppercase tracking-widest">{storeSettings.invoiceHeader}</h2>
            </div>

            {/* Customer Info */}
            <div className="mb-6 text-[11px] space-y-1 ml-4">
              <p>Khách hàng: {lastOrder.order.customerName}</p>
              <p>Địa chỉ: {customers.find(c => c.id === lastOrder.order.customerId)?.address || '- -'}</p>
              <p>Khu vực: - -</p>
              <p>Người bán: {auth.currentUser?.displayName || 'Admin'}</p>
            </div>

            {/* Divider */}
            <div className="border-b border-dotted border-slate-900 mb-4" />

            {/* Table */}
            <table className="w-full text-[11px] mb-4">
              <thead>
                <tr className="text-slate-900">
                  <th className="py-1 text-left font-medium">Đơn giá</th>
                  <th className="py-1 text-center font-medium">SL</th>
                  <th className="py-1 text-right font-medium">Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {lastOrder.items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-2" colSpan={3}>
                      <div className="font-medium mb-0.5">{item.name}</div>
                      <div className="flex justify-between">
                        <span>{item.sellPrice.toLocaleString()}</span>
                        <span className="text-center w-20">{item.quantity}</span>
                        <span className="text-right">{(item.sellPrice * item.quantity).toLocaleString()}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Divider */}
            <div className="border-b border-dotted border-slate-900 mb-4" />

            {/* Totals */}
            <div className="space-y-1 text-[11px] ml-auto w-48">
              <div className="flex justify-between">
                <span>Tổng tiền hàng:</span>
                <span className="font-bold">{lastOrder.order.subtotal.toLocaleString()}</span>
              </div>
              {lastOrder.order.discount > 0 && (
                <div className="flex justify-between">
                  <span>Chiết khấu:</span>
                  <span className="font-bold">{lastOrder.order.discount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between pt-1">
                <span className="font-bold">Tiền khách trả:</span>
                <span className="font-bold">{lastOrder.order.totalAmount.toLocaleString()}</span>
              </div>
            </div>

            {/* Payment Info (Optional, keeping it but subtle) */}
            {storeSettings.bankAccount && (
              <div className="mt-8 pt-4 border-t border-dotted border-slate-300 print:hidden">
                <p className="text-[9px] font-bold uppercase text-slate-400 mb-2">Thông tin chuyển khoản</p>
                <div className="flex justify-between text-[10px]">
                  <div>
                    <p>Ngân hàng: {storeSettings.bankName}</p>
                    <p>Số TK: {storeSettings.bankAccount}</p>
                    <p>Chủ TK: {storeSettings.bankOwner}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="mt-auto pt-20 flex justify-between text-[9px] text-slate-500">
              <span>https://anviet2622.kiotviet.vn/sale/#/</span>
              <span>1/1</span>
            </div>

            {/* Page Number */}
            <div className="absolute bottom-0 right-0 text-[10px] text-slate-500">
              1/1
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

