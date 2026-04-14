import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})

// ─── Database Types ────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'staff'

export interface UserProfile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: UserRole
  phone?: string | null
  created_at?: string
}

export interface Product {
  id: string
  type: string
  category: string
  code: string
  name: string
  brand?: string | null
  sell_price: number
  buy_price: number
  stock_level: number
  min_stock?: number
  max_stock?: number
  unit: string
  images?: string | null
  weight?: number
  is_directly_sold?: boolean
  created_at?: string
  updated_at?: string
}

export interface Customer {
  id: string
  name: string
  phone?: string | null
  address?: string | null
  current_debt: number
  total_spent?: number
  total_orders?: number
  created_at?: string
}

export interface Order {
  id: string
  order_code: string
  customer_id?: string | null
  customer_name: string
  user_id?: string | null
  subtotal: number
  discount: number
  total_amount: number
  status: 'paid' | 'debt'
  note?: string | null
  created_at: string
  // joined
  customers?: Pick<Customer, 'name' | 'phone'> | null
}

export interface OrderDetail {
  id: string
  order_id: string
  product_id?: string | null
  product_name: string
  quantity: number
  unit_price: number
  subtotal: number
}

export interface StoreSettings {
  store_name: string
  phone: string
  address: string
  website: string
  logo_url: string
  invoice_header: string
  invoice_footer: string
  admin_name: string
  admin_email: string
  bank_name: string
  bank_account: string
  bank_owner: string
  updated_at?: string
}

export const defaultStoreSettings: StoreSettings = {
  store_name: 'ShopMin',
  phone: '',
  address: '',
  website: '',
  logo_url: '',
  invoice_header: 'HÓA ĐƠN BÁN HÀNG',
  invoice_footer: 'Cảm ơn quý khách, hẹn gặp lại!',
  admin_name: 'Quản trị viên',
  admin_email: '',
  bank_name: '',
  bank_account: '',
  bank_owner: '',
}
