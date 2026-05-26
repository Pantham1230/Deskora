import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import type { BranchRecord, ClientRecord, CompanyRecord, EmployeeRecord, FeedbackRecord, InvoiceRecord, MeetingRoomRecord, NotificationRecord, PaymentRecord, SeatRecord, SubscriptionRecord, TenantData, UserRecord, VisitorRecord } from './types.js';

const now = new Date();
const passwordHash = await bcrypt.hash('deskora123', 10);

type TenantSeed = {
  companyName: string;
  city: string;
  tenantId: string;
  companyId: string;
  branchId: string;
  branchName: string;
  industry: string;
  description: string;
  pricingPerSeat: number;
  floors: number;
  seatCount: number;
  bookedCount: number;
  reservedCount: number;
  heroImageUrl: string;
  galleryImageUrls: string[];
  colors: [string, string];
  layoutTone: 'compact' | 'balanced' | 'premium' | 'campus' | 'vertical';
  zones: Array<{ name: string; type: 'open_workspace' | 'private_cabin' | 'meeting_room' | 'lounge'; occupancy: number }>;
};

const workspaceImages = [
  'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1600&q=80&sat=-8',
  'https://images.unsplash.com/photo-1517502884422-41eaead166d4?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1497366412874-3415097a27e7?auto=format&fit=crop&w=1600&q=80'
] as const;

const roomImages = [
  'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1531973576160-7125cd663d86?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1600&q=80'
] as const;

const tenantSeeds: TenantSeed[] = [
  {
    companyName: 'NovaHub',
    city: 'Hyderabad',
    tenantId: 'tenant-novahub',
    companyId: uuid(),
    branchId: uuid(),
    branchName: 'NovaHub Pulse',
    industry: 'Premium Coworking',
    description: 'A polished startup campus with open desks, private cabins, and rooms built for fast-moving teams.',
    pricingPerSeat: 14200,
    floors: 3,
    seatCount: 36,
    bookedCount: 24,
    reservedCount: 6,
    heroImageUrl: workspaceImages[0],
    galleryImageUrls: [workspaceImages[1], workspaceImages[2], roomImages[0]],
    colors: ['#8b5cf6', '#22c55e'],
    layoutTone: 'vertical',
    zones: [
      { name: 'Sky Pods', type: 'private_cabin', occupancy: 88 },
      { name: 'Bloom Commons', type: 'open_workspace', occupancy: 94 },
      { name: 'Signal Rooms', type: 'meeting_room', occupancy: 63 },
      { name: 'Glass Lounge', type: 'lounge', occupancy: 42 }
    ]
  },
  {
    companyName: 'AetherSpace',
    city: 'Bangalore',
    tenantId: 'tenant-aetherspace',
    companyId: uuid(),
    branchId: uuid(),
    branchName: 'AetherSpace Grid',
    industry: 'Innovation Campus',
    description: 'An innovation campus with collaborative floors, premium cabins, and a lively workplace rhythm.',
    pricingPerSeat: 16900,
    floors: 4,
    seatCount: 44,
    bookedCount: 31,
    reservedCount: 7,
    heroImageUrl: workspaceImages[1],
    galleryImageUrls: [workspaceImages[2], workspaceImages[3], roomImages[1]],
    colors: ['#0ea5e9', '#14b8a6'],
    layoutTone: 'campus',
    zones: [
      { name: 'North Deck', type: 'open_workspace', occupancy: 76 },
      { name: 'Orbit Cabins', type: 'private_cabin', occupancy: 83 },
      { name: 'Control Rooms', type: 'meeting_room', occupancy: 67 },
      { name: 'Zen Garden', type: 'lounge', occupancy: 55 }
    ]
  },
  {
    companyName: 'OrbitWorks',
    city: 'Mumbai',
    tenantId: 'tenant-orbitworks',
    companyId: uuid(),
    branchId: uuid(),
    branchName: 'OrbitWorks Harbor',
    industry: 'Executive Workspaces',
    description: 'A commercial-grade executive center with lounge energy, boardroom-ready rooms, and premium seating.',
    pricingPerSeat: 18800,
    floors: 5,
    seatCount: 52,
    bookedCount: 35,
    reservedCount: 9,
    heroImageUrl: workspaceImages[2],
    galleryImageUrls: [workspaceImages[3], workspaceImages[4], roomImages[2]],
    colors: ['#f97316', '#fb7185'],
    layoutTone: 'premium',
    zones: [
      { name: 'Tide Hall', type: 'open_workspace', occupancy: 84 },
      { name: 'Suite Cabins', type: 'private_cabin', occupancy: 91 },
      { name: 'Summit Rooms', type: 'meeting_room', occupancy: 72 },
      { name: 'Cove Lounge', type: 'lounge', occupancy: 46 }
    ]
  },
  {
    companyName: 'ZenithDesk',
    city: 'Delhi',
    tenantId: 'tenant-zenithdesk',
    companyId: uuid(),
    branchId: uuid(),
    branchName: 'ZenithDesk Forum',
    industry: 'Managed Offices',
    description: 'A balanced branch with focused cabins, collaborative tables, and community-forward shared areas.',
    pricingPerSeat: 15400,
    floors: 3,
    seatCount: 34,
    bookedCount: 19,
    reservedCount: 8,
    heroImageUrl: workspaceImages[3],
    galleryImageUrls: [workspaceImages[4], workspaceImages[0], roomImages[0]],
    colors: ['#22c55e', '#84cc16'],
    layoutTone: 'balanced',
    zones: [
      { name: 'Atrium', type: 'open_workspace', occupancy: 68 },
      { name: 'Focus Cabins', type: 'private_cabin', occupancy: 58 },
      { name: 'Launch Rooms', type: 'meeting_room', occupancy: 49 },
      { name: 'Forum Lounge', type: 'lounge', occupancy: 61 }
    ]
  },
  {
    companyName: 'PixelForge Hub',
    city: 'Chennai',
    tenantId: 'tenant-pixelforge',
    companyId: uuid(),
    branchId: uuid(),
    branchName: 'PixelForge Atelier',
    industry: 'Creative Studios',
    description: 'A compact creative hub with studio-style desks, private pods, and presentation rooms.',
    pricingPerSeat: 13600,
    floors: 2,
    seatCount: 28,
    bookedCount: 14,
    reservedCount: 5,
    heroImageUrl: workspaceImages[4],
    galleryImageUrls: [workspaceImages[0], workspaceImages[1], roomImages[1]],
    colors: ['#ec4899', '#f59e0b'],
    layoutTone: 'compact',
    zones: [
      { name: 'Studio Floor', type: 'open_workspace', occupancy: 71 },
      { name: 'Edit Pods', type: 'private_cabin', occupancy: 64 },
      { name: 'Pitch Rooms', type: 'meeting_room', occupancy: 53 },
      { name: 'Canvas Lounge', type: 'lounge', occupancy: 39 }
    ]
  }
];

