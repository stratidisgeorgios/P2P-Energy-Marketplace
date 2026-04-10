/**
 * TypeScript Type Definitions
 */

// User Types
export interface User {
  id: string;
  walletAddress: string;
  email?: string;
  username: string;
  avatar?: string;
  bio?: string;
  role: 'PRODUCER' | 'CONSUMER' | 'BOTH' | 'ORACLE' | 'ADMIN';
  isActive: boolean;
  stats: UserStats;
  producerInfo?: ProducerInfo;
  createdAt: string;
}

export interface UserStats {
  totalTransactions: number;
  totalEnergyTraded: number;
  averageRating: number;
  ratingCount: number;
}

export interface ProducerInfo {
  companyName: string;
  energySources: EnergySource[];
  capacity: number;
  certifications?: string[];
}

// Energy & Marketplace Types
export type EnergySource = 'SOLAR' | 'WIND' | 'HYDRO' | 'GEOTHERMAL' | 'BIOMASS' | 'ANY';

export interface Offer {
  _id: string;
  createdBy: User;
  createdByAddress: string;
  offerType: 'SELL' | 'BUY';
  quantity: number; // kWh
  pricePerUnit: number;
  totalPrice: number;
  energySource: EnergySource;
  deliveryDate: string;
  deliveryAddress?: string;
  status: 'ACTIVE' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELLED' | 'EXPIRED';
  remainingQuantity: number;
  expiresAt: string;
  description?: string;
  createdAt: string;
}

export interface Trade {
  _id: string;
  offerId: string;
  seller: User;
  buyer: User;
  quantity: number;
  pricePerUnit: number;
  totalPrice: number;
  energySource: EnergySource;
  deliveryDate: string;
  status: 'ACCEPTED' | 'PAYMENT_PENDING' | 'IN_ESCROW' | 'COMPLETED' | 'DISPUTED' | 'CANCELLED';
  sellerRating?: Rating;
  buyerRating?: Rating;
  certificateId?: string;
  createdAt: string;
}

export interface Rating {
  rating: number;
  review: string;
  ratedAt: string;
}

// Escrow Types
export interface Escrow {
  _id: string;
  tradeId: string;
  buyer: User;
  seller: User;
  amount: number;
  status: 'CREATED' | 'DEPOSITED' | 'HELD' | 'RELEASED' | 'REFUNDED';
  depositedAt?: string;
  releasedAt?: string;
  refundedAt?: string;
  autoRefundDate: string;
  createdAt: string;
}

// Certificate Types
export interface Certificate {
  _id: string;
  issuedBy: User;
  energyAmount: number;
  energySource: EnergySource;
  issueDate: string;
  status: 'ISSUED' | 'ACTIVE' | 'RETIRED' | 'TRANSFERRED';
  currentOwner: User;
  currentOwnerAddress: string;
  tradeId?: string;
  transferHistory: TransferRecord[];
  createdAt: string;
}

export interface TransferRecord {
  from: string;
  to: string;
  date: string;
}

// Market Data Types
export interface MarketPrice {
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  count: number;
  totalVolume: number;
}

export interface MarketStats {
  activeOffers: number;
  completedTrades: number;
  totalEnergyTraded: number;
  activeProducers: number;
  activeConsumers: number;
  totalUsers: number;
}

export interface PriceHistory {
  _id: string;
  avgPrice: number;
  count: number;
  volume: number;
}

// API Response Types
export interface ApiResponse<T> {
  message?: string;
  data?: T;
  error?: string;
  errorCode?: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

// Notification Types
export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}
