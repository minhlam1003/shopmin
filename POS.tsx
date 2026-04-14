import { useState, useEffect } from 'react';
import { supabase, type Product, type Customer } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import {
  Search, ShoppingCart, Trash2, Plus, Minus, Printer, ArrowLeft,
  X, User, Store, Zap, Truck, QrCode, ChevronDown, Package, Receipt
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { useAuth } from '@/App';

interface CartItem extends Product { quantity: number }

interface POSTab {
  id: string; name: string; cart: CartItem[];
  customerId: string; discount: number;
  paymentStatus: 'paid' | 'debt'; saleMode: 'quick' | 'normal';
}

const newTab = (n: number): POSTab => ({
  id: Date.now().toString(), name: `Hóa đơn ${n}`, cart: [],
  customerId: '', discount: 0, paymentStatus: 'paid', saleMode: 'normal',
});

export default function POS() {
  const { profile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tabs, setTabs] = useState<POSTab[]>([newTab(1)]);
  const [activeTabId, setActiveTabId] = useState(tabs[0].id);
  const [searchTerm, setSearchTerm] = useState('');
  const [processing, setProcessing] = useState(false);
  const [storeName, setStoreName] = useState('ShopMin');

  // Quick customer
  const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', address: '' });

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];
  const update = (updates: Partial<POSTab>) =>
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, ...updates } : t));

  useEffect(() => {
    supabase.from('products').select('*').order('name').then(({ data }) => { if (data) setProducts(data as Product[]); });
    supabase.from('customers').select('*').order('name').then(({ data }) => { if (data) setCustomers(data as Customer[]); });
    supabase.from('settings').select('value').eq('key', 'store_name').single()
      .then(({ data }) => { if (data?.value) setStoreName(data.value); });
  }, []);

  const addToCart = (p: Product) => {
    if (p.stock_level <= 0) return toast.error('Hết hàng');
    const cart = [...activeTab.cart];
    const ex = cart.find(i => i.id === p.id);
    if (ex) {
      if (ex.quantity >= p.stock_level) return toast.error('Không đủ tồn kho');
      ex.quantity += 1;
    } else {
      cart.push({ ...p, quantity: 1 });
    }
    update({ cart });
    setSearchTerm('');
  };

  const updateQty = (id: string, delta: number) => {
    const cart = activeTab.cart.map(item => {
      if (item.id !== id) return item;
      const newQty = item.quantity + delta;
      const prod = products.find(p => p.id === id);
      if (delta > 0 && newQty > (prod?.stock_level || 0)) { toast.error('Không đủ tồn kho'); return item; }
      return newQty > 0 ? { ...item, quantity: newQty } : item;
    });
    update({ cart });
  };

  const removeFromCart = (id: string) => update({ cart: activeTab.cart.filter(i => i.id !== id) });

  const subtotal = activeTab.cart.reduce((s, i) => s + i.sell_price * i.quantity, 0);
  const totalAmount = Math.max(0, subtotal - activeTab.discount);

  const checkout = async (print = false) => {
    if (!activeTab.cart.length) return toast.error('Giỏ hàng trống');
    setProcessing(true);
    try {
      // 1. Check stock
      for (const item of activeTab.cart) {
        const { data: p } = await supabase.from('products').select('stock_level').eq('id', item.id).single();
        if (!p || p.stock_level < item.quantity) throw new Error(`${item.name}: không đủ tồn kho`);
      }

      // 2. Get customer name
      let customerName = 'Khách lẻ';
      if (activeTab.customerId) {
        const cust = customers.find(c => c.id === activeTab.customerId);
        if (cust) customerName = cust.name;
      }

      // 3. Create order
      const orderCode = `HD${Date.now().toString().slice(-8)}`;
      const { data: order, error: orderErr } = await supabase.from('orders').insert({
        order_code: orderCode,
        customer_id: activeTab.customerId || null,
        customer_name: customerName,
        user_id: profile?.id || null,
        subtotal,
        discount: activeTab.discount,
        total_amount: totalAmount,
        status: activeTab.paymentStatus,
      }).select().single();

      if (orderErr) throw orderErr;

      // 4. Create order details
      const details = activeTab.cart.map(item => ({
        order_id: order.id,
        product_id: item.id,
        product_name: item.name,
        quantity: item.quantity,
        unit_price: item.sell_price,
        subtotal: item.sell_price * item.quantity,
      }));
      const { error: detailErr } = await supabase.from('order_details').insert(details);
      if (detailErr) throw detailErr;

      // 5. Update stock levels
      for (const item of activeTab.cart) {
        const prod = products.find(p => p.id === item.id)!;
        await supabase.from('products').update({ stock_level: prod.stock_level - item.quantity }).eq('id', item.id);
      }

      // 6. Update customer debt if needed
      if (activeTab.paymentStatus === 'debt' && activeTab.customerId) {
        const cust = customers.find(c => c.id === activeTab.customerId)!;
        await supabase.from('customers').update({
          current_debt: (cust.current_debt || 0) + totalAmount,
          total_spent: (cust.total_spent || 0) + totalAmount,
          total_orders: (cust.total_orders || 0) + 1,
        }).eq('id', activeTab.customerId);
      } else if (activeTab.customerId) {
        const cust = customers.find(c => c.id === activeTab.customerId)!;
        await supabase.from('customers').update({
          total_spent: (cust.total_spent || 0) + totalAmount,
          total_orders: (cust.total_orders || 0) + 1,
        }).eq('id', activeTab.customerId);
      }

      // Refresh products
      const { data: freshProds } = await supabase.from('products').select('*').order('name');
      if (freshProds) setProducts(freshProds as Product[]);

      toast.success(`Thanh toán thành công! Mã đơn: ${orderCode}`);
      update({ cart: [], customerId: '', discount: 0, paymentStatus: 'paid' });
      if (print) setTimeout(() => window.print(), 500);
    } catch (e: any) {
      toast.error(e.message || 'Lỗi thanh toán');
    } finally {
      setProcessing(false);
    }
  };

  const quickAddCustomer = async () => {
    if (!newCustomer.name) return toast.error('Vui lòng nhập tên');
    const { data, error } = await supabase.from('customers').insert({
      name: newCustomer.name, phone: newCustomer.phone, address: newCustomer.address, current_debt: 0
    }).select().single();
    if (error) return toast.error(error.message);
    setCustomers(prev => [...prev, data as Customer]);
    update({ customerId: data.id });
    setIsCustomerDialogOpen(false);
    setNewCustomer({ name: '', phone: '', address: '' });
    toast.success('Đã thêm khách hàng');
  };

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.code.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => (a.stock_level > 0 ? -1 : 1) - (b.stock_level > 0 ? -1 : 1));

  const selectedCustomer = customers.find(c => c.id === activeTab.customerId);

  return (
    <div className="fixed inset-0 bg-slate-100 flex flex-col z-50">
      {/* Header */}
      <header className="bg-blue-600 h-14 flex items-center px-4 gap-3 shrink-0">
        <Link to="/" className="text-white hover:bg-blue-700 p-2 rounded-full transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>

        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-200" />
          <Input
            placeholder="Tìm hàng hóa..." autoFocus value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="bg-blue-700/50 border-none text-white placeholder:text-blue-200 pl-10 h-9 focus-visible:ring-1 focus-visible:ring-blue-300"
          />
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto flex-1">
          {tabs.map(tab => (
            <div key={tab.id} onClick={() => setActiveTabId(tab.id)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-t-lg cursor-pointer text-xs font-medium transition-all min-w-[110px] max-w-[140px] group',
                activeTabId === tab.id ? 'bg-slate-100 text-blue-600' : 'text-blue-100 hover:bg-blue-500/50'
              )}>
              <Receipt className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate flex-1">{tab.name}</span>
              <button onClick={e => {
                e.stopPropagation();
                if (tabs.length === 1) { update({ cart: [], customerId: '', discount: 0 }); return; }
                const remaining = tabs.filter(t => t.id !== tab.id);
                setTabs(remaining);
                if (activeTabId === tab.id) setActiveTabId(remaining.at(-1)!.id);
              }} className="opacity-0 group-hover:opacity-100 hover:bg-slate-200 rounded p-0.5 transition-all">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <button onClick={() => {
            const t = newTab(tabs.length + 1);
            setTabs(prev => [...prev, t]);
            setActiveTabId(t.id);
          }} className="p-1.5 text-blue-200 hover:bg-blue-500/50 rounded-full">
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2 text-white text-sm">
          <div className="h-7 w-7 bg-blue-500 rounded-full flex items-center justify-center font-bold text-xs">
            {(profile?.full_name || 'A').charAt(0).toUpperCase()}
          </div>
          <span className="hidden md:inline text-sm font-medium">{profile?.full_name || profile?.email?.split('@')[0]}</span>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Product grid */}
        <main className="flex-1 overflow-y-auto p-4">
          {searchTerm ? (
            filtered.length === 0 ? (
              <div className="text-center py-20 text-slate-400">
                <Package className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>Không tìm thấy sản phẩm</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
                {filtered.map(p => (
                  <button key={p.id} onClick={() => addToCart(p)} disabled={p.stock_level <= 0}
                    className={cn(
                      'text-left p-3 rounded-xl border bg-white transition-all hover:shadow-md hover:border-blue-400 hover:-translate-y-0.5 active:scale-95 group',
                      p.stock_level <= 0 && 'opacity-50 cursor-not-allowed'
                    )}>
                    {p.images && (
                      <div className="h-16 mb-2 rounded-lg overflow-hidden bg-slate-50">
                        <img src={p.images.split(',')[0]} alt={p.name} className="h-full w-full object-cover" />
                      </div>
                    )}
                    <p className="text-[10px] text-slate-400 font-mono">{p.code}</p>
                    <p className="font-semibold text-sm line-clamp-2 group-hover:text-blue-600">{p.name}</p>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-blue-600 font-bold text-sm">{p.sell_price.toLocaleString()}đ</p>
                      <span className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded font-medium',
                        p.stock_level <= 0 ? 'bg-red-100 text-red-700' :
                        p.stock_level <= 5 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'
                      )}>
                        {p.stock_level <= 0 ? 'Hết hàng' : `Tồn: ${p.stock_level}`}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-300">
              <Search className="h-16 w-16 mb-4 opacity-20" />
              <p className="font-medium text-lg opacity-50">Tìm hàng hóa để thêm vào đơn</p>
              <p className="text-sm opacity-30 mt-1">Nhập tên, mã hoặc nhóm hàng</p>
            </div>
          )}
        </main>

        {/* Right sidebar */}
        <aside className="w-[380px] bg-white border-l flex flex-col shrink-0">
          {/* Customer */}
          <div className="p-4 border-b space-y-3">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-slate-400" />
              <div className="flex-1">
                <Select value={activeTab.customerId} onValueChange={v => update({ customerId: v })}>
                  <SelectTrigger className="border-none shadow-none p-0 h-auto text-sm">
                    <SelectValue placeholder="Chọn khách hàng (F4)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Khách lẻ</SelectItem>
                    {customers.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} {c.phone ? `- ${c.phone}` : ''}
                        {c.current_debt > 0 ? ` 🔴 Nợ: ${c.current_debt.toLocaleString()}đ` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Dialog open={isCustomerDialogOpen} onOpenChange={setIsCustomerDialogOpen}>
                <DialogTrigger render={
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-600">
                    <Plus className="h-4 w-4" />
                  </Button>
                } />
                <DialogContent className="sm:max-w-[400px]">
                  <DialogHeader><DialogTitle>Thêm khách hàng nhanh</DialogTitle></DialogHeader>
                  <div className="grid gap-3 py-2">
                    <div className="grid gap-1.5"><Label>Tên *</Label>
                      <Input value={newCustomer.name} onChange={e => setNewCustomer(p => ({ ...p, name: e.target.value }))} /></div>
                    <div className="grid gap-1.5"><Label>Số điện thoại</Label>
                      <Input value={newCustomer.phone} onChange={e => setNewCustomer(p => ({ ...p, phone: e.target.value }))} /></div>
                    <div className="grid gap-1.5"><Label>Địa chỉ</Label>
                      <Input value={newCustomer.address} onChange={e => setNewCustomer(p => ({ ...p, address: e.target.value }))} /></div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsCustomerDialogOpen(false)}>Hủy</Button>
                    <Button onClick={quickAddCustomer} className="bg-blue-600">Lưu & Chọn</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            {selectedCustomer && selectedCustomer.current_debt > 0 && (
              <div className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                Khách đang nợ: <strong>{selectedCustomer.current_debt.toLocaleString()}đ</strong>
              </div>
            )}
          </div>

          {/* Cart */}
          <div className="flex-1 overflow-y-auto divide-y">
            {activeTab.cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 p-8">
                <ShoppingCart className="h-14 w-14 opacity-20 mb-3" />
                <p className="text-sm">Chưa có sản phẩm nào</p>
              </div>
            ) : activeTab.cart.map(item => (
              <div key={item.id} className="p-3.5 group hover:bg-slate-50">
                <div className="flex justify-between items-start mb-2.5">
                  <p className="text-sm font-semibold line-clamp-1 flex-1 pr-2">{item.name}</p>
                  <button onClick={() => removeFromCart(item.id)}
                    className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center border rounded-lg overflow-hidden">
                    <button onClick={() => updateQty(item.id, -1)} className="px-2.5 py-1 hover:bg-slate-100 text-slate-500">
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="px-3 py-1 text-sm font-bold border-x min-w-[36px] text-center">{item.quantity}</span>
                    <button onClick={() => updateQty(item.id, 1)} className="px-2.5 py-1 hover:bg-slate-100 text-slate-500">
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-blue-600">{(item.sell_price * item.quantity).toLocaleString()}đ</p>
                    <p className="text-xs text-slate-400">{item.sell_price.toLocaleString()}đ/1</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="p-4 bg-slate-50 border-t space-y-3">
            <div className="flex justify-between text-sm text-slate-600">
              <span>Tổng hàng ({activeTab.cart.length} loại)</span>
              <span className="font-bold text-slate-900">{subtotal.toLocaleString()}đ</span>
            </div>
            <div className="flex justify-between items-center text-sm text-slate-600">
              <span>Giảm giá</span>
              <div className="flex items-center gap-1">
                <input type="number" min={0}
                  className="w-24 bg-white border rounded-md px-2 py-1 text-right text-sm font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={activeTab.discount}
                  onChange={e => update({ discount: Math.max(0, +e.target.value) })} />
                <span className="text-xs text-slate-400">đ</span>
              </div>
            </div>
            <div className="flex justify-between items-center pt-1.5 border-t">
              <span className="font-bold text-slate-900 uppercase text-sm">Khách trả</span>
              <span className="text-2xl font-black text-blue-600">{totalAmount.toLocaleString()}đ</span>
            </div>

            {/* Payment method */}
            <div className="flex gap-2">
              {(['paid', 'debt'] as const).map(s => (
                <button key={s} onClick={() => update({ paymentStatus: s })}
                  className={cn(
                    'flex-1 py-2 rounded-lg text-xs font-bold uppercase transition-all border',
                    activeTab.paymentStatus === s
                      ? s === 'paid' ? 'bg-blue-600 text-white border-blue-600' : 'bg-orange-500 text-white border-orange-500'
                      : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                  )}>
                  {s === 'paid' ? '💵 Tiền mặt' : '📋 Ghi nợ'}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button variant="outline" disabled={processing || !activeTab.cart.length}
                onClick={() => checkout(true)}
                className="h-11 border-blue-200 text-blue-600 hover:bg-blue-50 font-bold">
                <Printer className="h-4 w-4 mr-2" /> In hóa đơn
              </Button>
              <Button disabled={processing || !activeTab.cart.length}
                onClick={() => checkout(false)}
                className="h-11 bg-blue-600 hover:bg-blue-700 font-bold">
                {processing ? (
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : 'Thanh toán'}
              </Button>
            </div>
          </div>
        </aside>
      </div>

      {/* Bottom bar */}
      <div className="h-11 bg-white border-t flex items-center px-6 gap-6 shrink-0">
        {[
          { mode: 'quick', icon: Zap, label: 'Bán nhanh' },
          { mode: 'normal', icon: Store, label: 'Bán thường' },
        ].map(({ mode, icon: Icon, label }) => (
          <button key={mode} onClick={() => update({ saleMode: mode as any })}
            className={cn(
              'flex items-center gap-2 text-sm font-medium h-full border-t-2 transition-all',
              activeTab.saleMode === mode ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            )}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
        <div className="ml-auto text-xs text-slate-400">
          Tổng đơn hôm nay: <strong className="text-slate-600">v1.0 Supabase</strong>
        </div>
      </div>
    </div>
  );
}