function buildSeats(tenantId: string, branchId: string, companyId: string, prefix: string, count: number, bookedCount: number, reservedCount: number, floorSplit: number, firstZone: string, secondZone: string): SeatRecord[] {
  return Array.from({ length: count }).map((_, index): SeatRecord => ({
    id: uuid(),
    tenantId,
    companyId,
    branchId,
    label: `${prefix}-${String(index + 1).padStart(2, '0')}`,
    floor: index < floorSplit ? 1 : 2,
    zone: index < floorSplit ? firstZone : secondZone,
    status: index < bookedCount ? 'booked' : index < bookedCount + reservedCount ? 'reserved' : 'available'
  }));
}

function makeInvoice(branch: TenantSeed, clientId: string, number: string, total: number, status: InvoiceRecord['status'], lineLabel: string): InvoiceRecord {
  return {
    id: uuid(),
    tenantId: branch.tenantId,
    companyId: branch.companyId,
    branchId: branch.branchId,
    clientId,
    invoiceNumber: number,
    status,
    issueDate: now.toISOString(),
    dueDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    total,
    lineItems: [{ label: lineLabel, quantity: Math.max(1, Math.round(total / branch.pricingPerSeat)), rate: branch.pricingPerSeat }]
  };
}

const companies: CompanyRecord[] = tenantSeeds.map((tenant) => ({
  id: tenant.companyId,
  tenantId: tenant.tenantId,
  name: tenant.companyName,
  industry: tenant.industry,
  status: 'active',
  createdAt: now.toISOString()
}));

const branches: BranchRecord[] = tenantSeeds.map((tenant) => ({
  id: tenant.branchId,
  tenantId: tenant.tenantId,
  companyId: tenant.companyId,
  name: tenant.branchName,
  city: tenant.city,
  address: `${Math.floor(Math.random() * 80) + 12} ${tenant.city} Central District`,
  description: tenant.description,
  floors: tenant.floors,
  seatCount: tenant.seatCount,
  pricingPerSeat: tenant.pricingPerSeat,
  meetingRoomCount: tenant.zones.filter((zone) => zone.type === 'meeting_room').length,
  heroImageUrl: tenant.heroImageUrl,
  galleryImageUrls: tenant.galleryImageUrls,
  verificationStatus: tenant.companyName === 'PixelForge Hub' ? 'pending' : 'verified'
}));

