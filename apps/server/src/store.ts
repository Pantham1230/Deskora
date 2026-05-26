import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { hasTimeOverlap, validateMeetingTimeRange } from './bookingValidation.js';
import { seedData } from './seed.js';
import type {
  AuthClaims,
  BookingRecord,
  BranchRecord,
  FeedbackRecord,
  ClientRecord,
  CompanyRecord,
  EmployeeRecord,
  InvoiceRecord,
  HeatmapCellRecord,
  MeetingRoomRecord,
  NotificationRecord,
  SmartInsightRecord,
  Role,
  SeatRecord,
  SubscriptionRecord,
  TenantData,
  UserRecord,
  VisitorRecord
} from './types.js';
import { CANCELLATION_WINDOW_MS } from './config.js';

const data: TenantData = structuredClone(seedData);

const fallbackWorkspaceImages = [
  'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1517502884422-41eaead166d4?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1497366412874-3415097a27e7?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1600&q=80'
];

const roomGalleryImages = [
  'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1531973576160-7125cd663d86?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1600&q=80'
];

function assertTenant(tenantId: string | null, resourceTenantId: string): void {
  if (tenantId && tenantId !== resourceTenantId) {
    throw new Error('Tenant access denied.');
  }
}

function userView(user: UserRecord): Omit<UserRecord, 'passwordHash'> {
  const { passwordHash, ...rest } = user;
  return rest;
}

function calculateOccupancy(seats: SeatRecord[]): number {
  if (seats.length === 0) return 0;
  const occupied = seats.filter((seat) => seat.status !== 'available').length;
  return Math.round((occupied / seats.length) * 100);
}

