# ShopMin v2.0 — Supabase Edition

Hệ thống quản lý bán hàng được nâng cấp từ Firebase sang **Supabase**.

---

## 🚀 Hướng dẫn cài đặt

### 1. Tạo project Supabase

1. Đăng ký tại [supabase.com](https://supabase.com)
2. Tạo project mới
3. Vào **Settings → API** để lấy:
   - `Project URL`
   - `anon/public key`

### 2. Chạy SQL Migration

1. Mở **Supabase Dashboard → SQL Editor**
2. Copy toàn bộ nội dung file `supabase_migration_v2.sql`
3. Paste và nhấn **Run**

### 3. Cấu hình biến môi trường

Tạo file `.env.local` tại thư mục gốc:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

### 4. Kích hoạt Google Auth (tùy chọn)

1. Supabase Dashboard → **Authentication → Providers**
2. Bật **Google**
3. Thêm Client ID và Secret từ Google Cloud Console
4. Thêm Redirect URL vào Google Console: `https://YOUR_PROJECT.supabase.co/auth/v1/callback`

### 5. Cài dependencies và chạy

```bash
npm install
npm run dev
```

### 6. Set admin role

Sau khi tạo tài khoản đầu tiên, vào SQL Editor và chạy:

```sql
UPDATE public.users SET role = 'admin' WHERE email = 'your@email.com';
```

---

## ✨ Những gì đã được nâng cấp

### 🔄 Migration: Firebase → Supabase
- **Auth**: Email/Password + Google OAuth thay cho Firebase Auth
- **Database**: PostgreSQL (Supabase) thay cho Firestore
- **Real-time**: Supabase Realtime subscriptions
- **RLS**: Row Level Security thay cho Firestore Rules
- **Transactions**: Supabase sequential operations (reliable)

### 🆕 Tính năng mới
- **Login/Signup** trong một màn hình, toggle giữa hai mode
- **Dashboard** nâng cao: chart 14 ngày, pie chart trạng thái, low stock realtime
- **Phân quyền** trong app: admin có thể đổi role users trực tiếp
- **Bộ lọc Orders**: lọc theo trạng thái (paid/debt)
- **Thống kê Customers**: tổng chi tiêu, số đơn, nợ
- **Products**: phân quyền rõ ràng (staff chỉ xem, admin mới sửa/xóa)
- **TypeScript** types hoàn chỉnh cho tất cả entities

### 🎨 UI/UX Improvements
- Sidebar gọn hơn, role badge nổi bật hơn
- Skeleton loading trên tất cả trang
- Summary cards trên Orders và Customers
- Avatar tự động từ tên người dùng
- Toast notifications cụ thể hơn

### 🏗️ Kiến trúc tốt hơn
- `AuthContext` - global auth state
- `useAuth()` hook trên mọi trang
- Supabase Realtime subscriptions thay polling
- SQL Views cho báo cáo (`daily_revenue`, `product_sales_summary`)
- Trigger tự động tạo profile khi user đăng ký

---

## 📁 Cấu trúc file quan trọng

```
src/
├── lib/
│   └── supabase.ts          # Supabase client + TypeScript types
├── pages/
│   ├── Login.tsx            # Auth page (login + signup)
│   ├── Dashboard.tsx        # Analytics + real-time stats
│   ├── Products.tsx         # CRUD với phân quyền
│   ├── Customers.tsx        # CRUD + debt tracking
│   ├── POS.tsx              # Point of Sale
│   ├── Orders.tsx           # Order history + filters
│   └── Settings.tsx         # Store config + user roles
└── App.tsx                  # Auth provider + routing
supabase_migration_v2.sql    # Toàn bộ schema + RLS + triggers
```

---

## ⚠️ Lưu ý bảo mật

- **KHÔNG** commit file `.env.local` lên git
- Thêm `.env.local` vào `.gitignore`
- `anon key` là public key, an toàn để dùng trong frontend với RLS
- RLS đã được cấu hình: chỉ authenticated users mới truy cập được data
