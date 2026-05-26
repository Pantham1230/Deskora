export type Role = 'admin' | 'client';

export type BookingStatus = 'available' | 'reserved' | 'booked' | 'cancelled';
export type ClientStage = 'lead' | 'contacted' | 'converted' | 'active';
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'overdue';
export type NotificationType = 'renewal' | 'booking' | 'payment';
export type PaymentMethod = 'upi' | 'stripe' | 'razorpay' | 'card' | 'net_banking' | 'wallet';
export type FeedbackCategory = 'workspace' | 'meeting_room' | 'maintenance' | 'suggestion';
export type SubscriptionTier = 'starter' | 'business' | 'enterprise';

export interface UserRecord {
  id: string;
  tenantId: string;
  companyId: string | null;
  branchId: string | null;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
}

export interface CompanyRecord {
  id: string;
  tenantId: string;
  name: string;
  industry: string;
  status: 'active' | 'paused';
  createdAt: string;
}

export interface BranchRecord {
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

export interface BranchInsightRecord {
  branchId: string;
  label: string;
  value: number;
  tone: 'good' | 'warning' | 'neutral';
}

export interface FloorZoneRecord {
  id: string;
  branchId: string;
  name: string;
  type: 'open_workspace' | 'private_cabin' | 'meeting_room' | 'lounge';
  occupancy: number;
}

export interface SeatRecord {
  id: string;
  tenantId: string;
  companyId: string;
  branchId: string;
  label: string;
  floor: number;
  zone: string;
  status: BookingStatus;
  bookedByCurrentUser?: boolean;
  canCancel?: boolean;
}

export interface MeetingRoomRecord {
  id: string;
  tenantId: string;
  companyId: string;
  branchId: string;
  name: string;
  capacity: number;
  hourlyRate: number;
  imageUrl?: string;
}

export interface BookingRecord {
  id: string;
  tenantId: string;
  companyId: string;
  branchId: string;
  resourceType: 'seat' | 'meeting_room';
  resourceId: string;
  customerName: string;
  startAt: string;
  endAt: string;
  status: BookingStatus;
  notes?: string;
}

export interface ClientRecord {
  id: string;
  tenantId: string;
  companyId: string;
  name: string;
  contactName: string;
  email: string;
  stage: ClientStage;
  lastTouchAt: string;
}

export interface EmployeeRecord {
  id: string;
  tenantId: string;
  companyId: string;
  branchId: string | null;
  name: string;
  role: Role;
  title: string;
  email: string;
}

export interface InvoiceLineItem {
  label: string;
  quantity: number;
  rate: number;
}

export interface InvoiceRecord {
  id: string;
  tenantId: string;
  companyId: string;
  branchId: string;
  clientId: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  total: number;
  lineItems: InvoiceLineItem[];
}

export interface PaymentRecord {
  id: string;
  tenantId: string;
  companyId: string;
  invoiceId: string;
  amount: number;
  status: PaymentStatus;
  method?: PaymentMethod;
  paidAt: string | null;
  referenceId?: string;
  subscriptionTier?: SubscriptionTier;
}

export interface FeedbackRecord {
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

export interface NotificationRecord {
  id: string;
  tenantId: string;
  companyId: string;
  type: NotificationType;
  title: string;
  body: string;
  createdAt: string;
}

export type VisitorStatus = 'checked_in' | 'checked_out';

export interface VisitorRecord {
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

export interface TenantData {
  users: UserRecord[];
  companies: CompanyRecord[];
  branches: BranchRecord[];
  seats: SeatRecord[];
  meetingRooms: MeetingRoomRecord[];
  bookings: BookingRecord[];
  clients: ClientRecord[];
  employees: EmployeeRecord[];
  invoices: InvoiceRecord[];
  payments: PaymentRecord[];
  feedback: FeedbackRecord[];
  subscriptions: SubscriptionRecord[];
  notifications: NotificationRecord[];
  visitors: VisitorRecord[];
}

export interface AuthClaims {
  userId: string;
  tenantId: string;
  companyId: string | null;
  branchId: string | null;
  role: Role;
  email: string;
}

export interface SmartInsightRecord {
  id: string;
  title: string;
  detail: string;
  tone: 'success' | 'warning' | 'info' | 'accent';
}

export interface HeatmapCellRecord {
  id: string;
  branchId: string;
  zone: string;
  intensity: number;
  label: string;
}

export interface SubscriptionRecord {
  id: string;
  tenantId: string;
  companyId: string;
  tier: SubscriptionTier;
  renewalDate: string;
  autoRenew: boolean;
  status: 'active' | 'expiring' | 'expired';
}
