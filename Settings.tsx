import { useState, useEffect } from 'react';
import { supabase, type StoreSettings, defaultStoreSettings } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Settings as SettingsIcon, Store, User, Printer, Save, UserPlus, Trash2, ShieldCheck, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useAuth } from '@/App';

interface AppUser {
  id: string; email: string; full_name: string | null; role: 'admin' | 'staff'; created_at?: string;
}

export default function Settings() {
  const { profile } = useAuth();
  const [settings, setSettings] = useState<StoreSettings>(defaultStoreSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [newUser, setNewUser] = useState({ email: '', full_name: '', role: 'staff' as const });

  useEffect(() => {
    fetchSettings();
    fetchUsers();

    const settingsSub = supabase.channel('settings-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, fetchSettings)
      .subscribe();
    return () => { supabase.removeChannel(settingsSub); };
  }, []);

  const fetchSettings = async () => {
    const { data } = await supabase.from('settings').select('*');
    if (data) {
      const s: any = { ...defaultStoreSettings };
      data.forEach((row: any) => { if (row.key in s) s[row.key] = row.value; });
      setSettings(s);
    }
  };

  const fetchUsers = async () => {
    const { data } = await supabase.from('users').select('id, email, full_name, role, created_at').order('email');
    if (data) setUsers(data as AppUser[]);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const upserts = Object.entries(settings)
        .filter(([k]) => k !== 'updated_at')
        .map(([key, value]) => ({ key, value: String(value), updated_at: new Date().toISOString() }));
      const { error } = await supabase.from('settings').upsert(upserts, { onConflict: 'key' });
      if (error) throw error;
      toast.success('Đã lưu cài đặt');
    } catch (e: any) { toast.error(e.message); }
    finally { setIsSaving(false); }
  };

  const handleAddUser = async () => {
    if (!newUser.email) return toast.error('Vui lòng nhập email');
    // In Supabase, user records are managed through auth.users
    // We can only manage the profile for users who have already signed up
    // This UI will update/insert into the users table
    const { error } = await supabase.from('users').upsert({
      id: '00000000-0000-0000-0000-000000000000', // placeholder - needs real user ID
      email: newUser.email,
      full_name: newUser.full_name,
      role: newUser.role,
    }, { onConflict: 'email' });
    // Better: use admin API or just update role
    toast.info('Yêu cầu người dùng tự đăng ký, sau đó bạn cập nhật role của họ bên dưới.');
    setNewUser({ email: '', full_name: '', role: 'staff' });
  };

  const updateUserRole = async (id: string, role: 'admin' | 'staff') => {
    const { error } = await supabase.from('users').update({ role }).eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Đã cập nhật quyền'); fetchUsers(); }
  };

  const set = (k: keyof StoreSettings, v: string) => setSettings(prev => ({ ...prev, [k]: v }));

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg"><SettingsIcon className="h-5 w-5 text-blue-600" /></div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Cài đặt hệ thống</h1>
            <p className="text-sm text-slate-500">Quản lý thông tin cửa hàng và phân quyền</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700">
          <Save className="h-4 w-4 mr-2" /> {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Store Info */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Store className="h-4 w-4 text-blue-600" /> Thông tin cửa hàng
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: 'Tên cửa hàng', key: 'store_name' as const, placeholder: 'ShopMin' },
              { label: 'Số điện thoại', key: 'phone' as const, placeholder: '0xxx xxx xxx' },
              { label: 'Địa chỉ', key: 'address' as const, placeholder: 'Số nhà, phố, phường...' },
              { label: 'Website', key: 'website' as const, placeholder: 'https://...' },
              { label: 'URL Logo', key: 'logo_url' as const, placeholder: 'https://...' },
            ].map(({ label, key, placeholder }) => (
              <div key={key} className="grid gap-1.5">
                <Label className="text-xs">{label}</Label>
                <Input value={settings[key] || ''} onChange={e => set(key, e.target.value)} placeholder={placeholder} />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Admin & Invoice */}
        <div className="space-y-6">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Printer className="h-4 w-4 text-blue-600" /> Hóa đơn
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: 'Tiêu đề hóa đơn', key: 'invoice_header' as const },
                { label: 'Lời chào cuối', key: 'invoice_footer' as const },
              ].map(({ label, key }) => (
                <div key={key} className="grid gap-1.5">
                  <Label className="text-xs">{label}</Label>
                  <Input value={settings[key] || ''} onChange={e => set(key, e.target.value)} />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-blue-600" /> Thông tin thanh toán
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: 'Tên ngân hàng', key: 'bank_name' as const, placeholder: 'Vietcombank' },
                { label: 'Số tài khoản', key: 'bank_account' as const },
                { label: 'Chủ tài khoản', key: 'bank_owner' as const },
              ].map(({ label, key, placeholder }) => (
                <div key={key} className="grid gap-1.5">
                  <Label className="text-xs">{label}</Label>
                  <Input value={settings[key] || ''} onChange={e => set(key, e.target.value)} placeholder={placeholder} />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* User Management */}
        <Card className="md:col-span-2 border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-blue-600" /> Phân quyền người dùng
            </CardTitle>
            <CardDescription>
              Người dùng cần tự đăng ký trước. Sau đó bạn có thể thay đổi role của họ tại đây.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Người dùng</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Vai trò</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs">
                            {(u.full_name || u.email).charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium">{u.full_name || '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{u.email}</td>
                      <td className="px-4 py-3">
                        {u.id === profile?.id ? (
                          <span className={cn(
                            'px-2 py-0.5 rounded-full text-xs font-bold',
                            u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                          )}>
                            {u.role === 'admin' ? 'Quản trị' : 'Nhân viên'}
                          </span>
                        ) : (
                          <Select value={u.role} onValueChange={v => updateUserRole(u.id, v as any)}>
                            <SelectTrigger className="h-7 w-32 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="staff">Nhân viên</SelectItem>
                              <SelectItem value="admin">Quản trị viên</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {u.id !== profile?.id && (
                          <span className="text-xs text-slate-400">
                            {new Date(u.created_at || '').toLocaleDateString('vi-VN')}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400 italic">
                      Chưa có người dùng nào
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-400 mt-3 bg-blue-50 rounded-lg p-3">
              💡 <strong>Lưu ý:</strong> Để nâng quyền admin cho tài khoản đầu tiên, chạy lệnh SQL trong Supabase Dashboard:
              <code className="block mt-1 bg-white px-2 py-1 rounded font-mono">
                UPDATE public.users SET role = 'admin' WHERE email = 'your@email.com';
              </code>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
