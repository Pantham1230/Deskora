import axios from 'axios';
import type { AuthClaims, Booking, Branch, Client, Company, DashboardResponse, Employee, Invoice, MeetingRoom, Notification, Role, Seat, User, Visitor } from './types';
import { getApiBaseUrl } from './lib/runtimeUrls';

export type RegisterAccountPayload =
  | { role: 'admin'; companyName: string; industry: string; name: string; email: string; password: string }
  | { role: 'client'; name: string; email: string; password: string };

export type CreateBranchPayload = {
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
};

export type PublicWorkspaceSpace = {
  id: string;
  category: 'Meeting Rooms' | 'Executive Cabins' | 'Dedicated Desk Zones' | 'Open Workspace Areas' | 'Event Halls' | 'Collaboration Lounges';
  name: string;
  capacity: number;
  pricingLabel: string;
  availabilityLabel: string;
  amenities: string[];
  imageUrl: string;
};

export type PublicWorkspaceSummary = {
  company: Company;
  branch: Branch;
  verificationStatus: 'verified' | 'pending';
  description: string;
  occupancyRate: number;
  availableSeats: number;
  availableDesks: number;
  rating: number;
  pricingMin: number;
  pricingMax: number;
  amenities: string[];
  meetingRooms: number;
  meetingRoomCount: number;
  totalSeats: number;
  gallerySeed: string;
  heroImageUrl: string;
  galleryImageUrls: string[];
  operatingHours: string;
  locationMapUrl: string;
  rooms: Array<{ name: string; capacity: number; hourlyRate: number; status: 'available'; imageUrl?: string }>;
  spaces: PublicWorkspaceSpace[];
  seatPreview: Array<{ label: string; floor: number; zone: string; status: string }>;
  reviews: Array<{ rating: number; message: string; createdAt: string }>;
};

export type PublicWorkspaceCatalog = {
  workspaces: PublicWorkspaceSummary[];
};

export const api = axios.create({
  baseURL: getApiBaseUrl()
});

export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
    return;
  }
  delete api.defaults.headers.common.Authorization;
}

export async function login(email: string, password: string) {
  const response = await api.post<{ token: string; user: User }>('/auth/login', { email, password });
  return response.data;
}

export async function registerAccount(payload: RegisterAccountPayload) {
  const response = await api.post<{ token: string; user: User; company?: Company }>('/auth/register', payload);
  return response.data;
}

export async function getPublicWorkspaces() {
  const response = await api.get<PublicWorkspaceCatalog>('/public/workspaces');
  return response.data;
}

export async function getMe() {
  const response = await api.get<{ user: User; claims: AuthClaims }>('/me');
  return response.data;
}

export async function getDashboard() {
  const response = await api.get<DashboardResponse>('/dashboard');
  return response.data;
}

export async function listBranches() {
  const response = await api.get<Branch[]>('/branches');
  return response.data;
}

export async function createBranch(payload: CreateBranchPayload) {
  const response = await api.post<Branch>('/branches', payload);
  return response.data;
}

export async function listSeats(branchId?: string) {
  const response = await api.get<Seat[]>('/seats', { params: branchId ? { branchId } : undefined });
  return response.data;
}

export async function bookSeat(seatId: string, customerName: string) {
  const response = await api.post<Seat>(`/seats/${seatId}/book`, { customerName });
  return response.data;
}

export async function cancelSeat(seatId: string) {
  const response = await api.post(`/seats/${seatId}/cancel`);
  return response.data;
}

export async function listMeetingRooms(branchId?: string) {
  const response = await api.get<MeetingRoom[]>('/meeting-rooms', { params: branchId ? { branchId } : undefined });
  return response.data;
}

export async function bookMeetingRoom(roomId: string, customerName: string, startAt: string, endAt: string) {
  const response = await api.post(`/meeting-rooms/${roomId}/book`, { customerName, startAt, endAt });
  return response.data;
}

export async function cancelMeetingRoom(roomId: string, bookingId?: string) {
  const response = await api.post(`/meeting-rooms/${roomId}/cancel`, { bookingId });
  return response.data;
}

export async function listClients() {
  const response = await api.get<Client[]>('/clients');
  return response.data;
}

export async function createClient(payload: Record<string, unknown>) {
  const response = await api.post<Client>('/clients', payload);
  return response.data;
}

export async function listEmployees() {
  const response = await api.get<Employee[]>('/employees');
  return response.data;
}

export async function createEmployee(payload: Record<string, unknown>) {
  const response = await api.post<Employee>('/employees', payload);
  return response.data;
}

export async function listInvoices() {
  const response = await api.get<Invoice[]>('/invoices');
  return response.data;
}

export async function listMyBookings() {
  const response = await api.get<Booking[]>('/bookings');
  return response.data;
}

export async function createInvoice(payload: Record<string, unknown>) {
  const response = await api.post<Invoice>('/invoices', payload);
  return response.data;
}

export async function listNotifications() {
  const response = await api.get<Notification[]>('/notifications');
  return response.data;
}

export async function listCompanies() {
  const response = await api.get<Company[]>('/companies');
  return response.data;
}

export async function deleteBranch(branchId: string) {
  const response = await api.delete(`/branches/${branchId}`);
  return response.data;
}

export async function deleteMeetingRoom(roomId: string) {
  const response = await api.delete(`/meeting-rooms/${roomId}`);
  return response.data;
}

export async function listVisitors(branchId?: string) {
  const response = await api.get<Visitor[]>('/visitors', { params: branchId ? { branchId } : undefined });
  return response.data;
}

export async function checkInVisitor(payload: {
  branchId: string;
  visitorName: string;
  purpose: string;
  hostName: string;
  workspaceLocation: string;
}) {
  const response = await api.post<Visitor>('/visitors/check-in', payload);
  return response.data;
}

export async function checkOutVisitor(visitorId: string) {
  const response = await api.post<Visitor>(`/visitors/${visitorId}/check-out`);
  return response.data;
}
