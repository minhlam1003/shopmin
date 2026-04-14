import { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '@/firebase';
import { doc, onSnapshot, setDoc, Timestamp, collection, query, orderBy, deleteDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Settings as SettingsIcon, Store, User, Printer, Save, Globe, Phone, MapPin, UserPlus, Trash2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface StoreSettings {
  storeName: string;
  phone: string;
  address: string;
  website: string;
  logoUrl: string;
  invoiceHeader: string;
  invoiceFooter: string;
  adminName: string;
  adminEmail: string;
  bankName: string;
  bankAccount: string;
  bankOwner: string;
}

interface AppUser {
  id?: string;
  email: string;
  displayName: string;
  role: 'admin' | 'staff';
  createdAt: Timestamp;
}

const defaultSettings: StoreSettings = {
  storeName: 'ANVIỆT 262',
  phone: '0367633716',
  address: 'Hà Nội, Việt Nam',
  website: 'anviet262.vn',
  logoUrl: '',
  invoiceHeader: 'HÓA ĐƠN BÁN HÀNG',
  invoiceFooter: 'Cảm ơn và hẹn gặp lại!',
  adminName: 'Quản trị viên',
  adminEmail: 'admin@anviet262.vn',
  bankName: '',
  bankAccount: '',
  bankOwner: '',
};

export default function Settings() {
  const [settings, setSettings] = useState<StoreSettings>(defaultSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [newUser, setNewUser] = useState({ email: '', displayName: '', role: 'staff' as const });

  useEffect(() => {
    const unsubSettings = onSnapshot(doc(db, 'settings', 'store_config'), (docSnap) => {
      if (docSnap.exists()) {
        setSettings({ ...defaultSettings, ...docSnap.data() } as StoreSettings);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/store_config');
    });

    const unsubUsers = onSnapshot(query(collection(db, 'users'), orderBy('email')), (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return () => {
      unsubSettings();
      unsubUsers();
    };
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'store_config'), {
        ...settings,
        updatedAt: Timestamp.now()
      });
      toast.success('Đã lưu cài đặt hệ thống');
    } catch (error) {
      toast.error('Lỗi khi lưu cài đặt');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddUser = async () => {
    if (!newUser.email) {
      toast.error('Vui lòng nhập email');
      return;
    }
    try {
      // Use email as document ID for easier lookup in security rules
      // We need to sanitize the email to be a valid doc ID (replace . with _)
      const docId = newUser.email.replace(/\./g, '_');
      const userRef = doc(db, 'users', docId);
      await setDoc(userRef, {
        ...newUser,
        createdAt: Timestamp.now()
      });
      toast.success('Đã thêm người dùng mới');
      setNewUser({ email: '', displayName: '', role: 'staff' });
    } catch (error) {
      toast.error('Lỗi khi thêm người dùng. Chỉ Admin mới có quyền này.');
    }
  };

  const handleDeleteUser = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'users', id));
      toast.success('Đã xóa người dùng');
    } catch (error) {
      toast.error('Lỗi khi xóa người dùng');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <SettingsIcon className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Cài đặt hệ thống</h1>
            <p className="text-sm text-slate-500">Quản lý thông tin cửa hàng và phân quyền người dùng</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700">
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* User Management */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-blue-600" />
              Quản lý phân quyền
            </CardTitle>
            <CardDescription>Cấp quyền cho nhân viên truy cập hệ thống bằng Email Google</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-slate-50 p-4 rounded-lg border">
              <div className="grid gap-2">
                <Label>Email Google</Label>
                <Input 
                  placeholder="nhanvien@gmail.com" 
                  value={newUser.email}
                  onChange={e => setNewUser({...newUser, email: e.target.value})}
                />
              </div>
              <div className="grid gap-2">
                <Label>Tên nhân viên</Label>
                <Input 
                  placeholder="Nguyễn Văn A" 
                  value={newUser.displayName}
                  onChange={e => setNewUser({...newUser, displayName: e.target.value})}
                />
              </div>
              <div className="grid gap-2">
                <Label>Vai trò</Label>
                <Select 
                  value={newUser.role} 
                  onValueChange={(v: any) => setNewUser({...newUser, role: v})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">Nhân viên (Bán hàng)</SelectItem>
                    <SelectItem value="admin">Quản trị viên (Toàn quyền)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAddUser} className="bg-blue-600">
                <UserPlus className="mr-2 h-4 w-4" /> Thêm mới
              </Button>
            </div>

            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Người dùng</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Email</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Vai trò</th>
                    <th className="px-4 py-3 text-right font-medium text-slate-500">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {users.map(u => (
                    <tr key={u.id}>
                      <td className="px-4 py-3 font-medium">{u.displayName || 'Chưa đặt tên'}</td>
                      <td className="px-4 py-3 text-slate-500">{u.email}</td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                          u.role === 'admin' ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                        )}>
                          {u.role === 'admin' ? 'Quản trị' : 'Nhân viên'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDeleteUser(u.id!)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-400 italic">
                        Chưa có nhân viên nào được cấp quyền
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        {/* Store Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5 text-blue-600" />
              Thông tin cửa hàng
            </CardTitle>
            <CardDescription>Thông tin này sẽ hiển thị trên hóa đơn và trang chủ</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="storeName">Tên cửa hàng</Label>
              <Input 
                id="storeName" 
                value={settings.storeName} 
                onChange={e => setSettings({...settings, storeName: e.target.value})} 
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Số điện thoại</Label>
              <Input 
                id="phone" 
                value={settings.phone} 
                onChange={e => setSettings({...settings, phone: e.target.value})} 
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="address">Địa chỉ</Label>
              <Input 
                id="address" 
                value={settings.address} 
                onChange={e => setSettings({...settings, address: e.target.value})} 
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="website">Website</Label>
              <Input 
                id="website" 
                value={settings.website} 
                onChange={e => setSettings({...settings, website: e.target.value})} 
              />
            </div>
          </CardContent>
        </Card>

        {/* Admin Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-blue-600" />
              Tài khoản quản trị
            </CardTitle>
            <CardDescription>Thông tin người quản lý hệ thống</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="adminName">Tên hiển thị</Label>
              <Input 
                id="adminName" 
                value={settings.adminName} 
                onChange={e => setSettings({...settings, adminName: e.target.value})} 
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="adminEmail">Email liên hệ</Label>
              <Input 
                id="adminEmail" 
                value={settings.adminEmail} 
                onChange={e => setSettings({...settings, adminEmail: e.target.value})} 
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="logoUrl">URL Logo (Ảnh đại diện)</Label>
              <Input 
                id="logoUrl" 
                value={settings.logoUrl} 
                onChange={e => setSettings({...settings, logoUrl: e.target.value})} 
                placeholder="https://..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Invoice Config */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5 text-blue-600" />
              Cấu hình hóa đơn & Thanh toán
            </CardTitle>
            <CardDescription>Tùy chỉnh nội dung in ấn và thông tin chuyển khoản</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="invoiceHeader">Tiêu đề hóa đơn</Label>
                  <Input 
                    id="invoiceHeader" 
                    value={settings.invoiceHeader} 
                    onChange={e => setSettings({...settings, invoiceHeader: e.target.value})} 
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="invoiceFooter">Lời chào cuối hóa đơn</Label>
                  <Input 
                    id="invoiceFooter" 
                    value={settings.invoiceFooter} 
                    onChange={e => setSettings({...settings, invoiceFooter: e.target.value})} 
                  />
                </div>
              </div>
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="bankName">Tên ngân hàng</Label>
                  <Input 
                    id="bankName" 
                    value={settings.bankName} 
                    onChange={e => setSettings({...settings, bankName: e.target.value})} 
                    placeholder="Ví dụ: Vietcombank"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="bankAccount">Số tài khoản</Label>
                    <Input 
                      id="bankAccount" 
                      value={settings.bankAccount} 
                      onChange={e => setSettings({...settings, bankAccount: e.target.value})} 
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="bankOwner">Chủ tài khoản</Label>
                    <Input 
                      id="bankOwner" 
                      value={settings.bankOwner} 
                      onChange={e => setSettings({...settings, bankOwner: e.target.value})} 
                    />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
