import { Timestamp } from 'firebase/firestore';

export interface Product {
  id?: string;
  type: string; // Loại hàng
  category: string; // Nhóm hàng
  code: string; // Mã hàng
  name: string; // Tên hàng
  brand?: string; // Thương hiệu
  sellPrice: number; // Giá bán
  buyPrice: number; // Giá vốn
  stockLevel: number; // Tồn kho
  minStock?: number; // Tồn nhỏ nhất
  maxStock?: number; // Tồn lớn nhất
  unit: string; // ĐVT
  images?: string; // Hình ảnh (url)
  weight?: number; // Trọng lượng
  isDirectlySold?: boolean; // Được bán trực tiếp
  createdAt?: Timestamp; // Thời gian tạo
}

export interface Customer {
  id?: string;
  name: string;
  phone: string;
  address: string; // Địa chỉ
  currentDebt: number;
}

export interface Order {
  id?: string;
  orderCode: string; // Mã đơn
  customerId: string;
  customerName: string;
  subtotal: number;
  discount: number;
  totalAmount: number;
  status: 'paid' | 'debt';
  createdAt: Timestamp;
}

export interface OrderDetail {
  id?: string;
  orderId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}
