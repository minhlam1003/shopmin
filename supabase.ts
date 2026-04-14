import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'staff'

export interface UserProfile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: UserRole
  phone?: string
  created_at?: string
}

export interface Product {
  id: string
  name: string
  price: number
  cost_price?: number
  description?: string
  image_url?: string
  category?: string
  unit?: string
  stock: number
  barcode?: string
  created_at?: string
  updated_at?: string
}

export interface Customer {
  id: string
  name: string
  phone?: string
  email?: string
  address?: string
  total_spent?: number
  total_orders?: number
  created_at?: string
}

export interface Order {
  id: string
  customer_id?: string
  user_id: string
  items: OrderItem[]
  subtotal: number
  discount?: number
  total: number
  payment_method: 'cash' | 'transfer' | 'card'
  status: 'completed' | 'pending' | 'cancelled' | 'refunded'
  note?: string
  created_at?: string
}

export interface OrderItem {
  product_id: string
  product_name: string
  quantity: number
  price: number
  total: number
}

export interface Setting {
  key: string
  value: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getAvatarUrl(profile: UserProfile): string {
  return (
    profile.avatar_url ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      profile.full_name || profile.email
    )}&background=3b82f6&color=fff&size=128`
  )
}
