import { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import {
  LayoutDashboard, Package, Users, ShoppingCart, History,
  Menu, X, Store, Settings as SettingsIcon, LogOut, Loader2,
  ShieldCheck, Bell, ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ThemeProvider } from 'next-themes';
import { supabase, type UserProfile } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';

// Pages
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Customers from './pages/Customers';
import POS from './pages/POS';
import Orders from './pages/Orders';
import Settings from './pages/Settings';
import LoginPage from './pages/Login';

// ─── Auth Context ──────────────────────────────────────────────────────────────
interface AuthContextType {
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  session: null, profile: null, loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({ profile, onSignOut }: { profile: UserProfile; onSignOut: () => void }) {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [storeName, setStoreName] = useState('ShopMin');

  useEffect(() => {
    supabase.from('settings').select('value').eq('key', 'store_name').single()
      .then(({ data }) => { if (data?.value) setStoreName(data.value); });
  }, []);

  const navItems = [
    { name: 'Tổng quan', path: '/', icon: LayoutDashboard, roles: ['admin', 'staff'] },
    { name: 'Bán hàng (POS)', path: '/pos', icon: ShoppingCart, roles: ['admin', 'staff'] },
    { name: 'Hàng hóa', path: '/products', icon: Package, roles: ['admin', 'staff'] },
    { name: 'Khách hàng', path: '/customers', icon: Users, roles: ['admin', 'staff'] },
    { name: 'Giao dịch', path: '/orders', icon: History, roles: ['admin', 'staff'] },
    { name: 'Cài đặt', path: '/settings', icon: SettingsIcon, roles: ['admin'] },
  ];

  const visible = navItems.filter(item => item.roles.includes(profile.role));
  const avatarSrc = profile.avatar_url ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.full_name || profile.email)}&background=3b82f6&color=fff`;

  return (
    <>
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-md border"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-30 bg-black/40 backdrop-blur-sm"
          onClick={() => setIsOpen(false)} />
      )}

      <aside className={cn(
        'fixed inset-y-0 left-0 z-40 w-64 bg-slate-950 text-white flex flex-col transform transition-transform duration-200 ease-in-out lg:translate-x-0',
        isOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-800">
          <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Store className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight truncate">{storeName}</span>
        </div>

        {/* Role badge */}
        <div className="px-6 pt-4 pb-2">
          <span className={cn(
            'inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider',
            profile.role === 'admin'
              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
              : 'bg-slate-700/50 text-slate-400 border border-slate-600/30'
          )}>
            <ShieldCheck className="h-3 w-3" />
            {profile.role === 'admin' ? 'Quản trị viên' : 'Nhân viên'}
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
          {visible.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path} onClick={() => setIsOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 text-sm font-medium',
                  active
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                )}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="px-3 pb-4 pt-3 border-t border-slate-800 space-y-1">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
            <img src={avatarSrc} alt="Avatar"
              className="h-8 w-8 rounded-full object-cover ring-2 ring-slate-700" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate text-white">
                {profile.full_name || 'Người dùng'}
              </p>
              <p className="text-xs text-slate-500 truncate">{profile.email}</p>
            </div>
          </div>
          <button onClick={onSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-all text-sm font-medium">
            <LogOut className="h-4 w-4" />
            Đăng xuất
          </button>
        </div>
      </aside>
    </>
  );
}

// ─── Loading Screen ───────────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
      <div className="h-14 w-14 bg-blue-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-600/40">
        <Store className="h-7 w-7 text-white" />
      </div>
      <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
      <p className="text-slate-500 text-sm">Đang tải...</p>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session) {
        await fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase.from('users').select('*').eq('id', userId).single();
    if (error || !data) {
      // Auto-create profile if missing
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const newProfile: Omit<UserProfile, 'created_at'> = {
          id: user.id,
          email: user.email!,
          full_name: user.user_metadata?.full_name ?? null,
          avatar_url: user.user_metadata?.avatar_url ?? null,
          role: 'staff',
        };
        const { data: inserted } = await supabase.from('users').insert(newProfile).select().single();
        setProfile(inserted as UserProfile);
      }
    } else {
      setProfile(data as UserProfile);
    }
    setLoading(false);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
    toast.success('Đã đăng xuất');
  };

  if (loading) return <LoadingScreen />;

  if (!session || !profile) {
    return (
      <ThemeProvider attribute="class" defaultTheme="light">
        <LoginPage />
        <Toaster position="top-right" />
      </ThemeProvider>
    );
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, signOut }}>
      <ThemeProvider attribute="class" defaultTheme="light">
        <ErrorBoundary>
          <Router>
            <div className="min-h-screen bg-slate-50">
              <Sidebar profile={profile} onSignOut={signOut} />
              <main className="lg:ml-64">
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/products" element={<Products />} />
                  <Route path="/customers" element={<Customers />} />
                  <Route path="/pos" element={<POS />} />
                  <Route path="/orders" element={<Orders />} />
                  <Route path="/settings" element={
                    profile.role === 'admin' ? <Settings /> : <Navigate to="/" replace />
                  } />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </main>
            </div>
            <Toaster position="top-right" />
          </Router>
        </ErrorBoundary>
      </ThemeProvider>
    </AuthContext.Provider>
  );
}
