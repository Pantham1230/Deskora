import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import type { QueryResultRow } from 'pg';
import { pool, useDatabase } from './db.js';
import { hasTimeOverlap, validateMeetingTimeRange } from './bookingValidation.js';
import { CANCELLATION_WINDOW_MS } from './config.js';
import { buildClaims, publicUser, repository as memoryRepository } from './store.js';
import type {
  AuthClaims,
  BookingRecord,
  BranchRecord,
  ClientRecord,
  CompanyRecord,
  EmployeeRecord,
  FeedbackRecord,
  InvoiceRecord,
  MeetingRoomRecord,
  NotificationRecord,
  Role,
  SeatRecord,
  UserRecord
} from './types.js';

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

function tenantClause(claims: AuthClaims): { clause: string; params: unknown[] } {
  if (claims.role === 'admin') {
    return { clause: '', params: [] };
  }
  return { clause: 'WHERE tenant_id = $1', params: [claims.tenantId] };
}

function mapUser(row: Record<string, unknown>): UserRecord {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    companyId: row.company_id ? String(row.company_id) : null,
    branchId: row.branch_id ? String(row.branch_id) : null,
    name: String(row.name),
    email: String(row.email),
    passwordHash: String(row.password_hash),
    role: row.role as UserRecord['role']
  };
}

function mapBranch(row: Record<string, unknown>): BranchRecord {
  const galleryRaw = row.gallery_image_urls;
  const galleryImageUrls = Array.isArray(galleryRaw)
    ? galleryRaw.map((item) => String(item)).filter(Boolean)
    : typeof galleryRaw === 'string' && galleryRaw.trim()
      ? JSON.parse(galleryRaw) as string[]
      : [];
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    companyId: String(row.company_id),
    name: String(row.name),
    city: String(row.city),
    address: String(row.address),
    description: row.description ? String(row.description) : undefined,
    floors: Number(row.floors),
    seatCount: Number(row.seat_count),
    pricingPerSeat: Number(row.pricing_per_seat),
    meetingRoomCount: row.meeting_room_count ? Number(row.meeting_room_count) : undefined,
    heroImageUrl: row.hero_image_url ? String(row.hero_image_url) : undefined,
    galleryImageUrls,
    verificationStatus: row.verification_status ? String(row.verification_status) as BranchRecord['verificationStatus'] : 'verified'
  };
}

function mapSeat(row: Record<string, unknown>): SeatRecord {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    companyId: String(row.company_id),
    branchId: String(row.branch_id),
    label: String(row.label),
    floor: Number(row.floor),
    zone: String(row.zone),
    status: row.status as SeatRecord['status']
  };
}

function mapMeetingRoom(row: Record<string, unknown>): MeetingRoomRecord {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    companyId: String(row.company_id),
    branchId: String(row.branch_id),
    name: String(row.name),
    capacity: Number(row.capacity),
    hourlyRate: Number(row.hourly_rate)
  };
}

function mapClient(row: Record<string, unknown>): ClientRecord {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    companyId: String(row.company_id),
    name: String(row.name),
    contactName: String(row.contact_name),
    email: String(row.email),
    stage: row.stage as ClientRecord['stage'],
    lastTouchAt: String(row.last_touch_at)
  };
}

function mapEmployee(row: Record<string, unknown>): EmployeeRecord {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    companyId: String(row.company_id),
    branchId: row.branch_id ? String(row.branch_id) : null,
    name: String(row.name),
    role: row.role as EmployeeRecord['role'],
    title: String(row.title),
    email: String(row.email)
  };
}

function mapInvoice(row: Record<string, unknown>): InvoiceRecord {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    companyId: String(row.company_id),
    branchId: String(row.branch_id),
    clientId: String(row.client_id),
    invoiceNumber: String(row.invoice_number),
    status: row.status as InvoiceRecord['status'],
    issueDate: String(row.issue_date),
    dueDate: String(row.due_date),
    total: Number(row.total),
    lineItems: Array.isArray(row.line_items)
      ? (row.line_items as Array<{ label: string; quantity: number; rate: number }>)
      : []
  };
}

function mapNotification(row: Record<string, unknown>): NotificationRecord {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    companyId: String(row.company_id),
    type: row.type as NotificationRecord['type'],
    title: String(row.title),
    body: String(row.body),
    createdAt: String(row.created_at)
  };
}

function buildAmenities(branch: BranchRecord, meetingRooms: MeetingRoomRecord[], seats: SeatRecord[]) {
  const amenities = ['High-speed internet', 'Air conditioning'];
  if (meetingRooms.some((room) => room.branchId === branch.id)) amenities.push('Meeting rooms');
  if (seats.some((seat) => seat.branchId === branch.id && seat.zone.toLowerCase().includes('lounge'))) amenities.push('Lounge access');
  if (branch.floors > 3) amenities.push('Dedicated reception');
  if (branch.seatCount > 40) amenities.push('Enterprise seating');
  return amenities.slice(0, 5);
}