const seats: SeatRecord[] = tenantSeeds.flatMap((tenant) => buildSeats(
  tenant.tenantId,
  tenant.branchId,
  tenant.companyId,
  tenant.companyName.slice(0, 2).toUpperCase(),
  tenant.seatCount,
  tenant.bookedCount,
  tenant.reservedCount,
  Math.ceil(tenant.seatCount / 2),
  `${tenant.city} North`,
  `${tenant.city} South`
));

const meetingRooms: MeetingRoomRecord[] = tenantSeeds.flatMap((tenant) => {
  const base = tenant.companyName.replace(/\s+/g, '');
  return tenant.zones.filter((zone) => zone.type === 'meeting_room').map((zone, index) => ({
    id: uuid(),
    tenantId: tenant.tenantId,
    companyId: tenant.companyId,
    branchId: tenant.branchId,
    name: `${base}-${zone.name}-${index + 1}`,
    capacity: tenant.layoutTone === 'premium' ? 14 : tenant.layoutTone === 'campus' ? 10 : 8,
    hourlyRate: tenant.pricingPerSeat > 16000 ? 3200 : 2200,
    imageUrl: roomImages[index % roomImages.length]
  }));
});

const clients: ClientRecord[] = tenantSeeds.map((tenant, index) => ({
  id: uuid(),
  tenantId: tenant.tenantId,
  companyId: tenant.companyId,
  name: `${tenant.companyName} Member ${index + 1}`,
  contactName: ['Aarav', 'Meera', 'Nikhil', 'Sara', 'Riya'][index],
  email: `${tenant.companyName.replace(/\s+/g, '').toLowerCase()}@demo.com`,
  stage: index % 2 === 0 ? 'active' : 'converted',
  lastTouchAt: now.toISOString()
}));

const users: UserRecord[] = [
  {
    id: uuid(),
    tenantId: 'platform',
    companyId: null,
    branchId: null,
    name: 'Platform Owner',
    email: 'admin@deskora.com',
    passwordHash,
    role: 'admin'
  },
  {
    id: uuid(),
    tenantId: 'platform',
    companyId: null,
    branchId: null,
    name: 'Demo Client',
    email: 'client@deskora.com',
    passwordHash,
    role: 'client'
  },
  ...tenantSeeds.flatMap((tenant, index) => [
    {
      id: uuid(),
      tenantId: tenant.tenantId,
      companyId: tenant.companyId,
      branchId: null,
      name: `${tenant.companyName} Admin`,
      email: `${tenant.companyName.replace(/\s+/g, '').toLowerCase()}@deskora.com`,
      passwordHash,
      role: 'admin' as const
    },
    ...(index < 3
      ? [
          {
            id: uuid(),
            tenantId: tenant.tenantId,
            companyId: tenant.companyId,
            branchId: tenant.branchId,
            name: `${tenant.companyName} Manager`,
            email: `${tenant.companyName.replace(/\s+/g, '').toLowerCase()}-manager@deskora.com`,
            passwordHash,
            role: 'admin' as const
          },
        ]
      : [])
  ])
];

const employees: EmployeeRecord[] = tenantSeeds.flatMap((tenant, index) => [
  {
    id: uuid(),
    tenantId: tenant.tenantId,
    companyId: tenant.companyId,
    branchId: tenant.branchId,
    name: `${tenant.companyName} Operations Lead`,
    role: 'admin',
    title: 'Operations Lead',
    email: `${tenant.companyName.replace(/\s+/g, '').toLowerCase()}-ops@deskora.com`
  },
  ...(index === 0
    ? [
        {
          id: uuid(),
          tenantId: tenant.tenantId,
          companyId: tenant.companyId,
          branchId: null,
          name: `${tenant.companyName} HQ Finance`,
          role: 'admin' as const,
          title: 'Finance Controller',
          email: `${tenant.companyName.replace(/\s+/g, '').toLowerCase()}-finance@deskora.com`
        }
      ]
    : [])
]);

const invoices: InvoiceRecord[] = [
  makeInvoice(tenantSeeds[0], clients[0].id, 'INV-2026-001', 214000, 'paid', 'Dedicated desks - 15'),
  makeInvoice(tenantSeeds[1], clients[1].id, 'INV-2026-002', 178000, 'sent', 'Private cabins - 12'),
  makeInvoice(tenantSeeds[2], clients[2].id, 'INV-2026-003', 236000, 'overdue', 'Executive workspace - 14'),
  makeInvoice(tenantSeeds[3], clients[3].id, 'INV-2026-004', 162000, 'paid', 'Team seats - 12'),
  makeInvoice(tenantSeeds[4], clients[4].id, 'INV-2026-005', 129000, 'sent', 'Creative studio seats - 9')
];

