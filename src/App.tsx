import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { User, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  ShoppingCart, 
  History, 
  Menu,
  X,
  Store,
  Settings as SettingsIcon,
  LogOut,
  LogIn
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { doc, onSnapshot, query, collection, where } from 'firebase/firestore';
import { db, auth, googleProvider } from '@/firebase';
import { Button } from '@/components/ui/button';

// Pages
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Customers from './pages/Customers';
import POS from './pages/POS';
import Orders from './pages/Orders';
import Settings from './pages/Settings';

import { ThemeProvider } from 'next-themes';

function Sidebar({ user, role }: { user: User, role: string | null }) {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [storeName, setStoreName] = useState('ANVIỆT 262');

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'store_config'), (docSnap) => {
      if (docSnap.exists()) {
        setStoreName(docSnap.data().storeName || 'ANVIỆT 262');
      }
    });
    return () => unsub();
  }, []);

  const navItems = [
    { name: 'Tổng quan', path: '/', icon: LayoutDashboard },
    { name: 'Bán hàng (POS)', path: '/pos', icon: ShoppingCart },
    { name: 'Hàng hóa', path: '/products', icon: Package },
    { name: 'Khách hàng', path: '/customers', icon: Users },
    { name: 'Giao dịch', path: '/orders', icon: History },
    { name: 'Cài đặt', path: '/settings', icon: SettingsIcon, adminOnly: true },
  ];

  const handleLogout = () => {
    signOut(auth);
  };

  return (
    <>
      <button 
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-md shadow-md"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X /> : <Menu />}
      </button>

      <div className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 text-white transform transition-transform duration-200 ease-in-out lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
          <Store className="h-8 w-8 text-blue-400" />
          <span className="text-xl font-bold tracking-tight">{storeName}</span>
        </div>

        <nav className="mt-6 px-4 space-y-1">
            {navItems.filter(item => !item.adminOnly || role === 'admin').map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                    location.pathname === item.path 
                      ? "bg-blue-600 text-white" 
                      : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{item.name}</span>
                </Link>
              );
            })}
        </nav>

        <div className="absolute bottom-0 w-full p-4 border-t border-slate-800 bg-slate-900">
          <div className="flex items-center gap-3 px-4 py-3 mb-2">
            <img 
              src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
              alt="Avatar" 
              className="h-8 w-8 rounded-full"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.displayName}</p>
              <p className="text-xs text-slate-500 truncate">{user.email}</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            className="w-full justify-start text-slate-400 hover:text-white hover:bg-slate-800"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Đăng xuất
          </Button>
        </div>
      </div>
    </>
  );
}

export default function App() {
  // Mock user for UI development
  const [user] = useState<any>({
    displayName: 'Admin User',
    email: 'admin@example.com',
    photoURL: null
  });
  const [userRole] = useState<'admin' | 'staff' | null>('admin');

  return (
    <ThemeProvider attribute="class" defaultTheme="light">
      <ErrorBoundary>
        <Router>
          <div className="min-h-screen bg-slate-50">
            <Sidebar user={user} role={userRole} />
            <main className="lg:ml-64 p-4 lg:p-8">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/products" element={<Products />} />
                <Route path="/customers" element={<Customers />} />
                <Route path="/pos" element={<POS />} />
                <Route path="/orders" element={<Orders />} />
                <Route 
                  path="/settings" 
                  element={userRole === 'admin' ? <Settings /> : <Navigate to="/" />} 
                />
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </main>
          </div>
          <Toaster position="top-right" />
        </Router>
      </ErrorBoundary>
    </ThemeProvider>
  );
}