function formatRupees(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

function pickWorkspaceImage(branch: BranchRecord, index = 0): string {
  const images = [branch.heroImageUrl, ...(branch.galleryImageUrls ?? [])].filter((value): value is string => Boolean(value));
  return images[index % images.length] ?? fallbackWorkspaceImages[Math.abs(index) % fallbackWorkspaceImages.length];
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

function calculateOccupancy(seats: SeatRecord[]): number {
  if (seats.length === 0) return 0;
  const occupied = seats.filter((seat) => seat.status !== 'available').length;
  return Math.round((occupied / seats.length) * 100);
}

function aggregateRevenue(invoices: InvoiceRecord[], payments: Array<{ amount: number; status: string }>): number {
  const paidInvoices = invoices.filter((invoice) => invoice.status === 'paid').reduce((sum, invoice) => sum + invoice.total, 0);
  const paidPayments = payments.filter((payment) => payment.status === 'paid').reduce((sum, payment) => sum + payment.amount, 0);
  return paidInvoices + paidPayments;
}

async function query<T extends QueryResultRow = Record<string, unknown>>(text: string, params: unknown[] = []) {
  if (!pool) throw new Error('Database connection is not configured.');
  const result = await pool.query<T>(text, params);
  return result.rows;
}

async function dbAuthenticate(email: string, password: string): Promise<UserRecord | undefined> {
  const rows = await query('SELECT * FROM users WHERE lower(email) = lower($1) LIMIT 1', [email]);
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) return undefined;
  const user = mapUser(row);
  return bcrypt.compareSync(password, user.passwordHash) ? user : undefined;
}

export const repository = useDatabase
  ? {
      data: null,
      async findUserByEmail(email: string) {
        const rows = await query('SELECT * FROM users WHERE lower(email) = lower($1) LIMIT 1', [email]);
        const row = rows[0] as Record<string, unknown> | undefined;
        return row ? mapUser(row) : undefined;
      },
      async findUserById(id: string) {
        const rows = await query('SELECT * FROM users WHERE id = $1 LIMIT 1', [id]);
        const row = rows[0] as Record<string, unknown> | undefined;
        return row ? mapUser(row) : undefined;
      },
      async listCompanies(claims: AuthClaims): Promise<CompanyRecord[]> {
        const rows = claims.role === 'admin'
          ? await query('SELECT * FROM companies ORDER BY created_at DESC')
          : await query('SELECT * FROM companies WHERE tenant_id = $1 ORDER BY created_at DESC', [claims.tenantId]);
        return rows.map((row) => ({
          id: String((row as Record<string, unknown>).id),
          tenantId: String((row as Record<string, unknown>).tenant_id),
          name: String((row as Record<string, unknown>).name),
          industry: String((row as Record<string, unknown>).industry),
          status: (row as Record<string, unknown>).status as CompanyRecord['status'],
          createdAt: String((row as Record<string, unknown>).created_at)
        }));
      },
      async listPublicWorkspaces() {
        const companyRows = await query('SELECT * FROM companies WHERE status = $1 ORDER BY created_at DESC', ['active']);
        const branchRows = await query('SELECT * FROM branches ORDER BY name');
        const seatRows = await query('SELECT * FROM seats ORDER BY label');
        const meetingRoomRows = await query('SELECT * FROM meeting_rooms ORDER BY name');
        const feedbackRows = await query('SELECT * FROM feedback ORDER BY created_at DESC');
        const companies = companyRows.map((row) => ({
          id: String((row as Record<string, unknown>).id),
          tenantId: String((row as Record<string, unknown>).tenant_id),
          name: String((row as Record<string, unknown>).name),
          industry: String((row as Record<string, unknown>).industry),
          status: (row as Record<string, unknown>).status as CompanyRecord['status'],
          createdAt: String((row as Record<string, unknown>).created_at)
        }));
        const branches = branchRows.map((row) => mapBranch(row as Record<string, unknown>)).filter((branch) => companies.some((company) => company.id === branch.companyId));
        const seats = seatRows.map((row) => mapSeat(row as Record<string, unknown>));
        const meetingRooms = meetingRoomRows.map((row) => mapMeetingRoom(row as Record<string, unknown>));
        const feedback = feedbackRows.map((row) => ({
          id: String((row as Record<string, unknown>).id),
          tenantId: String((row as Record<string, unknown>).tenant_id),
          companyId: String((row as Record<string, unknown>).company_id),
          branchId: String((row as Record<string, unknown>).branch_id),
          clientId: String((row as Record<string, unknown>).client_id),
          rating: Number((row as Record<string, unknown>).rating),
          category: String((row as Record<string, unknown>).category) as FeedbackRecord['category'],
          message: String((row as Record<string, unknown>).message),
          sentiment: String((row as Record<string, unknown>).sentiment) as FeedbackRecord['sentiment'],
          createdAt: String((row as Record<string, unknown>).created_at)
        }));
        return { workspaces: branches.map((branch) => buildPublicWorkspace(branch, companies.find((company) => company.id === branch.companyId)!, seats, meetingRooms, feedback)) };
      },
      async getTenantOverview(claims: AuthClaims) {
        const companyRows = claims.role === 'admin'
          ? await query('SELECT * FROM companies')
          : await query('SELECT * FROM companies WHERE tenant_id = $1', [claims.tenantId]);
        const companyIds = companyRows.map((row) => String((row as Record<string, unknown>).id));
        const branches = (await query('SELECT * FROM branches')).map((row) => mapBranch(row as Record<string, unknown>)).filter((branch) => companyIds.includes(branch.companyId));
        const seats = (await query('SELECT * FROM seats')).map((row) => mapSeat(row as Record<string, unknown>)).filter((seat) => companyIds.includes(seat.companyId));
        const clients = (await query('SELECT * FROM clients')).map((row) => mapClient(row as Record<string, unknown>)).filter((client) => companyIds.includes(client.companyId));
        const invoices = (await query('SELECT i.*, COALESCE(json_agg(json_build_object(\'label\', li.label, \'quantity\', li.quantity, \'rate\', li.rate)) FILTER (WHERE li.id IS NOT NULL), \'[]\') AS line_items FROM invoices i LEFT JOIN invoice_line_items li ON li.invoice_id = i.id GROUP BY i.id ORDER BY i.issue_date DESC')).map((row) => mapInvoice(row as Record<string, unknown>)).filter((invoice) => companyIds.includes(invoice.companyId));
        const payments = (await query('SELECT * FROM payments')).filter((row) => companyIds.includes(String((row as Record<string, unknown>).company_id)));
        const notifications = (await query('SELECT * FROM notifications ORDER BY created_at DESC')).map((row) => mapNotification(row as Record<string, unknown>)).filter((notification) => companyIds.includes(notification.companyId));
        const branchStats = branches.map((branch) => {
          const branchSeats = seats.filter((seat) => seat.branchId === branch.id);
          const branchRatings = notifications.filter((notification) => notification.companyId === branch.companyId && notification.type === 'payment');
          const averageRating = branchRatings.length === 0 ? 0 : 4.5;
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

        const paymentsMapped = payments.map((payment) => {
          const row = payment as Record<string, unknown>;
          return {
            invoiceId: String(row.invoice_id ?? row.invoiceId ?? ''),
            amount: Number(row.amount),
            status: String(row.status) as 'pending' | 'paid' | 'failed' | 'refunded' | 'overdue',
            method: String(row.method ?? 'upi') as 'upi' | 'stripe' | 'razorpay' | 'card' | 'net_banking' | 'wallet',
            referenceId: String(row.reference_id ?? row.referenceId ?? ''),
            paidAt: row.paid_at ? String(row.paid_at) : row.paidAt ? String(row.paidAt) : null,
            subscriptionTier: String(row.subscription_tier ?? row.subscriptionTier ?? 'business') as 'starter' | 'business' | 'enterprise'
          };
        });

        const heatmap = branches.flatMap((branch) => {
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

        const insights = [
          {
            id: 'insight-occupancy',
            title: `${branches[0]?.name ?? 'This branch'} reached ${calculateOccupancy(seats)}% occupancy this week`,
            detail: 'Digital twin occupancy and booking depth are updating live across the selected tenant.',
            tone: 'success' as const
          },
          {
            id: 'insight-renewals',
            title: 'Renewal reminders are queued for expiring subscriptions',
            detail: 'Auto-renew logic keeps recurring billing and notifications aligned with finance operations.',
            tone: 'accent' as const
          },
          {
            id: 'insight-revenue',
            title: `${branches[0]?.city ?? 'The portfolio'} is showing strong revenue momentum`,
            detail: `Collected revenue stands at ₹${aggregateRevenue(invoices, paymentsMapped).toLocaleString()}.`,
            tone: 'info' as const
          },
          {
            id: 'insight-feedback',
            title: 'Customer sentiment is trending positive across recent reviews',
            detail: 'Feedback cards and satisfaction trends are now surfaced directly in the workspace experience.',
            tone: 'success' as const
          }
        ];

        return {
          totals: {
            companies: companyIds.length,
            branches: branches.length,
            seats: seats.length,
            activeClients: clients.filter((client) => client.stage === 'active').length,
            revenue: aggregateRevenue(invoices, paymentsMapped),
            occupancyRate: calculateOccupancy(seats)
          },
          branchStats,
          recentNotifications: notifications.slice(0, 6),
          clients,
          invoices,
          payments: paymentsMapped,
          feedback: [],
          insights,
          heatmap,
          subscriptions: []
        };
      },
      async createCompany(name: string, industry: string, admin: { name: string; email: string; password: string; role: Role }) {
        if (!pool) throw new Error('Database connection is not configured.');
        const companyId = uuid();
        const tenantId = `tenant-${companyId.slice(0, 8)}`;
        const passwordHash = bcrypt.hashSync(admin.password, 10);
        await pool.query('BEGIN');
        try {
          await pool.query('INSERT INTO companies (id, tenant_id, name, industry, status) VALUES ($1, $2, $3, $4, $5)', [companyId, tenantId, name, industry, 'active']);
          await pool.query('INSERT INTO users (id, tenant_id, company_id, branch_id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [uuid(), tenantId, companyId, null, admin.name, admin.email, passwordHash, admin.role]);
          await pool.query('COMMIT');
        } catch (error) {
          await pool.query('ROLLBACK');
          throw error;
        }
        return {
          company: { id: companyId, tenantId, name, industry, status: 'active', createdAt: new Date().toISOString() },
          user: { id: '', tenantId, companyId, branchId: null, name: admin.name, email: admin.email, role: admin.role }
        };
      },
      async createClientUser(payload: { name: string; email: string; password: string; role: Role }) {
        if (!pool) throw new Error('Database connection is not configured.');
        const passwordHash = bcrypt.hashSync(payload.password, 10);
        await pool.query('INSERT INTO users (id, tenant_id, company_id, branch_id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [uuid(), 'platform', null, null, payload.name, payload.email, passwordHash, payload.role]);
        return {
          user: { id: '', tenantId: 'platform', companyId: null, branchId: null, name: payload.name, email: payload.email, role: payload.role }
        };
      },
      async createWorkspaceUser(payload: { companyId: string; branchId: string; role: Role; name: string; email: string; password: string }) {
        if (!pool) throw new Error('Database connection is not configured.');
        const companyRows = await query('SELECT * FROM companies WHERE id = $1 LIMIT 1', [payload.companyId]);
        const companyRow = companyRows[0] as Record<string, unknown> | undefined;
        if (!companyRow) throw new Error('Workspace not found.');
        const branchRows = await query('SELECT * FROM branches WHERE id = $1 LIMIT 1', [payload.branchId]);
        const branchRow = branchRows[0] as Record<string, unknown> | undefined;
        if (!branchRow || String(branchRow.company_id) !== payload.companyId) throw new Error('Selected branch does not belong to the chosen workspace.');
        const tenantId = String(companyRow.tenant_id);
        const passwordHash = bcrypt.hashSync(payload.password, 10);
        await pool.query('INSERT INTO users (id, tenant_id, company_id, branch_id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [uuid(), tenantId, payload.companyId, payload.branchId, payload.name, payload.email, passwordHash, payload.role]);
        return {
          company: { id: String(companyRow.id), tenantId, name: String(companyRow.name), industry: String(companyRow.industry), status: String(companyRow.status) as CompanyRecord['status'], createdAt: String(companyRow.created_at) },
          branch: mapBranch(branchRow),
          user: { id: '', tenantId, companyId: payload.companyId, branchId: payload.branchId, name: payload.name, email: payload.email, role: payload.role }
        };
      },
      async createBranch(claims: AuthClaims, payload: Omit<BranchRecord, 'id' | 'tenantId'>) {
        const branch: BranchRecord = { ...payload, id: uuid(), tenantId: claims.tenantId, verificationStatus: payload.verificationStatus ?? 'pending' };
        await query('INSERT INTO branches (id, tenant_id, company_id, name, city, address, floors, seat_count, pricing_per_seat) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)', [branch.id, branch.tenantId, branch.companyId, branch.name, branch.city, branch.address, branch.floors, branch.seatCount, branch.pricingPerSeat]);
        return branch;
      },
      async deleteBranch(claims: AuthClaims, branchId: string) {
        if (!pool) throw new Error('Database connection is not configured.');
        // ensure tenant access
        const rows = await query('SELECT * FROM branches WHERE id = $1 LIMIT 1', [branchId]);
        const branch = rows[0] as Record<string, unknown> | undefined;
        if (!branch) throw new Error('Branch not found.');
        if (claims.role !== 'admin' && String(branch.tenant_id) !== claims.tenantId) throw new Error('Tenant access denied.');
        const active = await this.branchHasActiveOccupancy(branchId);
        if (active) throw new Error('Cannot delete branch with active occupancy or bookings.');
        await pool.query('DELETE FROM branches WHERE id = $1', [branchId]);
        return { id: branchId };
      },
      async listBranches(claims: AuthClaims) {
        const rows = claims.role === 'admin' || claims.role === 'client'
          ? await query('SELECT * FROM branches ORDER BY name')
          : await query('SELECT * FROM branches WHERE tenant_id = $1 ORDER BY name', [claims.tenantId]);
        return rows.map((row) => mapBranch(row as Record<string, unknown>));
      },
      async listSeats(claims: AuthClaims, branchId?: string) {
        const rows = branchId
          ? (claims.role === 'client'
            ? await query('SELECT * FROM seats WHERE branch_id = $1 ORDER BY label', [branchId])
            : await query('SELECT * FROM seats WHERE ($1::text IS NULL OR branch_id = $1) AND tenant_id = $2 ORDER BY label', [branchId, claims.tenantId]))
          : claims.role === 'admin' || claims.role === 'client'
            ? await query('SELECT * FROM seats ORDER BY label')
            : await query('SELECT * FROM seats WHERE tenant_id = $1 ORDER BY label', [claims.tenantId]);

        const seats = rows.map((row) => mapSeat(row as Record<string, unknown>));
        if (seats.length === 0) return seats;

        const seatIds = seats.map((seat) => seat.id);
        const bookings = await query('SELECT resource_id, customer_name FROM bookings WHERE resource_type = $1 AND status = $2 AND resource_id = ANY($3::text[])', ['seat', 'booked', seatIds]);
        const bookingLookup = new Map<string, string>();
        bookings.forEach((row) => bookingLookup.set(String((row as Record<string, unknown>).resource_id), String((row as Record<string, unknown>).customer_name)));

        return seats.map((seat) => {
          const bookedByCurrentUser = bookingLookup.get(seat.id) === claims.userId;
          return { ...seat, bookedByCurrentUser, canCancel: bookedByCurrentUser };
        });
      },
      async bookSeat(claims: AuthClaims, seatId: string, customerName: string) {
        if (!pool) throw new Error('Database connection is not configured.');
        const seatRows = await query('SELECT * FROM seats WHERE id = $1 LIMIT 1', [seatId]);
        const seatRow = seatRows[0] as Record<string, unknown> | undefined;
        if (!seatRow) throw new Error('Seat not found.');
        const seat = mapSeat(seatRow);
        if (seat.status === 'booked') throw new Error('Seat already booked.');
        if (claims.role !== 'admin' && claims.role !== 'client' && seat.tenantId !== claims.tenantId) throw new Error('Tenant access denied.');
        await pool.query('BEGIN');
        try {
          const userRows = await query('SELECT * FROM users WHERE id = $1 LIMIT 1', [claims.userId]);
          const userRow = userRows[0] as Record<string, unknown> | undefined;
          const displayName = userRow ? String(userRow.name) : customerName;
          const userEmail = userRow ? String(userRow.email) : claims.email;

          let clientRows = await query('SELECT * FROM clients WHERE tenant_id = $1 AND company_id = $2 AND LOWER(email) = LOWER($3) LIMIT 1', [seat.tenantId, seat.companyId, userEmail]);
          let clientRow = clientRows[0] as Record<string, unknown> | undefined;
          if (!clientRow) {
            const clientId = uuid();
            await pool.query('INSERT INTO clients (id, tenant_id, company_id, name, contact_name, email, stage, last_touch_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [clientId, seat.tenantId, seat.companyId, displayName, displayName, userEmail, 'active', new Date().toISOString()]);
            clientRows = await query('SELECT * FROM clients WHERE id = $1 LIMIT 1', [clientId]);
            clientRow = clientRows[0] as Record<string, unknown> | undefined;
          }

          await pool.query('UPDATE seats SET status = $1 WHERE id = $2 AND status <> $3', ['booked', seatId, 'booked']);
          await pool.query(
            'INSERT INTO bookings (id, tenant_id, company_id, branch_id, resource_type, resource_id, customer_name, start_at, end_at, status, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW() + make_interval(hours => $10::int),NOW() + make_interval(hours => $10::int) + INTERVAL \'1 day\',$8,$9)',
            [uuid(), seat.tenantId, seat.companyId, seat.branchId, 'seat', seat.id, claims.userId, 'booked', displayName, Math.ceil(CANCELLATION_WINDOW_MS / (60 * 60 * 1000)) + 1]
          );

          const branchRows = await query('SELECT pricing_per_seat FROM branches WHERE id = $1 LIMIT 1', [seat.branchId]);
          const dailyRate = Math.max(1, Math.round((branchRows[0] ? Number((branchRows[0] as Record<string, unknown>).pricing_per_seat) : 0) / 30));
          const invoiceId = uuid();
          const invoiceNumber = `INV-2026-${String(Date.now()).slice(-6)}`;
          await pool.query('INSERT INTO invoices (id, tenant_id, company_id, branch_id, client_id, invoice_number, status, issue_date, due_date, total) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW() + INTERVAL \'7 days\',$8)', [invoiceId, seat.tenantId, seat.companyId, seat.branchId, String(clientRow?.id), invoiceNumber, 'sent', dailyRate]);
          await pool.query('INSERT INTO invoice_line_items (id, tenant_id, invoice_id, label, quantity, rate) VALUES ($1,$2,$3,$4,$5,$6)', [uuid(), seat.tenantId, invoiceId, `Desk booking ${seat.label}`, 1, dailyRate]);
          await pool.query('INSERT INTO payments (id, tenant_id, company_id, invoice_id, amount, status, paid_at) VALUES ($1,$2,$3,$4,$5,$6,$7)', [uuid(), seat.tenantId, seat.companyId, invoiceId, dailyRate, 'pending', null]);

          await pool.query('INSERT INTO notifications (id, tenant_id, company_id, type, title, body) VALUES ($1,$2,$3,$4,$5,$6)', [uuid(), seat.tenantId, seat.companyId, 'booking', 'Seat booking confirmed', `${seat.label} was booked for ${displayName}.`]);
          await pool.query('INSERT INTO notifications (id, tenant_id, company_id, type, title, body) VALUES ($1,$2,$3,$4,$5,$6)', [uuid(), seat.tenantId, seat.companyId, 'payment', 'Invoice generated', `${invoiceNumber} created for seat booking ${seat.label}.`]);
          await pool.query('COMMIT');
        } catch (error) {
          await pool.query('ROLLBACK');
          throw error;
        }
        return { ...seat, status: 'booked' as const, bookedByCurrentUser: true, canCancel: true };
      },
      async cancelSeatBooking(claims: AuthClaims, seatId: string) {
        if (!pool) throw new Error('Database connection is not configured.');
        // find active booking for this seat
        const bookingRows = await query('SELECT * FROM bookings WHERE resource_type = $1 AND resource_id = $2 AND status = $3 LIMIT 1', ['seat', seatId, 'booked']);
        const booking = bookingRows[0] as Record<string, unknown> | undefined;
        if (!booking) throw new Error('No active booking found for this seat.');
        const startAt = new Date(String(booking.start_at ?? booking.startAt)).getTime();
        const now = Date.now();
        if (startAt <= now) throw new Error('Cannot cancel an ongoing or past booking.');
        if (startAt - now < CANCELLATION_WINDOW_MS) throw new Error(`Cancellations are only allowed at least ${CANCELLATION_WINDOW_MS / (60 * 60 * 1000)} hours before start.`);

        const isOwner = String(booking.customer_name) === claims.userId;
        const isAdmin = claims.role === 'admin';
        if (!isOwner && !isAdmin) throw new Error('Insufficient permissions to cancel this booking.');

        // mark booking cancelled
        await pool.query('BEGIN');
        try {
          await pool.query('UPDATE bookings SET status = $1 WHERE id = $2', ['cancelled', String(booking.id)]);
          await pool.query('UPDATE seats SET status = $1 WHERE id = $2', ['available', seatId]);
          // create notification
          await pool.query('INSERT INTO notifications (id, tenant_id, company_id, type, title, body) VALUES ($1,$2,$3,$4,$5,$6)', [uuid(), String(booking.tenant_id), String(booking.company_id), 'booking', 'Booking cancelled', `Seat booking for ${String(booking.notes ?? booking.customer_name)} has been cancelled.`]);

          // simple refund record: 100% for admin/staff, 50% for client
          const refundPercent = claims.role === 'client' ? 0.5 : 1.0;
          // try to determine amount from branch pricing
          const seatRows = await query('SELECT s.*, b.pricing_per_seat FROM seats s JOIN branches b ON s.branch_id = b.id WHERE s.id = $1 LIMIT 1', [seatId]);
          const seatRow = seatRows[0] as Record<string, unknown> | undefined;
          const amount = seatRow ? Number(seatRow.pricing_per_seat) * refundPercent : 0;
          if (amount > 0) {
            await pool.query('INSERT INTO payments (id, tenant_id, company_id, invoice_id, amount, status, paid_at) VALUES ($1,$2,$3,$4,$5,$6,$7)', [uuid(), String(booking.tenant_id), String(booking.company_id), null, amount, 'refunded', new Date().toISOString()]);
          }

          await pool.query('COMMIT');
        } catch (error) {
          await pool.query('ROLLBACK');
          throw error;
        }

        return { id: String(booking.id), status: 'cancelled' };
      },
      async listMeetingRooms(claims: AuthClaims, branchId?: string) {
        const rows = branchId
          ? await query('SELECT * FROM meeting_rooms WHERE branch_id = $1', [branchId])
          : claims.role === 'admin' || claims.role === 'client'
            ? await query('SELECT * FROM meeting_rooms ORDER BY name')
            : await query('SELECT * FROM meeting_rooms WHERE tenant_id = $1 ORDER BY name', [claims.tenantId]);
        return rows.map((row) => mapMeetingRoom(row as Record<string, unknown>));
      },
      async deleteMeetingRoom(claims: AuthClaims, roomId: string) {
        if (!pool) throw new Error('Database connection is not configured.');
        const rows = await query('SELECT * FROM meeting_rooms WHERE id = $1 LIMIT 1', [roomId]);
        const room = rows[0] as Record<string, unknown> | undefined;
        if (!room) throw new Error('Meeting room not found.');
        if (claims.role !== 'admin' && String(room.tenant_id) !== claims.tenantId) throw new Error('Tenant access denied.');
        const active = await this.roomHasActiveBooking(roomId);
        if (active) throw new Error('Cannot delete meeting room while it has active bookings.');
        await pool.query('DELETE FROM meeting_rooms WHERE id = $1', [roomId]);
        return { id: roomId };
      },
      async bookMeetingRoom(claims: AuthClaims, roomId: string, customerName: string, startAt: string, endAt: string) {
        validateMeetingTimeRange(startAt, endAt);
        const rows = await query('SELECT * FROM meeting_rooms WHERE id = $1 LIMIT 1', [roomId]);
        const row = rows[0] as Record<string, unknown> | undefined;
        if (!row) throw new Error('Meeting room not found.');
        const room = mapMeetingRoom(row);
        if (claims.role !== 'admin' && claims.role !== 'client' && room.tenantId !== claims.tenantId) throw new Error('Tenant access denied.');
        const conflicts = await query('SELECT 1 FROM bookings WHERE resource_type = $1 AND resource_id = $2 AND status <> $3 AND start_at < $4 AND $5 < end_at LIMIT 1', ['meeting_room', roomId, 'cancelled', endAt, startAt]);
        if (conflicts.length) throw new Error('This time slot overlaps with an existing booking.');
        const bookingId = uuid();
        await pool!.query('BEGIN');
        try {
          await pool!.query('INSERT INTO bookings (id, tenant_id, company_id, branch_id, resource_type, resource_id, customer_name, start_at, end_at, status, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [bookingId, room.tenantId, room.companyId, room.branchId, 'meeting_room', room.id, claims.userId, startAt, endAt, 'booked', customerName]);
          await pool!.query('INSERT INTO notifications (id, tenant_id, company_id, type, title, body) VALUES ($1,$2,$3,$4,$5,$6)', [uuid(), room.tenantId, room.companyId, 'booking', 'Meeting room booked', `${room.name} is reserved.`]);
          await pool!.query('COMMIT');
        } catch (error) {
          await pool!.query('ROLLBACK');
          throw error;
        }
        return { id: bookingId, tenantId: room.tenantId, companyId: room.companyId, branchId: room.branchId, resourceType: 'meeting_room', resourceId: room.id, customerName: claims.userId, startAt, endAt, status: 'booked' as const, notes: customerName };
      },
      async cancelMeetingRoomBooking(claims: AuthClaims, roomId: string, bookingId?: string) {
        if (!pool) throw new Error('Database connection is not configured.');
        const rows = bookingId
          ? await query('SELECT * FROM bookings WHERE id = $1 AND resource_type = $2 LIMIT 1', [bookingId, 'meeting_room'])
          : await query('SELECT * FROM bookings WHERE resource_type = $1 AND resource_id = $2 AND status = $3 LIMIT 1', ['meeting_room', roomId, 'booked']);
        const booking = rows[0] as Record<string, unknown> | undefined;
        if (!booking) throw new Error('No active booking found for this room.');
        const startAt = new Date(String(booking.start_at ?? booking.startAt)).getTime();
        const now = Date.now();
        if (startAt <= now) throw new Error('Cannot cancel an ongoing or past booking.');
        if (startAt - now < CANCELLATION_WINDOW_MS) throw new Error(`Cancellations are only allowed at least ${CANCELLATION_WINDOW_MS / (60 * 60 * 1000)} hours before start.`);

        const isOwner = String(booking.customer_name) === claims.userId;
        const isAdmin = claims.role === 'admin';
        if (!isOwner && !isAdmin) throw new Error('Insufficient permissions to cancel this booking.');

        await pool.query('BEGIN');
        try {
          await pool.query('UPDATE bookings SET status = $1 WHERE id = $2', ['cancelled', String(booking.id)]);
          await pool.query('INSERT INTO notifications (id, tenant_id, company_id, type, title, body) VALUES ($1,$2,$3,$4,$5,$6)', [uuid(), String(booking.tenant_id), String(booking.company_id), 'booking', 'Meeting cancelled', `${String(booking.customer_name)}'s meeting has been cancelled.`]);

          // refund computation: find room hourly rate and compute duration
          const roomRows = await query('SELECT * FROM meeting_rooms WHERE id = $1 LIMIT 1', [roomId]);
          const room = roomRows[0] as Record<string, unknown> | undefined;
          let amount = 0;
          if (room) {
            const hourly = Number(room.hourly_rate ?? room.hourlyRate ?? 0);
            const start = new Date(String(booking.start_at ?? booking.startAt)).getTime();
            const end = new Date(String(booking.end_at ?? booking.endAt)).getTime();
            const hours = Math.max(1, Math.ceil((end - start) / (60 * 60 * 1000)));
            const refundPercent = claims.role === 'client' ? 0.5 : 1.0;
            amount = hourly * hours * refundPercent;
            if (amount > 0) {
              await pool.query('INSERT INTO payments (id, tenant_id, company_id, invoice_id, amount, status, paid_at) VALUES ($1,$2,$3,$4,$5,$6,$7)', [uuid(), String(booking.tenant_id), String(booking.company_id), null, amount, 'refunded', new Date().toISOString()]);
            }
          }

          await pool.query('COMMIT');
        } catch (error) {
          await pool.query('ROLLBACK');
          throw error;
        }

        return { id: String(booking.id), status: 'cancelled' };
      },

      async branchHasActiveOccupancy(branchId: string) {
        const rows = await query('SELECT 1 FROM seats WHERE branch_id = $1 AND status = $2 LIMIT 1', [branchId, 'booked']);
        if (rows.length) return true;
        const meetingRows = await query('SELECT 1 FROM bookings WHERE branch_id = $1 AND resource_type = $2 AND status = $3 AND start_at <= NOW() AND end_at >= NOW() LIMIT 1', [branchId, 'meeting_room', 'booked']);
        return meetingRows.length > 0;
      },

      async roomHasActiveBooking(roomId: string) {
        const rows = await query('SELECT 1 FROM bookings WHERE resource_type = $1 AND resource_id = $2 AND status = $3 AND start_at <= NOW() AND end_at >= NOW() LIMIT 1', ['meeting_room', roomId, 'booked']);
        return rows.length > 0;
      },
      async listClients(claims: AuthClaims) {
        const rows = claims.role === 'admin'
          ? await query('SELECT * FROM clients ORDER BY last_touch_at DESC')
          : await query('SELECT * FROM clients WHERE tenant_id = $1 ORDER BY last_touch_at DESC', [claims.tenantId]);
        return rows.map((row) => mapClient(row as Record<string, unknown>));
      },
      async createClient(claims: AuthClaims, payload: Omit<ClientRecord, 'id' | 'tenantId' | 'lastTouchAt'>) {
        const client: ClientRecord = { ...payload, id: uuid(), tenantId: claims.tenantId, lastTouchAt: new Date().toISOString() };
        await query('INSERT INTO clients (id, tenant_id, company_id, name, contact_name, email, stage, last_touch_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [client.id, client.tenantId, client.companyId, client.name, client.contactName, client.email, client.stage, client.lastTouchAt]);
        return client;
      },
      async listEmployees(claims: AuthClaims) {
        const rows = claims.role === 'admin'
          ? await query('SELECT * FROM employees ORDER BY name')
          : await query('SELECT * FROM employees WHERE tenant_id = $1 ORDER BY name', [claims.tenantId]);
        return rows.map((row) => mapEmployee(row as Record<string, unknown>));
      },
      async createEmployee(claims: AuthClaims, payload: Omit<EmployeeRecord, 'id' | 'tenantId'>) {
        const employee: EmployeeRecord = { ...payload, id: uuid(), tenantId: claims.tenantId };
        await query('INSERT INTO employees (id, tenant_id, company_id, branch_id, name, role, title, email) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [employee.id, employee.tenantId, employee.companyId, employee.branchId, employee.name, employee.role, employee.title, employee.email]);
        return employee;
      },
      async listInvoices(claims: AuthClaims) {
        if (claims.role === 'client') {
          const userRows = await query('SELECT email FROM users WHERE id = $1 LIMIT 1', [claims.userId]);
          const userEmail = userRows[0] ? String((userRows[0] as Record<string, unknown>).email) : claims.email;
          const rows = await query(
            `SELECT i.* FROM invoices i
             JOIN clients c ON c.id = i.client_id
             WHERE LOWER(c.email) = LOWER($1)
             ORDER BY i.issue_date DESC`,
            [userEmail]
          );
          return rows.map((row) => mapInvoice(row as Record<string, unknown>));
        }
        const rows = claims.role === 'admin'
          ? await query('SELECT * FROM invoices ORDER BY issue_date DESC')
          : await query('SELECT * FROM invoices WHERE tenant_id = $1 ORDER BY issue_date DESC', [claims.tenantId]);
        return rows.map((row) => mapInvoice(row as Record<string, unknown>));
      },
      async listBookings(claims: AuthClaims) {
        const rows = claims.role === 'client'
          ? await query('SELECT * FROM bookings WHERE customer_name = $1 ORDER BY start_at DESC', [claims.userId])
          : claims.role === 'admin'
            ? await query('SELECT * FROM bookings ORDER BY start_at DESC')
            : await query('SELECT * FROM bookings WHERE tenant_id = $1 ORDER BY start_at DESC', [claims.tenantId]);
        return rows.map((row) => {
          const record = row as Record<string, unknown>;
          return {
            id: String(record.id),
            tenantId: String(record.tenant_id),
            companyId: String(record.company_id),
            branchId: String(record.branch_id),
            resourceType: String(record.resource_type) as 'seat' | 'meeting_room',
            resourceId: String(record.resource_id),
            customerName: String(record.customer_name),
            startAt: String(record.start_at),
            endAt: String(record.end_at),
            status: String(record.status) as BookingRecord['status'],
            notes: record.notes ? String(record.notes) : undefined
          };
        });
      },
      async generateInvoice(claims: AuthClaims, payload: { branchId: string; clientId: string; quantity: number; rate: number }) {
        const branchRows = await query('SELECT * FROM branches WHERE id = $1 LIMIT 1', [payload.branchId]);
        const clientRows = await query('SELECT * FROM clients WHERE id = $1 LIMIT 1', [payload.clientId]);
        const branchRow = branchRows[0] as Record<string, unknown> | undefined;
        const clientRow = clientRows[0] as Record<string, unknown> | undefined;
        if (!branchRow || !clientRow) throw new Error('Branch or client not found.');
        const branch = mapBranch(branchRow);
        const client = mapClient(clientRow);
        if (claims.role !== 'admin' && (branch.tenantId !== claims.tenantId || client.tenantId !== claims.tenantId)) {
          throw new Error('Tenant access denied.');
        }
        const invoiceId = uuid();
        const invoiceNumber = `INV-2026-${String(Date.now()).slice(-6)}`;
        const total = payload.quantity * payload.rate;
        await pool!.query('BEGIN');
        try {
          await pool!.query('INSERT INTO invoices (id, tenant_id, company_id, branch_id, client_id, invoice_number, status, issue_date, due_date, total) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW() + INTERVAL \'14 days\',$8)', [invoiceId, claims.tenantId, branch.companyId, branch.id, client.id, invoiceNumber, 'sent', total]);
          await pool!.query('INSERT INTO invoice_line_items (id, tenant_id, invoice_id, label, quantity, rate) VALUES ($1,$2,$3,$4,$5,$6)', [uuid(), claims.tenantId, invoiceId, 'Dedicated seat subscription', payload.quantity, payload.rate]);
          await pool!.query('INSERT INTO payments (id, tenant_id, company_id, invoice_id, amount, status, paid_at) VALUES ($1,$2,$3,$4,$5,$6,$7)', [uuid(), claims.tenantId, branch.companyId, invoiceId, total, 'pending', null]);
          await pool!.query('INSERT INTO notifications (id, tenant_id, company_id, type, title, body) VALUES ($1,$2,$3,$4,$5,$6)', [uuid(), claims.tenantId, branch.companyId, 'payment', 'Invoice generated', `${invoiceNumber} is ready for payment tracking.`]);
          await pool!.query('COMMIT');
        } catch (error) {
          await pool!.query('ROLLBACK');
          throw error;
        }
        return {
          id: invoiceId,
          tenantId: claims.tenantId,
          companyId: branch.companyId,
          branchId: branch.id,
          clientId: client.id,
          invoiceNumber,
          status: 'sent' as const,
          issueDate: new Date().toISOString(),
          dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          total,
          lineItems: [{ label: 'Dedicated seat subscription', quantity: payload.quantity, rate: payload.rate }]
        };
      },
      async listNotifications(claims: AuthClaims) {
        const rows = claims.role === 'admin'
          ? await query('SELECT * FROM notifications ORDER BY created_at DESC')
          : await query('SELECT * FROM notifications WHERE tenant_id = $1 ORDER BY created_at DESC', [claims.tenantId]);
        return rows.map((row) => mapNotification(row as Record<string, unknown>));
      },
      listVisitors: memoryRepository.listVisitors,
      checkInVisitor: memoryRepository.checkInVisitor,
      checkOutVisitor: memoryRepository.checkOutVisitor,
      authenticate: dbAuthenticate,
      buildClaims,
      publicUser
    }
  : {
      ...memoryRepository,
      async findUserByEmail(email: string) {
        return memoryRepository.findUserByEmail(email);
      },
      async findUserById(id: string) {
        return memoryRepository.findUserById(id);
      },
      async listCompanies(claims: AuthClaims) {
        return memoryRepository.listCompanies(claims);
      },
      async getTenantOverview(claims: AuthClaims) {
        return memoryRepository.getTenantOverview(claims);
      },
      async createCompany(name: string, industry: string, admin: { name: string; email: string; password: string; role: Role }) {
        return memoryRepository.createCompany(name, industry, admin);
      },
      async createClientUser(payload: { name: string; email: string; password: string; role: Role }) {
        return memoryRepository.createClientUser(payload);
      },
      async createBranch(claims: AuthClaims, payload: Omit<BranchRecord, 'id' | 'tenantId'>) {
        return memoryRepository.createBranch(claims, payload);
      },
      async deleteBranch(claims: AuthClaims, branchId: string) {
        return memoryRepository.deleteBranch ? memoryRepository.deleteBranch(claims, branchId) : (() => { throw new Error('Not implemented in memory repository'); })();
      },
      async listBranches(claims: AuthClaims) {
        return memoryRepository.listBranches(claims);
      },
      async listSeats(claims: AuthClaims, branchId?: string) {
        return memoryRepository.listSeats(claims, branchId);
      },
      async bookSeat(claims: AuthClaims, seatId: string, customerName: string) {
        return memoryRepository.bookSeat(claims, seatId, customerName);
      },
      async listMeetingRooms(claims: AuthClaims, branchId?: string) {
        return memoryRepository.listMeetingRooms(claims, branchId);
      },
      async deleteMeetingRoom(claims: AuthClaims, roomId: string) {
        return memoryRepository.deleteMeetingRoom ? memoryRepository.deleteMeetingRoom(claims, roomId) : (() => { throw new Error('Not implemented in memory repository'); })();
      },
      async bookMeetingRoom(claims: AuthClaims, roomId: string, customerName: string, startAt: string, endAt: string) {
        return memoryRepository.bookMeetingRoom(claims, roomId, customerName, startAt, endAt);
      },
      async listClients(claims: AuthClaims) {
        return memoryRepository.listClients(claims);
      },
      async createClient(claims: AuthClaims, payload: Omit<ClientRecord, 'id' | 'tenantId' | 'lastTouchAt'>) {
        return memoryRepository.createClient(claims, payload);
      },
      async listEmployees(claims: AuthClaims) {
        return memoryRepository.listEmployees(claims);
      },
      async createEmployee(claims: AuthClaims, payload: Omit<EmployeeRecord, 'id' | 'tenantId'>) {
        return memoryRepository.createEmployee(claims, payload);
      },
      async listInvoices(claims: AuthClaims) {
        return memoryRepository.listInvoices(claims);
      },
      async listBookings(claims: AuthClaims) {
        return memoryRepository.listBookings(claims);
      },
      async generateInvoice(claims: AuthClaims, payload: { branchId: string; clientId: string; quantity: number; rate: number }) {
        return memoryRepository.generateInvoice(claims, payload);
      },
      async listNotifications(claims: AuthClaims) {
        return memoryRepository.listNotifications(claims);
      },
      async listVisitors(claims: AuthClaims, branchId?: string) {
        return memoryRepository.listVisitors(claims, branchId);
      },
      async checkInVisitor(claims: AuthClaims, payload: { branchId: string; visitorName: string; purpose: string; hostName: string; workspaceLocation: string }) {
        return memoryRepository.checkInVisitor(claims, payload);
      },
      async checkOutVisitor(claims: AuthClaims, visitorId: string) {
        return memoryRepository.checkOutVisitor(claims, visitorId);
      },
      async cancelSeatBooking(claims: AuthClaims, seatId: string) {
        return memoryRepository.cancelSeatBooking ? memoryRepository.cancelSeatBooking(claims, seatId) : (() => { throw new Error('Not implemented in memory repository'); })();
      },
      async cancelMeetingRoomBooking(claims: AuthClaims, roomId: string, bookingId?: string) {
        return memoryRepository.cancelMeetingRoomBooking ? memoryRepository.cancelMeetingRoomBooking(claims, roomId, bookingId) : (() => { throw new Error('Not implemented in memory repository'); })();
      },
      async branchHasActiveOccupancy(branchId: string) {
        return memoryRepository.branchHasActiveOccupancy ? memoryRepository.branchHasActiveOccupancy(branchId) : false;
      },
      async roomHasActiveBooking(roomId: string) {
        return memoryRepository.roomHasActiveBooking ? memoryRepository.roomHasActiveBooking(roomId) : false;
      },
      authenticate: async (email: string, password: string) => memoryRepository.authenticate(email, password),
      buildClaims,
      publicUser
    };
