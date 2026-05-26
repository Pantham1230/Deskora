export type Role = 'admin' | 'client';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'overdue';
export type PaymentMethod = 'upi' | 'stripe' | 'razorpay' | 'card' | 'net_banking' | 'wallet';
export type FeedbackCategory = 'workspace' | 'meeting_room' | 'maintenance' | 'suggestion';
export type SubscriptionTier = 'starter' | 'business' | 'enterprise';

export interface User {
  id: string;
  tenantId: string;
  companyId: string | null;
  branchId: string | null;
  name: string;
  email: string;
  role: Role;
}

export interface AuthClaims {
  userId: string;
  tenantId: string;
  companyId: string | null;
  branchId: string | null;
  role: Role;
  email: string;
}

export interface Company {
  id: string;
  tenantId: string;
  name: string;
  industry: string;
  status: 'active' | 'paused';
}

export interface Branch {
  id: string;
  tenantId: string;
  companyId: string;
  name: string;
  city: string;
  address: string;
  description?: string;
  floors: number;
  seatCount: number;
  pricingPerSeat: number;
  meetingRoomCount?: number;
  heroImageUrl?: string;
  galleryImageUrls?: string[];
  verificationStatus?: 'verified' | 'pending';
}

export interface FloorZone {
  id: string;
  branchId: string;
  name: string;
  type: 'open_workspace' | 'private_cabin' | 'meeting_room' | 'lounge';
  occupancy: number;
}

export interface Seat {
  id: string;
  tenantId: string;
  companyId: string;
  branchId: string;
  label: string;
  floor: number;
  zone: string;
  status: 'available' | 'reserved' | 'booked' | 'cancelled';
  bookedByCurrentUser?: boolean;
  canCancel?: boolean;
}

export interface Booking {
  id: string;
  tenantId: string;
  companyId: string;
  branchId: string;
  resourceType: 'seat' | 'meeting_room';
  resourceId: string;
  customerName: string;
  startAt: string;
  endAt: string;
  status: 'booked' | 'cancelled' | 'completed';
  notes?: string;
}

export interface MeetingRoom {
  id: string;
  tenantId: string;
  companyId: string;
  branchId: string;
  name: string;
  capacity: number;
  hourlyRate: number;
  imageUrl?: string;
}

export interface Client {
  id: string;
  tenantId: string;
  companyId: string;
  name: string;
  contactName: string;
  email: string;
  stage: 'lead' | 'contacted' | 'converted' | 'active';
  lastTouchAt: string;
}

export interface Invoice {
  id: string;
  tenantId: string;
  companyId: string;
  branchId: string;
  clientId: string;
  invoiceNumber: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  issueDate: string;
  dueDate: string;
  total: number;
  lineItems: Array<{ label: string; quantity: number; rate: number }>;
}

export interface Employee {
  id: string;
  tenantId: string;
  companyId: string;
  branchId: string | null;
  name: string;
  role: Role;
  title: string;
  email: string;
}

export interface Notification {
  id: string;
  tenantId: string;
  companyId: string;
  type: 'renewal' | 'booking' | 'payment';
  title: string;
  body: string;
  createdAt: string;
}

export type VisitorStatus = 'checked_in' | 'checked_out';

export interface Visitor {
  id: string;
  tenantId: string;
  companyId: string;
  branchId: string;
  passId: string;
  visitorName: string;
  purpose: string;
  hostName: string;
  workspaceLocation: string;
  checkInAt: string;
  checkOutAt: string | null;
  status: VisitorStatus;
}

export interface Feedback {
  id: string;
  tenantId: string;
  companyId: string;
  branchId: string;
  clientId: string;
  rating: number;
  category: FeedbackCategory;
  message: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  createdAt: string;
}

export interface SmartInsight {
  id: string;
  title: string;
  detail: string;
  tone: 'success' | 'warning' | 'info' | 'accent';
}

export interface HeatmapCell {
  id: string;
  branchId: string;
  zone: string;
  intensity: number;
  label: string;
}

export interface Subscription {
  id: string;
  tenantId: string;
  companyId: string;
  tier: SubscriptionTier;
  renewalDate: string;
  autoRenew: boolean;
  status: 'active' | 'expiring' | 'expired';
}

export interface DashboardResponse {
  totals: {
    companies: number;
    branches: number;
    seats: number;
    activeClients: number;
    revenue: number;
    occupancyRate: number;
  };
  branchStats: Array<Branch & { occupancyRate: number; bookedSeats: number; reservedSeats: number; averageRating: number; experienceScore: number; layoutTone: string }>;
  recentNotifications: Notification[];
  clients: Client[];
  invoices: Invoice[];
  payments: Array<{ invoiceId: string; amount: number; status: PaymentStatus; method: PaymentMethod; referenceId: string; paidAt: string | null; subscriptionTier: SubscriptionTier }>;
  feedback: Feedback[];
  insights: SmartInsight[];
  heatmap: HeatmapCell[];
  subscriptions: Subscription[];
}