const payments: PaymentRecord[] = [
  { id: uuid(), tenantId: tenantSeeds[0].tenantId, companyId: tenantSeeds[0].companyId, invoiceId: invoices[0].id, amount: invoices[0].total, status: 'paid', method: 'razorpay', paidAt: now.toISOString(), referenceId: 'RZP-10482', subscriptionTier: 'business' },
  { id: uuid(), tenantId: tenantSeeds[1].tenantId, companyId: tenantSeeds[1].companyId, invoiceId: invoices[1].id, amount: invoices[1].total, status: 'pending', method: 'stripe', paidAt: null, referenceId: 'STR-88712', subscriptionTier: 'enterprise' },
  { id: uuid(), tenantId: tenantSeeds[2].tenantId, companyId: tenantSeeds[2].companyId, invoiceId: invoices[2].id, amount: invoices[2].total, status: 'overdue', method: 'upi', paidAt: null, referenceId: 'UPI-55190', subscriptionTier: 'business' },
  { id: uuid(), tenantId: tenantSeeds[3].tenantId, companyId: tenantSeeds[3].companyId, invoiceId: invoices[3].id, amount: invoices[3].total, status: 'refunded', method: 'card', paidAt: now.toISOString(), referenceId: 'CARD-22117', subscriptionTier: 'starter' },
  { id: uuid(), tenantId: tenantSeeds[4].tenantId, companyId: tenantSeeds[4].companyId, invoiceId: invoices[4].id, amount: invoices[4].total, status: 'failed', method: 'net_banking', paidAt: null, referenceId: 'NB-77120', subscriptionTier: 'business' }
];

const feedback: FeedbackRecord[] = [
  { id: uuid(), tenantId: tenantSeeds[0].tenantId, companyId: tenantSeeds[0].companyId, branchId: tenantSeeds[0].branchId, clientId: clients[0].id, rating: 5, category: 'workspace', message: 'Loved the open floor visibility and responsive support.', sentiment: 'positive', createdAt: now.toISOString() },
  { id: uuid(), tenantId: tenantSeeds[1].tenantId, companyId: tenantSeeds[1].companyId, branchId: tenantSeeds[1].branchId, clientId: clients[1].id, rating: 4, category: 'meeting_room', message: 'Meeting rooms are clean, but one cabin needed a quick AV fix.', sentiment: 'neutral', createdAt: now.toISOString() },
  { id: uuid(), tenantId: tenantSeeds[2].tenantId, companyId: tenantSeeds[2].companyId, branchId: tenantSeeds[2].branchId, clientId: clients[2].id, rating: 3, category: 'maintenance', message: 'The lounge lighting could be improved during peak hours.', sentiment: 'neutral', createdAt: now.toISOString() },
  { id: uuid(), tenantId: tenantSeeds[3].tenantId, companyId: tenantSeeds[3].companyId, branchId: tenantSeeds[3].branchId, clientId: clients[3].id, rating: 5, category: 'workspace', message: 'Premium experience and excellent front desk workflow.', sentiment: 'positive', createdAt: now.toISOString() },
  { id: uuid(), tenantId: tenantSeeds[4].tenantId, companyId: tenantSeeds[4].companyId, branchId: tenantSeeds[4].branchId, clientId: clients[4].id, rating: 4, category: 'suggestion', message: 'Would love more private pods for deep work.', sentiment: 'positive', createdAt: now.toISOString() }
];

const visitors: VisitorRecord[] = [
  {
    id: uuid(),
    tenantId: tenantSeeds[0].tenantId,
    companyId: tenantSeeds[0].companyId,
    branchId: tenantSeeds[0].branchId,
    passId: 'VIS-2041',
    visitorName: 'Ananya Reddy',
    purpose: 'Client meeting',
    hostName: 'NovaHub Operations',
    workspaceLocation: 'Atlas Meeting Room',
    checkInAt: new Date(now.getTime() - 45 * 60 * 1000).toISOString(),
    checkOutAt: null,
    status: 'checked_in'
  },
  {
    id: uuid(),
    tenantId: tenantSeeds[0].tenantId,
    companyId: tenantSeeds[0].companyId,
    branchId: tenantSeeds[0].branchId,
    passId: 'VIS-2038',
    visitorName: 'Rahul Menon',
    purpose: 'Workspace tour',
    hostName: 'Sales Desk',
    workspaceLocation: 'Bloom Commons',
    checkInAt: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(),
    checkOutAt: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
    status: 'checked_out'
  },
  {
    id: uuid(),
    tenantId: tenantSeeds[1].tenantId,
    companyId: tenantSeeds[1].companyId,
    branchId: tenantSeeds[1].branchId,
    passId: 'VIS-2055',
    visitorName: 'Priya Nair',
    purpose: 'Investor visit',
    hostName: 'AetherSpace Admin',
    workspaceLocation: 'Control Rooms',
    checkInAt: new Date(now.getTime() - 20 * 60 * 1000).toISOString(),
    checkOutAt: null,
    status: 'checked_in'
  }
];

