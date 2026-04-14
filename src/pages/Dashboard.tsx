import { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '@/firebase';
import { collection, onSnapshot, query, where, Timestamp } from 'firebase/firestore';
import { Order, Product, Customer } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  TrendingUp, 
  Package, 
  Users, 
  AlertTriangle,
  DollarSign,
  ShoppingCart
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { cn } from '@/lib/utils';

export default function Dashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    const unsubOrders = onSnapshot(collection(db, 'orders'), (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'orders'));

    const unsubProds = onSnapshot(collection(db, 'products'), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'products'));

    const unsubCusts = onSnapshot(collection(db, 'customers'), (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'customers'));

    return () => {
      unsubOrders();
      unsubProds();
      unsubCusts();
    };
  }, []);

  // Stats
  const totalRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
  const totalDebt = customers.reduce((sum, c) => sum + (c.currentDebt || 0), 0);
  const lowStockCount = products.filter(p => p.stockLevel <= 5).length;
  
  // Chart data (last 7 days)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  }).reverse();

  const chartData = last7Days.map(dateStr => {
    const dayOrders = orders.filter(o => {
      const orderDate = o.createdAt.toDate().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
      return orderDate === dateStr;
    });
    return {
      name: dateStr,
      revenue: dayOrders.reduce((sum, o) => sum + o.totalAmount, 0)
    };
  });

  const stats = [
    { 
      title: 'Tổng doanh thu', 
      value: `${totalRevenue.toLocaleString()}đ`, 
      icon: DollarSign, 
      color: 'text-green-600',
      bg: 'bg-green-100'
    },
    { 
      title: 'Tổng nợ khách', 
      value: `${totalDebt.toLocaleString()}đ`, 
      icon: TrendingUp, 
      color: 'text-orange-600',
      bg: 'bg-orange-100'
    },
    { 
      title: 'Hàng sắp hết', 
      value: lowStockCount, 
      icon: AlertTriangle, 
      color: 'text-red-600',
      bg: 'bg-red-100'
    },
    { 
      title: 'Tổng đơn hàng', 
      value: orders.length, 
      icon: ShoppingCart, 
      color: 'text-blue-600',
      bg: 'bg-blue-100'
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Tổng quan</h1>
        <p className="text-slate-500">Chào mừng bạn trở lại! Đây là tình hình kinh doanh của bạn.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <Card key={i}>
              <CardContent className="p-6 flex items-center gap-4">
                <div className={cn("p-3 rounded-xl", stat.bg)}>
                  <Icon className={cn("h-6 w-6", stat.color)} />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">{stat.title}</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Doanh thu 7 ngày qua</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={(v) => `${(v/1000000).toFixed(1)}M`} />
                <Tooltip 
                  formatter={(value: number) => [`${value.toLocaleString()}đ`, 'Doanh thu']}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === chartData.length - 1 ? '#2563eb' : '#94a3b8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Thông tin nhanh</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Package className="h-5 w-5 text-slate-400" />
                <span className="text-sm font-medium">Tổng mặt hàng</span>
              </div>
              <span className="font-bold">{products.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-slate-400" />
                <span className="text-sm font-medium">Tổng khách hàng</span>
              </div>
              <span className="font-bold">{customers.length}</span>
            </div>
            <div className="pt-4 border-t">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Hàng sắp hết</p>
              <div className="space-y-3">
                {products.filter(p => p.stockLevel <= 5).slice(0, 5).map(p => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <span className="truncate flex-1 mr-2">{p.name}</span>
                    <span className="text-red-600 font-bold">{p.stockLevel}</span>
                  </div>
                ))}
                {lowStockCount === 0 && <p className="text-sm text-slate-400 italic">Không có hàng sắp hết</p>}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

