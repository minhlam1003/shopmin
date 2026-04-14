-- ============================================================
-- ShopMin · Supabase SQL Migration
-- Chạy toàn bộ file này trong Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Bảng users (profile mở rộng từ auth.users)
create table if not exists public.users (
  id          uuid references auth.users on delete cascade primary key,
  email       text unique not null,
  full_name   text,
  avatar_url  text,
  role        text not null default 'staff' check (role in ('admin', 'staff')),
  phone       text,
  created_at  timestamptz default now()
);

-- 2. Bảng products
create table if not exists public.products (
  id          uuid default gen_random_uuid() primary key,
  name        text not null,
  price       numeric(12,0) not null default 0,
  cost_price  numeric(12,0) default 0,
  description text,
  image_url   text,
  category    text,
  unit        text default 'cái',
  stock       integer not null default 0,
  barcode     text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- 3. Bảng customers
create table if not exists public.customers (
  id           uuid default gen_random_uuid() primary key,
  name         text not null,
  phone        text,
  email        text,
  address      text,
  total_spent  numeric(12,0) default 0,
  total_orders integer default 0,
  created_at   timestamptz default now()
);

-- 4. Bảng orders
create table if not exists public.orders (
  id              uuid default gen_random_uuid() primary key,
  customer_id     uuid references public.customers(id) on delete set null,
  user_id         uuid references public.users(id) on delete set null,
  items           jsonb not null default '[]',
  subtotal        numeric(12,0) not null default 0,
  discount        numeric(12,0) default 0,
  total           numeric(12,0) not null default 0,
  payment_method  text not null default 'cash'
    check (payment_method in ('cash', 'transfer', 'card')),
  status          text not null default 'completed'
    check (status in ('completed', 'pending', 'cancelled', 'refunded')),
  note            text,
  created_at      timestamptz default now()
);

-- 5. Bảng settings (key-value)
create table if not exists public.settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz default now()
);

-- Dữ liệu mặc định settings
insert into public.settings (key, value) values
  ('store_name', 'ShopMin'),
  ('store_address', ''),
  ('store_phone', ''),
  ('currency', 'VND'),
  ('tax_rate', '0')
on conflict (key) do nothing;

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.users     enable row level security;
alter table public.products  enable row level security;
alter table public.customers enable row level security;
alter table public.orders    enable row level security;
alter table public.settings  enable row level security;

-- Users: chỉ xem/sửa bản thân
create policy "users_select_own" on public.users
  for select using (auth.uid() = id);

create policy "users_update_own" on public.users
  for update using (auth.uid() = id);

-- Products: mọi user đã login đều xem được
create policy "products_select_all" on public.products
  for select using (auth.role() = 'authenticated');

-- Products: chỉ admin mới được tạo/sửa/xóa
create policy "products_insert_admin" on public.products
  for insert with check (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

create policy "products_update_admin" on public.products
  for update using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

create policy "products_delete_admin" on public.products
  for delete using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

-- Customers: mọi user đã login
create policy "customers_all_authenticated" on public.customers
  for all using (auth.role() = 'authenticated');

-- Orders: xem tất cả (admin) hoặc chỉ của mình (staff)
create policy "orders_select" on public.orders
  for select using (
    auth.uid() = user_id or
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

create policy "orders_insert" on public.orders
  for insert with check (auth.uid() = user_id);

create policy "orders_update_admin" on public.orders
  for update using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

-- Settings: xem tất cả, sửa chỉ admin
create policy "settings_select_all" on public.settings
  for select using (auth.role() = 'authenticated');

create policy "settings_update_admin" on public.settings
  for update using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- Trigger: tự tạo profile khi user đăng ký
-- ============================================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.users (id, email, full_name, avatar_url, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    'staff'  -- mặc định là staff, admin tự đổi trong DB
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- Trigger: updated_at tự động cho products
-- ============================================================

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_updated_at on public.products;
create trigger products_updated_at
  before update on public.products
  for each row execute procedure public.set_updated_at();

-- ============================================================
-- Nâng quyền admin cho user đầu tiên (thay email bên dưới)
-- ============================================================
-- update public.users set role = 'admin' where email = 'your@email.com';