const notifications: NotificationRecord[] = [
  { id: uuid(), tenantId: tenantSeeds[0].tenantId, companyId: tenantSeeds[0].companyId, type: 'payment', title: 'Payment received', body: 'Invoice INV-2026-001 was marked as paid.', createdAt: now.toISOString() },
  { id: uuid(), tenantId: tenantSeeds[0].tenantId, companyId: tenantSeeds[0].companyId, type: 'booking', title: 'Seat reserved', body: 'A window seat was reserved for NovaHub members.', createdAt: now.toISOString() },
  { id: uuid(), tenantId: tenantSeeds[1].tenantId, companyId: tenantSeeds[1].companyId, type: 'renewal', title: 'Renewal reminder triggered', body: 'AetherSpace renewal is due in 5 days.', createdAt: now.toISOString() },
  { id: uuid(), tenantId: tenantSeeds[2].tenantId, companyId: tenantSeeds[2].companyId, type: 'booking', title: 'Meeting room booked', body: 'OrbitWorks boardroom scheduled for investor demo.', createdAt: now.toISOString() },
  { id: uuid(), tenantId: tenantSeeds[3].tenantId, companyId: tenantSeeds[3].companyId, type: 'payment', title: 'Invoice overdue', body: 'ZenithDesk invoice INV-2026-004 needs follow-up.', createdAt: now.toISOString() },
  { id: uuid(), tenantId: tenantSeeds[4].tenantId, companyId: tenantSeeds[4].companyId, type: 'payment', title: 'Wallet payment failed', body: 'PixelForge subscription payment needs a retry.', createdAt: now.toISOString() }
];

const subscriptions: SubscriptionRecord[] = [
  { id: uuid(), tenantId: tenantSeeds[0].tenantId, companyId: tenantSeeds[0].companyId, tier: 'business', renewalDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(), autoRenew: true, status: 'expiring' },
  { id: uuid(), tenantId: tenantSeeds[1].tenantId, companyId: tenantSeeds[1].companyId, tier: 'enterprise', renewalDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(), autoRenew: true, status: 'active' },
  { id: uuid(), tenantId: tenantSeeds[2].tenantId, companyId: tenantSeeds[2].companyId, tier: 'business', renewalDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(), autoRenew: false, status: 'expiring' },
  { id: uuid(), tenantId: tenantSeeds[3].tenantId, companyId: tenantSeeds[3].companyId, tier: 'starter', renewalDate: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(), autoRenew: true, status: 'expired' },
  { id: uuid(), tenantId: tenantSeeds[4].tenantId, companyId: tenantSeeds[4].companyId, tier: 'business', renewalDate: new Date(now.getTime() + 9 * 24 * 60 * 60 * 1000).toISOString(), autoRenew: true, status: 'active' }
];

export const seedData: TenantData = {
  users,
  companies,
  branches,
  seats,
  meetingRooms,
  bookings: [
    { id: uuid(), tenantId: tenantSeeds[0].tenantId, companyId: tenantSeeds[0].companyId, branchId: tenantSeeds[0].branchId, resourceType: 'seat', resourceId: seats[0].id, customerName: 'NovaHub team', startAt: now.toISOString(), endAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(), status: 'booked' },
    { id: uuid(), tenantId: tenantSeeds[1].tenantId, companyId: tenantSeeds[1].companyId, branchId: tenantSeeds[1].branchId, resourceType: 'meeting_room', resourceId: meetingRooms[1].id, customerName: 'AetherSpace design review', startAt: now.toISOString(), endAt: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(), status: 'booked' },
    { id: uuid(), tenantId: tenantSeeds[2].tenantId, companyId: tenantSeeds[2].companyId, branchId: tenantSeeds[2].branchId, resourceType: 'seat', resourceId: seats[60]?.id ?? seats[0].id, customerName: 'OrbitWorks visitors', startAt: now.toISOString(), endAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(), status: 'reserved' }
  ],
  clients,
  employees,
  invoices,
  payments,
  feedback,
  subscriptions,
  notifications,
  visitors
};
