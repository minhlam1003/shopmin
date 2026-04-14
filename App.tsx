import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
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
  LogIn,
  Loader2,
  Eye,
  EyeOff,
  Mail,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ThemeProvider } from 'next-themes';

// Supabase
import { supabase } from '@/lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

// Pages
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Customers from './pages/Customers';
import POS from './pages/POS';
import Orders from './pages/Orders';
import Settings from './pages/Settings';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type UserRole = 'admin' | 'staff';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  store_name?: string;
}

// ─────────────────────────────────────────────
// Hook: useAuth
// ─────────────────────────────────────────────
function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else setLoading(false);
    });

    // Listen to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        if (session) {
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Profile fetch error:', error);
      // Auto-create profile if missing
      const user = (await supabase.auth.getUser()).data.user;
      if (user) {
        const newProfile: UserProfile = {
          id: user.id,
          email: user.email!,
          full_name: user.user_metadata?.full_name ?? null,
          avatar_url: user.user_metadata?.avatar_url ?? null,
          role: 'staff',
        };
        await supabase.from('users').insert(newProfile);
        setProfile(newProfile);
      }
    } else {
      setProfile(data as UserProfile);
    }
    setLoading(false);
  };

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error;
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    return error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
  };

  return { session, profile, loading, signInWithEmail, signInWithGoogle, signOut };
}

// ─────────────────────────────────────────────
// Login Page
// ─────────────────────────────────────────────
function LoginPage({ onLogin }: { onLogin: (email: string, password: string) => Promise<void>; onGoogle: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onLogin(email, password);
    } catch (err: any) {
      setError(err.message || 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-lg">
            <Store className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">ShopMin</h1>
          <p className="text-slate-400 mt-1 text-sm">Hệ thống quản lý cửa hàng</p>
        </div>

        {/* Card */}
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-xl font-semibold text-white mb-6">Đăng nhập</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@shopmin.com"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Mật khẩu</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-10 py-2.5 text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition flex items-center justify-center gap-2 text-sm mt-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
          </form>

          <div className="mt-4 text-center">
            <p className="text-slate-600 text-xs">Bằng cách đăng nhập, bạn đồng ý với điều khoản sử dụng.</p>
          </div>
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          © {new Date().getFullYear()} ShopMin · Powered by Supabase
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Sidebar
// ─────────────────────────────────────────────
function Sidebar({ profile, onSignOut }: { profile: UserProfile; onSignOut: () => void }) {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [storeName, setStoreName] = useState('ShopMin');

  useEffect(() => {
    // Fetch store name from Supabase
    supabase
      .from('settings')
      .select('value')
      .eq('key', 'store_name')
      .single()
      .then(({ data }) => {
        if (data?.value) setStoreName(data.value);
      });
  }, []);

  const navItems = [
    { name: 'Tổng quan', path: '/', icon: LayoutDashboard, roles: ['admin', 'staff'] },
    { name: 'Bán hàng (POS)', path: '/pos', icon: ShoppingCart, roles: ['admin', 'staff'] },
    { name: 'Hàng hóa', path: '/products', icon: Package, roles: ['admin', 'staff'] },
    { name: 'Khách hàng', path: '/customers', icon: Users, roles: ['admin', 'staff'] },
    { name: 'Giao dịch', path: '/orders', icon: History, roles: ['admin', 'staff'] },
    { name: 'Cài đặt', path: '/settings', icon: SettingsIcon, roles: ['admin'] },
  ];

  const visibleItems = navItems.filter((item) => item.roles.includes(profile.role));

  const avatarSrc =
    profile.avatar_url ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.full_name || profile.email)}&background=3b82f6&color=fff`;

  return (
    <>
      {/* Mobile toggle */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-md shadow-md"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 z-30 bg-black/50"
          onClick={() => setIsOpen(false)}
        />
      )}

      <div
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 text-white transform transition-transform duration-200 ease-in-out lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
          <Store className="h-8 w-8 text-blue-400 flex-shrink-0" />
          <span className="text-xl font-bold tracking-tight truncate">{storeName}</span>
        </div>

        {/* Role badge */}
        <div className="px-6 py-2">
          <span className={cn(
            'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium',
            profile.role === 'admin'
              ? 'bg-blue-500/20 text-blue-400'
              : 'bg-slate-700 text-slate-400'
          )}>
            <ShieldCheck className="h-3 w-3" />
            {profile.role === 'admin' ? 'Quản trị viên' : 'Nhân viên'}
          </span>
        </div>

        {/* Nav */}
        <nav className="mt-2 px-4 space-y-1">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                  active
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                )}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                <span className="font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="absolute bottom-0 w-full p-4 border-t border-slate-800 bg-slate-900">
          <div className="flex items-center gap-3 px-2 py-2 mb-2">
            <img
              src={avatarSrc}
              alt="Avatar"
              className="h-9 w-9 rounded-full object-cover border border-slate-700"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{profile.full_name || 'Người dùng'}</p>
              <p className="text-xs text-slate-500 truncate">{profile.email}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start text-slate-400 hover:text-white hover:bg-slate-800 text-sm"
            onClick={onSignOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Đăng xuất
          </Button>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────
// Loading Screen
// ─────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4">
      <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-2">
        <Store className="h-8 w-8 text-white" />
      </div>
      <Loader2 className="h-6 w-6 text-blue-400 animate-spin" />
      <p className="text-slate-500 text-sm">Đang tải...</p>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main App
// ─────────────────────────────────────────────
export default function App() {
  const { session, profile, loading, signInWithEmail, signInWithGoogle, signOut } = useAuth();

  const handleLogin = async (email: string, password: string) => {
    const error = await signInWithEmail(email, password);
    if (error) throw error;
    toast.success('Đăng nhập thành công!');
  };

  const handleSignOut = async () => {
    await signOut();
    toast.success('Đã đăng xuất');
  };

  if (loading) return <LoadingScreen />;

  if (!session || !profile) {
    return (
      <ThemeProvider attribute="class" defaultTheme="light">
        <LoginPage onLogin={handleLogin} onGoogle={signInWithGoogle} />
        <Toaster position="top-right" />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider attribute="class" defaultTheme="light">
      <ErrorBoundary>
        <Router>
          <div className="min-h-screen bg-slate-50">
            <Sidebar profile={profile} onSignOut={handleSignOut} />
            <main className="lg:ml-64 p-4 lg:p-8">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/products" element={<Products />} />
                <Route path="/customers" element={<Customers />} />
                <Route path="/pos" element={<POS />} />
                <Route path="/orders" element={<Orders />} />
                <Route
                  path="/settings"
                  element={
                    profile.role === 'admin' ? <Settings /> : <Navigate to="/" replace />
                  }
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
          <Toaster position="top-right" />
        </Router>
      </ErrorBoundary>
    </ThemeProvider>
  );
}
