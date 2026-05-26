import cors from 'cors';
import express, { type Request, type Response } from 'express';
import { signToken, verifyToken, jwtSecret } from './auth.js';
import { repository } from './repository.js';
import { buildClaims, publicUser } from './store.js';
import { emitSeatUpdated } from './realtime.js';
import type { AuthClaims, Role } from './types.js';

declare global {
  namespace Express {
    interface Request {
      auth?: AuthClaims;
    }
  }
}

function authRequired(req: Request, res: Response, next: () => void): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Missing bearer token.' });
    return;
  }

  try {
    const decoded = verifyToken(header.slice(7));
    req.auth = decoded;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token.' });
  }
}

function roleAllowed(roles: Role[]) {
  return (req: Request, res: Response, next: () => void) => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      res.status(403).json({ message: 'Insufficient role permissions.' });
      return;
    }
    next();
  };
}

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'deskora-server' });
  });

  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ message: 'Email and password are required.' });
      return;
    }
    if (!emailPattern.test(email)) {
      res.status(400).json({ message: 'Enter a valid email address.' });
      return;
    }

    const user = await repository.authenticate(email, password);
    if (!user) {
      res.status(401).json({ message: 'Invalid credentials.' });
      return;
    }

    const claims = buildClaims(user);
    res.json({ token: signToken(claims), user: publicUser(user) });
  });

  app.post('/api/auth/register', async (req, res) => {
    const { companyName, industry, name, email, password } = req.body as {
      companyName?: string;
      industry?: string;
      role?: Role;
      name?: string;
      email?: string;
      password?: string;
    };

    const role = req.body.role as Role | undefined;
    if (!role || !['admin', 'client'].includes(role)) {
      res.status(400).json({ message: 'Please choose a valid signup role.' });
      return;
    }

    if (!name || !email || !password) {
      res.status(400).json({ message: 'Name, email, and password are required.' });
      return;
    }

    if (!emailPattern.test(email)) {
      res.status(400).json({ message: 'Enter a valid email address.' });
      return;
    }

    const existingUser = await repository.findUserByEmail(email);
    if (existingUser) {
      res.status(409).json({ message: 'An account with this email already exists. Please sign in instead.' });
      return;
    }

    let created: Awaited<ReturnType<typeof repository.createCompany>> | Awaited<ReturnType<typeof repository.createClientUser>>;
    if (role === 'admin') {
      if (!companyName || !industry) {
        res.status(400).json({ message: 'All registration fields are required.' });
        return;
      }
      created = await repository.createCompany(companyName, industry, { name, email, password, role });
    } else {
      created = await repository.createClientUser({ role, name, email, password });
    }

    const user = await repository.findUserByEmail(created.user.email);
    if (!user) {
      res.status(500).json({ message: 'Unable to create account.' });
      return;
    }

    const claims = buildClaims(user);
    res.status(201).json({ token: signToken(claims), user: publicUser(user), company: 'company' in created ? created.company : undefined });
  });

  app.get('/api/public/workspaces', async (_req, res) => {
    res.json(await repository.listPublicWorkspaces());
  });

  app.get('/api/me', authRequired, async (req, res) => {
    const user = await repository.findUserById(req.auth!.userId);
    if (!user) {
      res.status(404).json({ message: 'User not found.' });
      return;
    }
    res.json({ user: publicUser(user), claims: req.auth });
  });

  app.get('/api/dashboard', authRequired, async (req, res) => {
    res.json(await repository.getTenantOverview(req.auth!));
  });

  app.get('/api/companies', authRequired, async (req, res) => {
    res.json(await repository.listCompanies(req.auth!));
  });

  app.get('/api/branches', authRequired, async (req, res) => {
    res.json(await repository.listBranches(req.auth!));
  });

  app.post('/api/branches', authRequired, roleAllowed(['admin']), async (req, res) => {
    const { companyId, name, city, address, description, floors, seatCount, pricingPerSeat, meetingRoomCount, heroImageUrl, galleryImageUrls } = req.body as Record<string, unknown>;
    if (!companyId || !name || !city || !address || !floors || !seatCount || !pricingPerSeat) {
      res.status(400).json({ message: 'Branch data is incomplete.' });
      return;
    }
    res.status(201).json(await repository.createBranch(req.auth!, {
      companyId: String(companyId),
      name: String(name),
      city: String(city),
      address: String(address),
      description: description ? String(description) : undefined,
      floors: Number(floors),
      seatCount: Number(seatCount),
      pricingPerSeat: Number(pricingPerSeat),
      meetingRoomCount: meetingRoomCount ? Number(meetingRoomCount) : undefined,
      heroImageUrl: heroImageUrl ? String(heroImageUrl) : undefined,
      galleryImageUrls: Array.isArray(galleryImageUrls) ? galleryImageUrls.map((item) => String(item)).filter(Boolean) : []
    }));
  });

  app.get('/api/seats', authRequired, async (req, res) => {
    res.json(await repository.listSeats(req.auth!, req.query.branchId as string | undefined));
  });

  app.post('/api/seats/:seatId/book', authRequired, roleAllowed(['admin', 'client']), async (req, res) => {
    try {
      const seat = await repository.bookSeat(req.auth!, String(req.params.seatId), String(req.body.customerName ?? 'Walk-in member'));
      emitSeatUpdated(seat);
      res.json(seat);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : 'Seat booking failed.' });
    }
  });

  app.get('/api/meeting-rooms', authRequired, async (req, res) => {
    res.json(await repository.listMeetingRooms(req.auth!, req.query.branchId as string | undefined));
  });

  app.post('/api/seats/:seatId/cancel', authRequired, async (req, res) => {
    try {
      const result = await repository.cancelSeatBooking(req.auth!, String(req.params.seatId));
      const seats = await repository.listSeats(req.auth!, undefined);
      const seat = seats.find((item) => item.id === String(req.params.seatId));
      emitSeatUpdated(seat ?? { id: String(req.params.seatId), status: 'available' } as never);
      res.json(result);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : 'Cancel failed.' });
    }
  });

  app.post('/api/meeting-rooms/:roomId/cancel', authRequired, async (req, res) => {
    try {
      const result = await repository.cancelMeetingRoomBooking(req.auth!, String(req.params.roomId), String(req.body.bookingId ?? ''));
      res.json(result);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : 'Cancel failed.' });
    }
  });

  app.delete('/api/branches/:branchId', authRequired, roleAllowed(['admin']), async (req, res) => {
    try {
      const active = await repository.branchHasActiveOccupancy(String(req.params.branchId));
      if (active) return res.status(400).json({ message: 'Cannot delete branch with active occupancy or bookings.' });
      const result = await repository.deleteBranch(req.auth!, String(req.params.branchId));
      res.status(200).json(result);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : 'Delete failed.' });
    }
  });

  app.delete('/api/meeting-rooms/:roomId', authRequired, roleAllowed(['admin']), async (req, res) => {
    try {
      const active = await repository.roomHasActiveBooking(String(req.params.roomId));
      if (active) return res.status(400).json({ message: 'Cannot delete meeting room while it has active bookings.' });
      const result = await repository.deleteMeetingRoom(req.auth!, String(req.params.roomId));
      res.status(200).json(result);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : 'Delete failed.' });
    }
  });

  app.post('/api/meeting-rooms/:roomId/book', authRequired, roleAllowed(['admin', 'client']), async (req, res) => {
    try {
      const booking = await repository.bookMeetingRoom(
        req.auth!,
        String(req.params.roomId),
        String(req.body.customerName ?? 'Meeting guest'),
        String(req.body.startAt),
        String(req.body.endAt)
      );
      res.status(201).json(booking);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : 'Meeting room booking failed.' });
    }
  });

  app.get('/api/clients', authRequired, async (req, res) => {
    res.json(await repository.listClients(req.auth!));
  });

  app.post('/api/clients', authRequired, roleAllowed(['admin']), async (req, res) => {
    const { companyId, name, contactName, email, stage } = req.body as Record<string, string>;
    if (!companyId || !name || !contactName || !email || !stage) {
      res.status(400).json({ message: 'Client data is incomplete.' });
      return;
    }
    res.status(201).json(await repository.createClient(req.auth!, {
      companyId,
      name,
      contactName,
      email,
      stage: stage as never
    }));
  });

  app.get('/api/employees', authRequired, async (req, res) => {
    res.json(await repository.listEmployees(req.auth!));
  });

  app.post('/api/employees', authRequired, roleAllowed(['admin']), async (req, res) => {
    const { companyId, branchId, name, role, title, email } = req.body as Record<string, string>;
    if (!companyId || !name || !role || !title || !email) {
      res.status(400).json({ message: 'Employee data is incomplete.' });
      return;
    }
    const existingUser = await repository.findUserByEmail(email);
    if (existingUser) {
      res.status(409).json({ message: 'An account with this email already exists. Use a different email for staff records.' });
      return;
    }
    res.status(201).json(await repository.createEmployee(req.auth!, {
      companyId,
      branchId: branchId ?? null,
      name,
      role: role as Role,
      title,
      email
    }));
  });

  app.get('/api/bookings', authRequired, async (req, res) => {
    res.json(await repository.listBookings(req.auth!));
  });

  app.get('/api/invoices', authRequired, async (req, res) => {
    res.json(await repository.listInvoices(req.auth!));
  });

  app.post('/api/invoices', authRequired, roleAllowed(['admin']), async (req, res) => {
    const { branchId, clientId, quantity, rate } = req.body as Record<string, string | number>;
    if (!branchId || !clientId || !quantity || !rate) {
      res.status(400).json({ message: 'Invoice data is incomplete.' });
      return;
    }
    try {
      res.status(201).json(await repository.generateInvoice(req.auth!, { branchId: String(branchId), clientId: String(clientId), quantity: Number(quantity), rate: Number(rate) }));
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : 'Invoice generation failed.' });
    }
  });

  app.get('/api/notifications', authRequired, async (req, res) => {
    res.json(await repository.listNotifications(req.auth!));
  });

  app.get('/api/visitors', authRequired, roleAllowed(['admin']), async (req, res) => {
    const branchId = req.query.branchId ? String(req.query.branchId) : undefined;
    res.json(await repository.listVisitors(req.auth!, branchId));
  });

  app.post('/api/visitors/check-in', authRequired, roleAllowed(['admin']), async (req, res) => {
    const { branchId, visitorName, purpose, hostName, workspaceLocation } = req.body as Record<string, string>;
    if (!branchId || !visitorName || !purpose || !hostName || !workspaceLocation) {
      res.status(400).json({ message: 'Visitor check-in details are incomplete.' });
      return;
    }
    try {
      res.status(201).json(await repository.checkInVisitor(req.auth!, {
        branchId: String(branchId),
        visitorName: String(visitorName),
        purpose: String(purpose),
        hostName: String(hostName),
        workspaceLocation: String(workspaceLocation)
      }));
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : 'Visitor check-in failed.' });
    }
  });

  app.post('/api/visitors/:visitorId/check-out', authRequired, roleAllowed(['admin']), async (req, res) => {
    try {
      res.json(await repository.checkOutVisitor(req.auth!, String(req.params.visitorId)));
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : 'Visitor check-out failed.' });
    }
  });

  return app;
}
