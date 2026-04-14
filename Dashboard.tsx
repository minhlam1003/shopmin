import { useState, useEffect } from 'react';
import { supabase, type Order, type Product, type Customer } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  TrendingUp, Package, Users, AlertTriangle, DollarSign,
  ShoppingCart, ArrowUpRight, ArrowDownRight, Clock
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LineChart, Line, PieChart, Pie, Legend
} from 'recharts';
import { cn } from '@/lib/utils';

export default function Dashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll();

    // Real-time subscriptions
    const ordersChannel = supabase.channel('orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchOrders();
      })
      .subscribe();

    const productsChannel = supabase.channel('products-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
        fetchProducts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(productsChannel);
    };
  }, []);

  const fetchAll = async () => {
    await Promise.all([fetchOrders(), fetchProducts(), fetchCustomers()]);
    setLoading(false);
  };

  const fetchOrders = async () => {
    const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (data) setOrders(data as Order[]);
  };

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*').order('name');
    if (data) setProducts(data as Product[]);
  };

  const fetchCustomers = async () => {
    const { data } = await supabase.from('customers').select('*');
    if (data) setCustomers(data as Customer[]);
  };

  // Stats
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const yesterdayStr = new Date(now.getTime() - 86400000).toISOString().split('T')[0];

  const todayOrders = orders.filter(o => o.created_at.startsWith(todayStr));
  const yesterdayOrders = orders.filter(o => o.created_at.startsWith(yesterdayStr));

  const todayRevenue = todayOrders.filter(o => o.status === 'paid').reduce((s, o) => s + o.total_amount, 0);
  const yesterdayRevenue = yesterdayOrders.filter(o => o.status === 'paid').reduce((s, o) => s + o.total_amount, 0);
  const revenueChange = yesterdayRevenue === 0 ? 100 : Math.round((todayRevenue - yesterdayRevenue) / yesterdayRevenue * 100);

  const totalRevenue = orders.filter(o => o.status === 'paid').reduce((s, o) => s + o.total_amount, 0);
  const totalDebt = customers.reduce((s, c) => s + (c.current_debt || 0), 0);
  const lowStockCount = products.filter(p => p.stock_level <= (p.min_stock || 5)).length;
  const debtOrders = orders.filter(o => o.status === 'debt').length;

  // Chart: last 14 days
  const chartData = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    const dateStr = d.toISOString().split('T')[0];
    const dayOrders = orders.filter(o => o.created_at.startsWith(dateStr) && o.status === 'paid');
    return {
      name: d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
      revenue: dayOrders.reduce((s, o) => s + o.total_amount, 0),
      orders: dayOrders.length,
    };
  });

  // Top products (from all order_details - simplified)
  const recentOrders = orders.slice(0, 5);

  // Payment status pie
  const paidCount = orders.filter(o => o.status === 'paid').length;
  const debtCount = orders.filter(o => o.status === 'debt').length;
  const pieData = [
    { name: 'Đã thanh toán', value: paidCount, color: '#22c55e' },
    { name: 'Ghi nợ', value: debtCount, color: '#ef4444' },
  ];

  const stats = [
    {
      title: 'Doanh thu hôm nay',
      value: `${todayRevenue.toLocaleString()}đ`,
      sub: `${revenueChange >= 0 ? '+' : ''}${revenueChange}% so hôm qua`,
      positive: revenueChange >= 0,
      icon: DollarSign,
      color: 'text-emerald-600', bg: 'bg-emerald-50',
    },
    {
      title: 'Tổng nợ khách',
      value: `${totalDebt.toLocaleString()}đ`,
      sub: `${debtOrders} đơn ghi nợ`,
      positive: false,
      icon: TrendingUp,
      color: 'text-orange-600', bg: 'bg-orange-50',
    },
    {
      title: 'Hàng sắp hết',
      value: lowStockCount,
      sub: `Trong ${products.length} mặt hàng`,
      positive: lowStockCount === 0,
      icon: AlertTriangle,
      color: 'text-red-600', bg: 'bg-red-50',
    },
    {
      title: 'Đơn hàng hôm nay',
      value: todayOrders.length,
      sub: `Tổng ${orders.length} đơn`,
      positive: true,
      icon: ShoppingCart,
      color: 'text-blue-600', bg: 'bg-blue-50',
    },
  ];

  if (loading) {
    return (
      <div className="p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-white rounded-xl border animate-pulse" />
          ))}
        </div>
        <div className="h-80 bg-white rounded-xl border animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Tổng quan</h1>
        <p className="text-slate-500 text-sm mt-1">
          {new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <Card key={i} className="border-0 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className={cn('p-2.5 rounded-xl', stat.bg)}>
                    <Icon className={cn('h-5 w-5', stat.color)} />
                  </div>
                  <span className={cn(
                    'flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full',
                    stat.positive ? 'text-emerald-700 bg-emerald-50' : 'text-red-600 bg-red-50'
                  )}>
                    {stat.positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {stat.sub}
                  </span>
                </div>
                <div className="mt-4">
                  <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                  <p className="text-sm text-slate-500 mt-0.5">{stat.title}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue chart */}
        <Card className="lg:col-span-2 border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Doanh thu 14 ngày qua</CardTitle>
          </CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickFormatter={v => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
                <Tooltip
                  formatter={(v: number) => [`${v.toLocaleString()}đ`, 'Doanh thu']}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }}
                />
                <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={i === chartData.length - 1 ? '#2563eb' : '#dbeafe'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Right column */}
        <div className="space-y-4">
          {/* Pie chart */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-0 pt-4">
              <CardTitle className="text-base font-semibold">Trạng thái đơn hàng</CardTitle>
            </CardHeader>
            <CardContent className="h-[140px] pt-2">
              {orders.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={35} outerRadius={55}
                      dataKey="value" paddingAngle={3}>
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm">Chưa có đơn hàng</div>
              )}
            </CardContent>
          </Card>

          {/* Quick stats */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-slate-600"><Package className="h-4 w-4" /> Tổng mặt hàng</div>
                <span className="font-bold">{products.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-slate-600"><Users className="h-4 w-4" /> Tổng khách hàng</div>
                <span className="font-bold">{customers.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-slate-600"><DollarSign className="h-4 w-4" /> Tổng doanh thu</div>
                <span className="font-bold text-emerald-600">{(totalRevenue / 1000000).toFixed(1)}M</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent orders + Low stock */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent orders */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-slate-400" /> Đơn hàng gần đây
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {recentOrders.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">Chưa có đơn hàng nào</p>
            ) : recentOrders.map(o => (
              <div key={o.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">{o.customer_name}</p>
                  <p className="text-xs text-slate-400 font-mono">{o.order_code}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-blue-600">{o.total_amount.toLocaleString()}đ</p>
                  <span className={cn(
                    'text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                    o.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                  )}>
                    {o.status === 'paid' ? 'Đã TT' : 'Nợ'}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Low stock */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" /> Hàng sắp hết kho
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {products.filter(p => p.stock_level <= (p.min_stock || 5)).length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center italic">Không có hàng sắp hết</p>
            ) : products.filter(p => p.stock_level <= (p.min_stock || 5)).slice(0, 6).map(p => (
              <div key={p.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium truncate max-w-[180px]">{p.name}</p>
                  <p className="text-xs text-slate-400">{p.category}</p>
                </div>
                <span className={cn(
                  'text-xs font-bold px-2 py-0.5 rounded-full',
                  p.stock_level === 0 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                )}>
                  Tồn: {p.stock_level} {p.unit}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
