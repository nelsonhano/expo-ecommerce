export interface Product {
  _id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  images: string[];
  averageRating: number;
  totalReviews: number;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  _id: string;
  clerkId: string;
  email: string;
  name: string;
  imageUrl: string;
  addresses: Address[];
  wishlist: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Address {
  _id: string;
  label: string;
  fullName: string;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  phoneNumber: string;
  isDefault: boolean;
}

export interface Order {
  _id: string;
  user: string;
  clerkId: string;
  orderItems: OrderItem[];
  shippingAddress: {
    fullName: string;
    streetAddress: string;
    city: string;
    state: string;
    zipCode: string;
    phoneNumber: string;
  };
  paymentResult: {
    id: string;
    status: PaymentStatus;
  };
  totalPrice: number;
  status: "pending" | "shipped" | "delivered" | "cancelled";
  // set only when status is "cancelled"
  cancelReason: CancelReason | null;
  hasReviewed: boolean;
  createdAt: string;
  updatedAt: string;
}

export type PaymentStatus = "authorized" | "captured" | "canceled" | "capture_failed";
export type CancelReason = "sold_out" | "capture_failed" | "authorization_expired";

// GET /orders/by-payment/:paymentIntentId (200 once the webhook saved the order, 202 before)
export type PaymentOutcome =
  | { status: "processing" }
  | {
      orderId: string;
      status: Order["status"];
      paymentStatus: PaymentStatus;
      cancelReason: CancelReason | null;
    };

export interface OrderItem {
  _id: string;
  // null when the product has since been deleted by an admin
  product: Product | null;
  name: string;
  price: number;
  quantity: number;
  image: string;
}

export interface Review {
  _id: string;
  productId: string;
  userId: string | User;
  orderId: string;
  rating: number;
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  _id: string;
  product: Product;
  quantity: number;
}

export interface Cart {
  _id: string;
  user: string;
  clerkId: string;
  items: CartItem[];
  createdAt: string;
  updatedAt: string;
}
