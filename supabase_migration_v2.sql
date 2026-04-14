-- ============================================================
-- ShopMin · Supabase SQL Migration (Full)
-- Chạy toàn bộ file này trong Supabase Dashboard > SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- 1. USERS (profile table)
-- ============================================================
create table if not exists public.users (
  id          uuid references auth.users on delete cascade primary key,
  email       text unique not null,
  full_name   text,
  avatar_url  text,
  role        text not null default 'staff' check (role in ('admin', 'staff')),
  phone       text,
  created_at  timestamptz default now()
);

-- ============================================================
-- 2. PRODUCTS
-- ============================================================
create table if not exists public.products (
  id               uuid default uuid_generate_v4() primary key,
  type             text not null default 'Hàng hóa',
  category         text not null default '',
  code             text not null default '',
  name             text not null,
  brand            text,
  sell_price       numeric(15,0) not null default 0,
  buy_price        numeric(15,0) not null default 0,
  stock_level      integer not null default 0,
  min_stock        integer default 0,
  max_stock        integer default 999999999,
  unit             text not null default 'cái',
  images           text,
  weight           numeric(10,3) default 1,
  is_directly_sold boolean default true,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

create index if not exists products_name_idx on public.products(name);
create index if not exists products_code_idx on public.products(code);
create index if not exists products_category_idx on public.products(category);

-- ============================================================
-- 3. CUSTOMERS
-- ============================================================
create table if not exists public.customers (
  id           uuid default uuid_generate_v4() primary key,
  name         text not null,
  phone        text,
  address      text,
  current_debt numeric(15,0) not null default 0,
  total_spent  numeric(15,0) default 0,
  total_orders integer default 0,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create index if not exists customers_name_idx on public.customers(name);
create index if not exists customers_phone_idx on public.customers(phone);

-- ============================================================
-- 4. ORDERS
-- ============================================================
create table if not exists public.orders (
  id            uuid default uuid_generate_v4() primary key,
  order_code    text not null unique,
  customer_id   uuid references public.customers(id) on delete set null,
  customer_name text not null default 'Khách lẻ',
  user_id       uuid references public.users(id) on delete set null,
  subtotal      numeric(15,0) not null default 0,
  discount      numeric(15,0) not null default 0,
  total_amount  numeric(15,0) not null default 0,
  status        text not null default 'paid' check (status in ('paid', 'debt')),
  note          text,
  created_at    timestamptz default now()
);

create index if not exists orders_created_at_idx on public.orders(created_at desc);
create index if not exists orders_customer_id_idx on public.orders(customer_id);
create index if not exists orders_status_idx on public.orders(status);
create index if not exists orders_order_code_idx on public.orders(order_code);

-- ============================================================
-- 5. ORDER DETAILS
-- ============================================================
create table if not exists public.order_details (
  id           uuid default uuid_generate_v4() primary key,
  order_id     uuid not null references public.orders(id) on delete cascade,
  product_id   uuid references public.products(id) on delete set null,
  product_name text not null,
  quantity     integer not null check (quantity > 0),
  unit_price   numeric(15,0) not null default 0,
  subtotal     numeric(15,0) not null default 0
);

create index if not exists order_details_order_id_idx on public.order_details(order_id);

-- ============================================================
-- 6. SETTINGS (key-value store)
-- ============================================================
create table if not exists public.settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz default now()
);

-- Default settings
insert into public.settings (key, value) values
  ('store_name', 'ShopMin'),
  ('phone', ''),
  ('address', ''),
  ('website', ''),
  ('logo_url', ''),
  ('invoice_header', 'HÓA ĐƠN BÁN HÀNG'),
  ('invoice_footer', 'Cảm ơn quý khách, hẹn gặp lại!'),
  ('admin_name', 'Quản trị viên'),
  ('admin_email', ''),
  ('bank_name', ''),
  ('bank_account', ''),
  ('bank_owner', '')
on conflict (key) do nothing;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.users         enable row level security;
alter table public.products      enable row level security;
alter table public.customers     enable row level security;
alter table public.orders        enable row level security;
alter table public.order_details enable row level security;
alter table public.settings      enable row level security;

-- Helper function: is user admin?
create or replace function public.is_admin()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role = 'admin'
  )
$$;

-- USERS policies
create policy "users: view own profile" on public.users
  for select using (auth.uid() = id);
create policy "users: update own profile" on public.users
  for update using (auth.uid() = id);
create policy "users: admin view all" on public.users
  for select using (public.is_admin());
create policy "users: admin manage all" on public.users
  for all using (public.is_admin());

-- PRODUCTS policies
create policy "products: authenticated read" on public.products
  for select using (auth.role() = 'authenticated');
create policy "products: admin write" on public.products
  for all using (public.is_admin());
-- Staff can update stock (for POS sales)
create policy "products: staff update stock" on public.products
  for update using (auth.role() = 'authenticated');

-- CUSTOMERS policies
create policy "customers: authenticated read" on public.customers
  for select using (auth.role() = 'authenticated');
create policy "customers: authenticated write" on public.customers
  for insert with check (auth.role() = 'authenticated');
create policy "customers: authenticated update" on public.customers
  for update using (auth.role() = 'authenticated');
create policy "customers: admin delete" on public.customers
  for delete using (public.is_admin());

-- ORDERS policies
create policy "orders: authenticated read" on public.orders
  for select using (auth.role() = 'authenticated');
create policy "orders: authenticated insert" on public.orders
  for insert with check (auth.role() = 'authenticated');
create policy "orders: admin manage" on public.orders
  for all using (public.is_admin());

-- ORDER_DETAILS policies
create policy "order_details: authenticated read" on public.order_details
  for select using (auth.role() = 'authenticated');
create policy "order_details: authenticated insert" on public.order_details
  for insert with check (auth.role() = 'authenticated');
create policy "order_details: admin manage" on public.order_details
  for all using (public.is_admin());

-- SETTINGS policies
create policy "settings: authenticated read" on public.settings
  for select using (auth.role() = 'authenticated');
create policy "settings: admin write" on public.settings
  for all using (public.is_admin());

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto-create user profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.users (id, email, full_name, avatar_url, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    'staff'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row execute procedure public.set_updated_at();

drop trigger if exists customers_set_updated_at on public.customers;
create trigger customers_set_updated_at
  before update on public.customers
  for each row execute procedure public.set_updated_at();

-- ============================================================
-- USEFUL VIEWS
-- ============================================================

-- Daily revenue summary
create or replace view public.daily_revenue as
select
  date_trunc('day', created_at at time zone 'Asia/Ho_Chi_Minh') as day,
  count(*) as order_count,
  sum(total_amount) as revenue,
  sum(discount) as total_discount
from public.orders
where status = 'paid'
group by 1
order by 1 desc;

-- Product sales summary
create or replace view public.product_sales_summary as
select
  od.product_id,
  od.product_name,
  sum(od.quantity) as total_sold,
  sum(od.subtotal) as total_revenue,
  count(distinct od.order_id) as order_count
from public.order_details od
join public.orders o on o.id = od.order_id
where o.status = 'paid'
group by od.product_id, od.product_name
order by total_revenue desc;

-- ============================================================
-- Sau khi tạo xong, đặt role admin cho tài khoản đầu tiên:
-- update public.users set role = 'admin' where email = 'your@email.com';
-- ============================================================