function formatRupees(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

function pickWorkspaceImage(branch: BranchRecord, index = 0): string {
  const images = [branch.heroImageUrl, ...(branch.galleryImageUrls ?? [])].filter((value): value is string => Boolean(value));
  return images[index % images.length] ?? fallbackWorkspaceImages[Math.abs(index) % fallbackWorkspaceImages.length];
}

function aggregateRevenue(invoices: InvoiceRecord[], payments: { amount: number; status: string }[]): number {
  const paidInvoices = invoices.filter((invoice) => invoice.status === 'paid').reduce((sum, invoice) => sum + invoice.total, 0);
  const paidPayments = payments.filter((payment) => payment.status === 'paid').reduce((sum, payment) => sum + payment.amount, 0);
  return paidInvoices + paidPayments;
}

function buildAmenities(branch: BranchRecord, meetingRooms: MeetingRoomRecord[], seats: SeatRecord[]) {
  const base = ['High-speed internet', 'Air conditioning'];
  if (meetingRooms.some((room) => room.branchId === branch.id)) base.push('Meeting rooms');
  if (seats.some((seat) => seat.branchId === branch.id && seat.zone.toLowerCase().includes('lounge'))) base.push('Lounge access');
  if (branch.floors > 3) base.push('Dedicated reception');
  if (branch.seatCount > 40) base.push('Enterprise seating');
  return base.slice(0, 5);
}

function buildWorkspaceSpaces(branch: BranchRecord, seats: SeatRecord[], meetingRooms: MeetingRoomRecord[]) {
  const branchSeats = seats.filter((seat) => seat.branchId === branch.id);
  const branchRooms = meetingRooms.filter((room) => room.branchId === branch.id);
  const availableDesks = branchSeats.filter((seat) => seat.status === 'available').length;
  const loungeSeats = branchSeats.filter((seat) => seat.zone.toLowerCase().includes('lounge')).length;
  const cabinSeats = branchSeats.filter((seat) => seat.zone.toLowerCase().includes('cabin')).length || Math.max(4, Math.round(branch.seatCount * 0.18));
  const deskZones = branchSeats.filter((seat) => seat.zone.toLowerCase().includes('open') || seat.zone.toLowerCase().includes('desk') || seat.zone.toLowerCase().includes('commons')).length || Math.max(6, Math.round(branch.seatCount * 0.45));
  const eventCapacity = Math.max(20, Math.round(branch.seatCount * 0.75));
  const meetingRoomCount = branchRooms.length || branch.meetingRoomCount || 1;

  return [
    {
      id: `${branch.id}-meeting-rooms`,
      category: 'Meeting Rooms',
      name: branchRooms[0]?.name ?? 'Meeting Room Suite',
      capacity: branchRooms.reduce((max, room) => Math.max(max, room.capacity), 0) || 8,
      pricingLabel: branchRooms.length ? `From ${formatRupees(Math.min(...branchRooms.map((room) => room.hourlyRate)))}/hr` : `${formatRupees(Math.round(branch.pricingPerSeat * 0.22))}/hr`,
      availabilityLabel: `${meetingRoomCount} room${meetingRoomCount === 1 ? '' : 's'} available`,
      amenities: ['Video conferencing', 'Whiteboard', 'Acoustic panels'],
      imageUrl: branchRooms[0]?.imageUrl ?? pickWorkspaceImage(branch, 1)
    },
    {
      id: `${branch.id}-executive-cabins`,
      category: 'Executive Cabins',
      name: `${branch.name} Cabins`,
      capacity: 4,
      pricingLabel: `${formatRupees(Math.round(branch.pricingPerSeat * 1.6))}/month`,
      availabilityLabel: `${Math.max(1, Math.ceil(cabinSeats / 4))} cabins ready`,
      amenities: ['Private access', 'Premium workstations', 'Lockable storage'],
      imageUrl: pickWorkspaceImage(branch, 2)
    },
    {
      id: `${branch.id}-dedicated-desks`,
      category: 'Dedicated Desk Zones',
      name: `${branch.city} Desk Zone`,
      capacity: Math.max(8, Math.round(branch.seatCount * 0.3)),
      pricingLabel: `${formatRupees(branch.pricingPerSeat)}/desk/month`,
      availabilityLabel: `${Math.max(availableDesks, deskZones)} desks open`,
      amenities: ['24/7 access', 'Mail handling', 'Shared storage'],
      imageUrl: pickWorkspaceImage(branch, 3)
    },
    {
      id: `${branch.id}-open-workspace`,
      category: 'Open Workspace Areas',
      name: `${branch.city} Open Floor`,
      capacity: Math.max(12, Math.round(branch.seatCount * 0.55)),
      pricingLabel: `${formatRupees(Math.round(branch.pricingPerSeat * 0.95))}/desk/month`,
      availabilityLabel: `${availableDesks} open seats`,
      amenities: ['Flexible seating', 'Quiet zones', 'Community events'],
      imageUrl: pickWorkspaceImage(branch, 0)
    },
    {
      id: `${branch.id}-event-hall`,
      category: 'Event Halls',
      name: `${branch.name} Event Hall`,
      capacity: eventCapacity,
      pricingLabel: `${formatRupees(Math.round(branch.pricingPerSeat * 4.5))}/event`,
      availabilityLabel: branch.floors > 2 ? 'Available on request' : 'Select dates only',
      amenities: ['Stage lighting', 'AV support', 'Catering ready'],
      imageUrl: pickWorkspaceImage(branch, 4)
    },
    {
      id: `${branch.id}-collaboration-lounge`,
      category: 'Collaboration Lounges',
      name: `${branch.name} Lounge`,
      capacity: Math.max(10, loungeSeats || Math.round(branch.seatCount * 0.25)),
      pricingLabel: 'Included with membership',
      availabilityLabel: 'Open throughout the day',
      amenities: ['Coffee bar', 'Soft seating', 'Team meetups'],
      imageUrl: pickWorkspaceImage(branch, 1)
    }
  ];
}

function buildPublicWorkspace(branch: BranchRecord, company: CompanyRecord, seats: SeatRecord[], meetingRooms: MeetingRoomRecord[], feedback: FeedbackRecord[]) {
  const branchSeats = seats.filter((seat) => seat.branchId === branch.id);
  const branchRooms = meetingRooms.filter((room) => room.branchId === branch.id);
  const occupancyRate = calculateOccupancy(branchSeats);
  const availableSeats = branchSeats.filter((seat) => seat.status === 'available').length;
  const branchFeedback = feedback.filter((item) => item.branchId === branch.id);
  const rating = branchFeedback.length ? branchFeedback.reduce((sum, item) => sum + item.rating, 0) / branchFeedback.length : Math.max(4.1, 4.4 - (occupancyRate > 85 ? 0.15 : 0));
  const galleryImageUrls = [branch.heroImageUrl, ...(branch.galleryImageUrls ?? [])].filter((value): value is string => Boolean(value));
  return {
    company,
    branch,
    verificationStatus: branch.verificationStatus ?? 'verified',
    description: branch.description ?? `${company.name} ${branch.city} offers a premium coworking center built for flexible teams and focused work.`,
    occupancyRate,
    availableSeats,
    availableDesks: availableSeats,
    rating: Number(rating.toFixed(1)),
    pricingMin: Math.round(branch.pricingPerSeat * 0.9),
    pricingMax: Math.round(branch.pricingPerSeat * 1.35),
    amenities: buildAmenities(branch, meetingRooms, seats),
    meetingRooms: branchRooms.length,
    meetingRoomCount: branch.meetingRoomCount ?? branchRooms.length,
    totalSeats: branchSeats.length,
    gallerySeed: branch.id,
    heroImageUrl: branch.heroImageUrl ?? pickWorkspaceImage(branch, 0),
    galleryImageUrls: galleryImageUrls.length ? galleryImageUrls : [pickWorkspaceImage(branch, 0), pickWorkspaceImage(branch, 1), pickWorkspaceImage(branch, 2)],
    operatingHours: 'Mon-Sat · 8:00 AM - 8:00 PM',
    locationMapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${branch.name} ${branch.city} ${branch.address}`)}`,
    rooms: branchRooms.slice(0, 3).map((room) => ({
      name: room.name,
      capacity: room.capacity,
      hourlyRate: room.hourlyRate,
      status: 'available' as const,
      imageUrl: room.imageUrl ?? roomGalleryImages[branchRooms.indexOf(room) % roomGalleryImages.length]
    })),
    spaces: buildWorkspaceSpaces(branch, branchSeats, branchRooms),
    seatPreview: branchSeats.slice(0, 6).map((seat) => ({
      label: seat.label,
      floor: seat.floor,
      zone: seat.zone,
      status: seat.status
    })),
    reviews: branchFeedback.slice(0, 3).map((review) => ({
      rating: review.rating,
      message: review.message,
      createdAt: review.createdAt
    }))
  };
}

function buildHeatmap(branches: BranchRecord[], seats: SeatRecord[]): HeatmapCellRecord[] {
  return branches.flatMap((branch) => {
    const branchSeats = seats.filter((seat) => seat.branchId === branch.id);
    const zones = Array.from(new Set(branchSeats.map((seat) => seat.zone)));
    return zones.map((zone) => {
      const zoneSeats = branchSeats.filter((seat) => seat.zone === zone);
      const occupied = zoneSeats.filter((seat) => seat.status !== 'available').length;
      const intensity = zoneSeats.length === 0 ? 0 : Math.round((occupied / zoneSeats.length) * 100);
      return {
        id: `${branch.id}-${zone}`,
        branchId: branch.id,
        zone,
        intensity,
        label: `${zone} · ${intensity}%`
      };
    });
  });
}

function buildInsights(branches: BranchRecord[], invoices: InvoiceRecord[], payments: { amount: number; status: string }[], subscriptions: SubscriptionRecord[], feedback: FeedbackRecord[]): SmartInsightRecord[] {
  const branchRevenue = branches.map((branch) => ({
    branch,
    revenue: invoices.filter((invoice) => invoice.branchId === branch.id && invoice.status === 'paid').reduce((sum, invoice) => sum + invoice.total, 0)
  })).sort((left, right) => right.revenue - left.revenue);

  const busiestBranch = branches.reduce<{ branch: BranchRecord | null; occupancy: number }>((accumulator, branch) => {
    const branchBookings = invoices.filter((invoice) => invoice.branchId === branch.id).length;
    const occupancy = Math.min(100, Math.round((branchBookings / Math.max(branch.seatCount, 1)) * 100 + 55));
    return occupancy > accumulator.occupancy ? { branch, occupancy } : accumulator;
  }, { branch: null, occupancy: 0 });

  const expiringSubscriptions = subscriptions.filter((subscription) => subscription.status === 'expiring' || subscription.status === 'expired').length;
  const ratingByBranch = feedback.reduce<Record<string, { total: number; count: number }>>((accumulator, item) => {
    accumulator[item.branchId] = accumulator[item.branchId] ?? { total: 0, count: 0 };
    accumulator[item.branchId].total += item.rating;
    accumulator[item.branchId].count += 1;
    return accumulator;
  }, {});
  const bestBranchId = Object.entries(ratingByBranch).sort((left, right) => (right[1].total / right[1].count) - (left[1].total / left[1].count))[0]?.[0];
  const bestBranch = branches.find((branch) => branch.id === bestBranchId);

  return [
    {
      id: 'insight-occupancy',
      title: busiestBranch.branch ? `${busiestBranch.branch.name} reached ${busiestBranch.occupancy}% occupancy this week` : 'Occupancy is stabilizing across the portfolio',
      detail: 'Digital twin occupancy and booking depth are updating live across the selected tenant.',
      tone: 'success'
    },
    {
      id: 'insight-revenue',
      title: branchRevenue[0] ? `${branchRevenue[0].branch.city} generated the strongest revenue momentum` : 'Revenue is tracking steadily',
      detail: `Paid invoices and transactions have collected ₹${aggregateRevenue(invoices, payments).toLocaleString()} so far.`,
      tone: 'info'
    },
    {
      id: 'insight-renewals',
      title: `${expiringSubscriptions} renewals are due in the next 5 days`,
      detail: 'Auto-renew reminders are primed for subscriptions that need finance follow-up.',
      tone: 'accent'
    },
    {
      id: 'insight-rating',
      title: bestBranch ? `${bestBranch.name} is the highest-rated location` : 'Customer satisfaction is trending upward',
      detail: 'Feedback scores are being combined into branch experience metrics for the analytics panel.',
      tone: 'success'
    },
    {
      id: 'insight-demand',
      title: 'Private cabins continue to show the highest booking demand',
      detail: 'Zone-level heatmaps show the strongest occupancy in private and focused workspaces.',
      tone: 'warning'
    }
  ];
}

function nextInvoiceNumber(existing: InvoiceRecord[]): string {
  const sequence = existing.length + 1;
  return `INV-2026-${String(sequence).padStart(3, '0')}`;
}

function createNotification(payload: Omit<NotificationRecord, 'id' | 'createdAt'>): NotificationRecord {
  return { ...payload, id: uuid(), createdAt: new Date().toISOString() };
}

function nextVisitorPassId(): string {
  const sequence = data.visitors.length + 2040;
  return `VIS-${sequence}`;
}

export const repository = {
  data,
  findUserByEmail(email: string): UserRecord | undefined {
    return data.users.find((user) => user.email.toLowerCase() === email.toLowerCase());
  },
  findUserById(id: string): UserRecord | undefined {
    return data.users.find((user) => user.id === id);
  },
  listCompanies(claims: AuthClaims): CompanyRecord[] {
    return claims.role === 'admin' ? data.companies : data.companies.filter((company) => company.tenantId === claims.tenantId);
  },
  getTenantOverview(claims: AuthClaims) {
    const companyIds = claims.role === 'admin' ? data.companies.map((company) => company.id) : [claims.companyId].filter(Boolean) as string[];
    const seats = data.seats.filter((seat) => companyIds.includes(seat.companyId));
    const branches = data.branches.filter((branch) => companyIds.includes(branch.companyId));
    const clients = data.clients.filter((client) => companyIds.includes(client.companyId));
    const invoices = data.invoices.filter((invoice) => companyIds.includes(invoice.companyId));
    const payments = data.payments.filter((payment) => companyIds.includes(data.invoices.find((invoice) => invoice.id === payment.invoiceId)?.companyId ?? ''));
    const feedback = data.feedback.filter((item) => companyIds.includes(item.companyId));
    const subscriptions = data.subscriptions.filter((item) => companyIds.includes(item.companyId));

    const branchStats = branches.map((branch) => {
      const branchSeats = seats.filter((seat) => seat.branchId === branch.id);
      const branchFeedback = feedback.filter((item) => item.branchId === branch.id);
      const averageRating = branchFeedback.length === 0 ? 0 : branchFeedback.reduce((sum, item) => sum + item.rating, 0) / branchFeedback.length;
      return {
        ...branch,
        occupancyRate: calculateOccupancy(branchSeats),
        bookedSeats: branchSeats.filter((seat) => seat.status === 'booked').length,
        reservedSeats: branchSeats.filter((seat) => seat.status === 'reserved').length,
        averageRating,
        experienceScore: Math.round((averageRating * 18) + calculateOccupancy(branchSeats) * 0.65),
        layoutTone: branch.floors > 4 ? 'vertical' : branch.seatCount > 40 ? 'campus' : 'balanced'
      };
    });

    const heatmap = buildHeatmap(branches, seats);
    const insights = buildInsights(branches, invoices, payments.map((payment) => ({ amount: payment.amount, status: payment.status })), subscriptions, feedback);

    return {
      totals: {
        companies: companyIds.length,
        branches: branches.length,
        seats: seats.length,
        activeClients: clients.filter((client) => client.stage === 'active').length,
        revenue: aggregateRevenue(invoices, payments),
        occupancyRate: calculateOccupancy(seats)
      },
      branchStats,
      recentNotifications: data.notifications.filter((notification) => companyIds.includes(notification.companyId)).slice(0, 6),
      clients,
      invoices,
      payments: payments.map((payment) => ({
        invoiceId: payment.invoiceId,
        amount: payment.amount,
        status: payment.status,
        method: payment.method ?? 'upi',
        referenceId: payment.referenceId ?? '',
        paidAt: payment.paidAt,
        subscriptionTier: payment.subscriptionTier ?? 'business'
      })),
      feedback,
      insights,
      heatmap,
      subscriptions
    };
  },
  createCompany(name: string, industry: string, admin: { name: string; email: string; password: string; role: Role }): { company: CompanyRecord; user: Omit<UserRecord, 'passwordHash'> } {
    const companyId = uuid();
    const tenantId = `tenant-${companyId.slice(0, 8)}`;
    const company: CompanyRecord = { id: companyId, tenantId, name, industry, status: 'active', createdAt: new Date().toISOString() };
    const user: UserRecord = {
      id: uuid(),
      tenantId,
      companyId,
      branchId: null,
      name: admin.name,
      email: admin.email,
      passwordHash: bcrypt.hashSync(admin.password, 10),
      role: admin.role
    };
    data.companies.push(company);
    data.users.push(user);
    return { company, user: userView(user) };
  },
  createClientUser(payload: { name: string; email: string; password: string; role: Role }): { user: Omit<UserRecord, 'passwordHash'> } {
    const user: UserRecord = {
      id: uuid(),
      tenantId: 'platform',
      companyId: null,
      branchId: null,
      name: payload.name,
      email: payload.email,
      passwordHash: bcrypt.hashSync(payload.password, 10),
      role: payload.role
    };
    data.users.push(user);
    return { user: userView(user) };
  },
  createWorkspaceUser(payload: { companyId: string; branchId: string; role: Role; name: string; email: string; password: string }): { company: CompanyRecord; branch: BranchRecord; user: Omit<UserRecord, 'passwordHash'> } {
    const company = data.companies.find((item) => item.id === payload.companyId);
    if (!company) throw new Error('Workspace not found.');
    const branch = data.branches.find((item) => item.id === payload.branchId);
    if (!branch || branch.companyId !== company.id) throw new Error('Selected branch does not belong to the chosen workspace.');

    const user: UserRecord = {
      id: uuid(),
      tenantId: company.tenantId,
      companyId: company.id,
      branchId: branch.id,
      name: payload.name,
      email: payload.email,
      passwordHash: bcrypt.hashSync(payload.password, 10),
      role: payload.role
    };
    data.users.push(user);
    return { company, branch, user: userView(user) };
  },
  listPublicWorkspaces() {
    const companies = data.companies.filter((company) => company.status === 'active');
    const branches = data.branches.filter((branch) => companies.some((company) => company.id === branch.companyId));
    return {
      workspaces: branches.map((branch) => {
        const company = companies.find((item) => item.id === branch.companyId)!;
        return buildPublicWorkspace(branch, company, data.seats, data.meetingRooms, data.feedback);
      })
    };
  },
  createBranch(claims: AuthClaims, payload: Omit<BranchRecord, 'id' | 'tenantId'>): BranchRecord {
    const branch: BranchRecord = { ...payload, id: uuid(), tenantId: claims.tenantId, verificationStatus: payload.verificationStatus ?? 'pending' };
    data.branches.push(branch);
    return branch;
  },
  deleteBranch(claims: AuthClaims, branchId: string) {
    const branch = data.branches.find((b) => b.id === branchId);
    if (!branch) throw new Error('Branch not found.');
    if (claims.role !== 'admin' && branch.tenantId !== claims.tenantId) throw new Error('Tenant access denied.');
    const hasActive = this.branchHasActiveOccupancy(branchId);
    if (hasActive) throw new Error('Cannot delete branch with active occupancy or bookings.');
    data.branches = data.branches.filter((b) => b.id !== branchId);
    data.seats = data.seats.filter((s) => s.branchId !== branchId);
    data.meetingRooms = data.meetingRooms.filter((r) => r.branchId !== branchId);
    return { id: branchId };
  },
  listBranches(claims: AuthClaims): BranchRecord[] {
    if (claims.role === 'client') return data.branches;
    return data.branches.filter((branch) => claims.role === 'admin' || branch.tenantId === claims.tenantId);
  },
  listSeats(claims: AuthClaims, branchId?: string): SeatRecord[] {
    const bookingsBySeatId = new Map<string, BookingRecord>();
    data.bookings
      .filter((booking) => booking.resourceType === 'seat' && booking.status === 'booked')
      .forEach((booking) => bookingsBySeatId.set(booking.resourceId, booking));

    return data.seats
      .filter((seat) => (claims.role === 'admin' || claims.role === 'client' || seat.tenantId === claims.tenantId) && (!branchId || seat.branchId === branchId))
      .map((seat) => {
        const booking = bookingsBySeatId.get(seat.id);
        const bookedByCurrentUser = Boolean(booking && booking.customerName === claims.userId);
        return {
          ...seat,
          bookedByCurrentUser,
          canCancel: bookedByCurrentUser
        };
      });
  },
  bookSeat(claims: AuthClaims, seatId: string, customerName: string): SeatRecord {
    const seat = data.seats.find((item) => item.id === seatId);
    if (!seat) throw new Error('Seat not found.');
    if (claims.role !== 'client') {
      assertTenant(claims.tenantId, seat.tenantId);
    }
    if (seat.status === 'booked') throw new Error('Seat already booked.');

    seat.status = 'booked';
    const bookingStart = new Date(Date.now() + CANCELLATION_WINDOW_MS + 60_000);
    const bookingEnd = new Date(bookingStart.getTime() + 24 * 60 * 60 * 1000);
    const bookingId = uuid();
    data.bookings.push({
      id: bookingId,
      tenantId: seat.tenantId,
      companyId: seat.companyId,
      branchId: seat.branchId,
      resourceType: 'seat',
      resourceId: seat.id,
      customerName: claims.userId,
      startAt: bookingStart.toISOString(),
      endAt: bookingEnd.toISOString(),
      status: 'booked',
      notes: customerName
    });

    const user = data.users.find((item) => item.id === claims.userId);
    let client = data.clients.find((item) => item.email.toLowerCase() === (user?.email ?? claims.email).toLowerCase() && item.companyId === seat.companyId);
    if (!client) {
      client = {
        id: uuid(),
        tenantId: seat.tenantId,
        companyId: seat.companyId,
        name: user?.name ?? customerName,
        contactName: user?.name ?? customerName,
        email: user?.email ?? claims.email,
        stage: 'active',
        lastTouchAt: new Date().toISOString()
      };
      data.clients.push(client);
    }

    const invoiceNumber = nextInvoiceNumber(data.invoices);
    const invoice: InvoiceRecord = {
      id: uuid(),
      tenantId: seat.tenantId,
      companyId: seat.companyId,
      branchId: seat.branchId,
      clientId: client.id,
      invoiceNumber,
      status: 'sent',
      issueDate: bookingStart.toISOString(),
      dueDate: new Date(bookingStart.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      total: Math.round((data.branches.find((branch) => branch.id === seat.branchId)?.pricingPerSeat ?? 0) / 30),
      lineItems: [{ label: `Desk booking ${seat.label}`, quantity: 1, rate: Math.round((data.branches.find((branch) => branch.id === seat.branchId)?.pricingPerSeat ?? 0) / 30) }]
    };
    data.invoices.push(invoice);
    data.payments.push({
      id: uuid(),
      tenantId: seat.tenantId,
      companyId: seat.companyId,
      invoiceId: invoice.id,
      amount: invoice.total,
      status: 'pending',
      paidAt: null
    });

    data.notifications.unshift(createNotification({
      tenantId: seat.tenantId,
      companyId: seat.companyId,
      type: 'booking',
      title: 'Seat booking confirmed',
      body: `${seat.label} was booked for ${user?.name ?? customerName}.`
    }));
    data.notifications.unshift(createNotification({
      tenantId: seat.tenantId,
      companyId: seat.companyId,
      type: 'payment',
      title: 'Invoice generated',
      body: `${invoiceNumber} created for seat booking ${seat.label}.`
    }));
    return { ...seat, bookedByCurrentUser: true, canCancel: true };
  },
  listMeetingRooms(claims: AuthClaims, branchId?: string): MeetingRoomRecord[] {
    return data.meetingRooms.filter((room) => (claims.role === 'admin' || claims.role === 'client' || room.tenantId === claims.tenantId) && (!branchId || room.branchId === branchId));
  },
  deleteMeetingRoom(claims: AuthClaims, roomId: string) {
    const room = data.meetingRooms.find((r) => r.id === roomId);
    if (!room) throw new Error('Meeting room not found.');
    if (claims.role !== 'admin' && room.tenantId !== claims.tenantId) throw new Error('Tenant access denied.');
    const hasActive = this.roomHasActiveBooking(roomId);
    if (hasActive) throw new Error('Cannot delete meeting room while it has active bookings.');
    data.meetingRooms = data.meetingRooms.filter((r) => r.id !== roomId);
    data.bookings = data.bookings.filter((b) => !(b.resourceType === 'meeting_room' && b.resourceId === roomId));
    return { id: roomId };
  },
  bookMeetingRoom(claims: AuthClaims, roomId: string, customerName: string, startAt: string, endAt: string): BookingRecord {
    const room = data.meetingRooms.find((item) => item.id === roomId);
    if (!room) throw new Error('Meeting room not found.');
    if (claims.role !== 'client') {
      assertTenant(claims.tenantId, room.tenantId);
    }

    validateMeetingTimeRange(startAt, endAt);
    const roomBookings = data.bookings.filter((booking) => booking.resourceType === 'meeting_room' && booking.resourceId === roomId);
    if (hasTimeOverlap(roomBookings, startAt, endAt)) {
      throw new Error('This time slot overlaps with an existing booking.');
    }

    const booking: BookingRecord = {
      id: uuid(),
      tenantId: room.tenantId,
      companyId: room.companyId,
      branchId: room.branchId,
      resourceType: 'meeting_room',
      resourceId: room.id,
      customerName: claims.userId,
      startAt,
      endAt,
      status: 'booked',
      notes: customerName
    };
    data.bookings.push(booking);

    const start = new Date(startAt).getTime();
    const end = new Date(endAt).getTime();
    const durationHours = Math.max(1, Math.ceil((end - start) / (60 * 60 * 1000)));
    const user = data.users.find((item) => item.id === claims.userId);
    let client = data.clients.find((item) => item.email.toLowerCase() === (user?.email ?? claims.email).toLowerCase() && item.companyId === room.companyId);
    if (!client) {
      client = {
        id: uuid(),
        tenantId: room.tenantId,
        companyId: room.companyId,
        name: user?.name ?? customerName,
        contactName: user?.name ?? customerName,
        email: user?.email ?? claims.email,
        stage: 'active',
        lastTouchAt: new Date().toISOString()
      };
      data.clients.push(client);
    }
    const invoiceNumber = nextInvoiceNumber(data.invoices);
    const invoice: InvoiceRecord = {
      id: uuid(),
      tenantId: room.tenantId,
      companyId: room.companyId,
      branchId: room.branchId,
      clientId: client.id,
      invoiceNumber,
      status: 'sent',
      issueDate: new Date().toISOString(),
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      total: room.hourlyRate * durationHours,
      lineItems: [{ label: `Meeting room booking ${room.name}`, quantity: durationHours, rate: room.hourlyRate }]
    };
    data.invoices.push(invoice);
    data.payments.push({
      id: uuid(),
      tenantId: room.tenantId,
      companyId: room.companyId,
      invoiceId: invoice.id,
      amount: invoice.total,
      status: 'pending',
      paidAt: null
    });

    data.notifications.unshift(createNotification({
      tenantId: room.tenantId,
      companyId: room.companyId,
      type: 'booking',
      title: 'Meeting room booked',
      body: `${room.name} is reserved for ${user?.name ?? customerName}.`
    }));
    data.notifications.unshift(createNotification({
      tenantId: room.tenantId,
      companyId: room.companyId,
      type: 'payment',
      title: 'Invoice generated',
      body: `${invoiceNumber} created for ${room.name}.`
    }));
    return booking;
  },
  listClients(claims: AuthClaims): ClientRecord[] {
    return data.clients.filter((client) => claims.role === 'admin' || client.tenantId === claims.tenantId);
  },
  createClient(claims: AuthClaims, payload: Omit<ClientRecord, 'id' | 'tenantId' | 'lastTouchAt'>): ClientRecord {
    const client: ClientRecord = { ...payload, id: uuid(), tenantId: claims.tenantId, lastTouchAt: new Date().toISOString() };
    data.clients.push(client);
    return client;
  },
  listEmployees(claims: AuthClaims): EmployeeRecord[] {
    return data.employees.filter((employee) => claims.role === 'admin' || employee.tenantId === claims.tenantId);
  },
  createEmployee(claims: AuthClaims, payload: Omit<EmployeeRecord, 'id' | 'tenantId'>): EmployeeRecord {
    const employee: EmployeeRecord = { ...payload, id: uuid(), tenantId: claims.tenantId };
    data.employees.push(employee);
    return employee;
  },
  listInvoices(claims: AuthClaims): InvoiceRecord[] {
    if (claims.role === 'client') {
      const user = data.users.find((item) => item.id === claims.userId);
      if (!user) return [];
      const clientIds = new Set(
        data.clients
          .filter((client) => client.email.toLowerCase() === user.email.toLowerCase())
          .map((client) => client.id)
      );
      return data.invoices
        .filter((invoice) => clientIds.has(invoice.clientId))
        .sort((left, right) => new Date(right.issueDate).getTime() - new Date(left.issueDate).getTime());
    }
    if (claims.role === 'admin') return data.invoices;
    return data.invoices.filter((invoice) => invoice.tenantId === claims.tenantId);
  },
  listBookings(claims: AuthClaims): BookingRecord[] {
    const bookings = claims.role === 'client'
      ? data.bookings.filter((booking) => booking.customerName === claims.userId)
      : data.bookings.filter((booking) => booking.tenantId === claims.tenantId);
    return bookings.sort((left, right) => new Date(right.startAt).getTime() - new Date(left.startAt).getTime());
  },
  generateInvoice(claims: AuthClaims, payload: { branchId: string; clientId: string; quantity: number; rate: number }): InvoiceRecord {
    const branch = data.branches.find((item) => item.id === payload.branchId);
    const client = data.clients.find((item) => item.id === payload.clientId);
    if (!branch || !client) throw new Error('Branch or client not found.');
    assertTenant(claims.tenantId, branch.tenantId);
    assertTenant(claims.tenantId, client.tenantId);

    const invoice: InvoiceRecord = {
      id: uuid(),
      tenantId: claims.tenantId,
      companyId: branch.companyId,
      branchId: branch.id,
      clientId: client.id,
      invoiceNumber: nextInvoiceNumber(data.invoices),
      status: 'sent',
      issueDate: new Date().toISOString(),
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      total: payload.quantity * payload.rate,
      lineItems: [
        { label: 'Dedicated seat subscription', quantity: payload.quantity, rate: payload.rate }
      ]
    };
    data.invoices.push(invoice);
    data.payments.push({
      id: uuid(),
      tenantId: claims.tenantId,
      companyId: branch.companyId,
      invoiceId: invoice.id,
      amount: invoice.total,
      status: 'pending',
      paidAt: null
    });
    data.notifications.unshift(createNotification({
      tenantId: claims.tenantId,
      companyId: branch.companyId,
      type: 'payment',
      title: 'Invoice generated',
      body: `${invoice.invoiceNumber} is ready for payment tracking.`
    }));
    return invoice;
  },
  listNotifications(claims: AuthClaims): NotificationRecord[] {
    return data.notifications.filter((notification) => claims.role === 'admin' || notification.tenantId === claims.tenantId);
  },
  listVisitors(claims: AuthClaims, branchId?: string): VisitorRecord[] {
    return data.visitors
      .filter((visitor) => {
        if (claims.role !== 'admin' && visitor.tenantId !== claims.tenantId) return false;
        if (branchId && visitor.branchId !== branchId) return false;
        return true;
      })
      .sort((left, right) => new Date(right.checkInAt).getTime() - new Date(left.checkInAt).getTime());
  },
  checkInVisitor(
    claims: AuthClaims,
    payload: { branchId: string; visitorName: string; purpose: string; hostName: string; workspaceLocation: string }
  ): VisitorRecord {
    if (claims.role !== 'admin') throw new Error('Only workspace admins can check in visitors.');
    const branch = data.branches.find((item) => item.id === payload.branchId);
    if (!branch) throw new Error('Branch not found.');
    if (claims.tenantId !== 'platform' && branch.tenantId !== claims.tenantId) {
      throw new Error('Tenant access denied.');
    }
    if (!payload.visitorName?.trim() || !payload.purpose?.trim() || !payload.hostName?.trim() || !payload.workspaceLocation?.trim()) {
      throw new Error('Visitor name, purpose, host, and workspace location are required.');
    }

    const visitor: VisitorRecord = {
      id: uuid(),
      tenantId: branch.tenantId,
      companyId: branch.companyId,
      branchId: branch.id,
      passId: nextVisitorPassId(),
      visitorName: payload.visitorName.trim(),
      purpose: payload.purpose.trim(),
      hostName: payload.hostName.trim(),
      workspaceLocation: payload.workspaceLocation.trim(),
      checkInAt: new Date().toISOString(),
      checkOutAt: null,
      status: 'checked_in'
    };
    data.visitors.unshift(visitor);
    data.notifications.unshift(createNotification({
      tenantId: branch.tenantId,
      companyId: branch.companyId,
      type: 'booking',
      title: 'Visitor checked in',
      body: `${visitor.visitorName} arrived for ${visitor.purpose} (${visitor.passId}).`
    }));
    return visitor;
  },
  checkOutVisitor(claims: AuthClaims, visitorId: string): VisitorRecord {
    if (claims.role !== 'admin') throw new Error('Only workspace admins can check out visitors.');
    const visitor = data.visitors.find((item) => item.id === visitorId);
    if (!visitor) throw new Error('Visitor not found.');
    if (claims.tenantId !== 'platform' && visitor.tenantId !== claims.tenantId) {
      throw new Error('Tenant access denied.');
    }
    if (visitor.status === 'checked_out') throw new Error('Visitor is already checked out.');

    visitor.status = 'checked_out';
    visitor.checkOutAt = new Date().toISOString();
    data.notifications.unshift(createNotification({
      tenantId: visitor.tenantId,
      companyId: visitor.companyId,
      type: 'booking',
      title: 'Visitor checked out',
      body: `${visitor.visitorName} left the workspace (${visitor.passId}).`
    }));
    return visitor;
  },
  authenticate(email: string, password: string): UserRecord | undefined {
    const user = this.findUserByEmail(email);
    if (!user) return undefined;
    return bcrypt.compareSync(password, user.passwordHash) ? user : undefined;
  }
  ,
  cancelSeatBooking(claims: AuthClaims, seatId: string) {
    const booking = data.bookings.find((b) => b.resourceType === 'seat' && b.resourceId === seatId && b.status === 'booked');
    if (!booking) throw new Error('No active booking found for this seat.');
    const startAt = new Date(booking.startAt).getTime();
    const now = Date.now();
    if (startAt <= now) throw new Error('Cannot cancel an ongoing or past booking.');
    if (startAt - now < CANCELLATION_WINDOW_MS) throw new Error(`Cancellations are only allowed at least ${CANCELLATION_WINDOW_MS / (60 * 60 * 1000)} hours before start.`);
    const isOwner = booking.customerName === claims.userId;
    const isAdmin = claims.role === 'admin';
    if (!isOwner && !isAdmin) throw new Error('Insufficient permissions to cancel this booking.');

    booking.status = 'cancelled';
    const seat = data.seats.find((s) => s.id === seatId);
    if (seat) seat.status = 'available';
    data.notifications.unshift(createNotification({ tenantId: booking.tenantId, companyId: booking.companyId, type: 'booking', title: 'Booking cancelled', body: `Seat booking for ${booking.notes ?? booking.customerName} cancelled.` }));
    const refundPercent = claims.role === 'client' ? 0.5 : 1.0;
    const branch = seat ? data.branches.find((b) => b.id === seat.branchId) : undefined;
    const amount = branch ? branch.pricingPerSeat * refundPercent : 0;
    if (amount > 0) {
      data.payments.push({ id: uuid(), tenantId: booking.tenantId, companyId: booking.companyId, invoiceId: null as any, amount, status: 'refunded', paidAt: new Date().toISOString() });
    }
    return booking;
  },
  cancelMeetingRoomBooking(claims: AuthClaims, roomId: string, bookingId?: string) {
    const booking = bookingId ? data.bookings.find((b) => b.id === bookingId && b.resourceType === 'meeting_room') : data.bookings.find((b) => b.resourceType === 'meeting_room' && b.resourceId === roomId && b.status === 'booked');
    if (!booking) throw new Error('No active booking found for this room.');
    const startAt = new Date(booking.startAt).getTime();
    const now = Date.now();
    if (startAt <= now) throw new Error('Cannot cancel an ongoing or past booking.');
    if (startAt - now < CANCELLATION_WINDOW_MS) throw new Error(`Cancellations are only allowed at least ${CANCELLATION_WINDOW_MS / (60 * 60 * 1000)} hours before start.`);
    const isOwner = booking.customerName === claims.userId;
    const isAdmin = claims.role === 'admin';
    if (!isOwner && !isAdmin) throw new Error('Insufficient permissions to cancel this booking.');

    booking.status = 'cancelled';
    data.notifications.unshift(createNotification({ tenantId: booking.tenantId, companyId: booking.companyId, type: 'booking', title: 'Meeting cancelled', body: `Meeting for ${booking.customerName} cancelled.` }));
    const room = data.meetingRooms.find((r) => r.id === roomId);
    let amount = 0;
    if (room) {
      const start = new Date(booking.startAt).getTime();
      const end = new Date(booking.endAt).getTime();
      const hours = Math.max(1, Math.ceil((end - start) / (60 * 60 * 1000)));
      const refundPercent = claims.role === 'client' ? 0.5 : 1.0;
      amount = room.hourlyRate * hours * refundPercent;
      data.payments.push({ id: uuid(), tenantId: booking.tenantId, companyId: booking.companyId, invoiceId: null as any, amount, status: 'refunded', paidAt: new Date().toISOString() });
    }
    return booking;
  },
  branchHasActiveOccupancy(branchId: string) {
    const hasSeat = data.seats.some((s) => s.branchId === branchId && s.status === 'booked');
    if (hasSeat) return true;
    const hasMeeting = data.bookings.some((b) => b.branchId === branchId && b.resourceType === 'meeting_room' && b.status === 'booked' && new Date(b.startAt).getTime() <= Date.now() && new Date(b.endAt).getTime() >= Date.now());
    return hasMeeting;
  },
  roomHasActiveBooking(roomId: string) {
    return data.bookings.some((b) => b.resourceType === 'meeting_room' && b.resourceId === roomId && b.status === 'booked' && new Date(b.startAt).getTime() <= Date.now() && new Date(b.endAt).getTime() >= Date.now());
  }
};

export function buildClaims(user: UserRecord): AuthClaims {
  const normalizedRole: AuthClaims['role'] = ((): AuthClaims['role'] => {
    if (['super_admin', 'company_admin', 'branch_manager', 'staff', 'receptionist'].includes(user.role as string)) return 'admin';
    if (user.role === 'client') return 'client';
    return user.companyId ? 'admin' : 'client';
  })();

  return {
    userId: user.id,
    tenantId: user.tenantId,
    companyId: user.companyId,
    branchId: user.branchId,
    role: normalizedRole,
    email: user.email
  };
}

export function publicUser(user: UserRecord): Omit<UserRecord, 'passwordHash'> {
  return userView(user);
}

export function overallRevenue(claims: AuthClaims): number {
  return repository.getTenantOverview(claims).totals.revenue;
}
