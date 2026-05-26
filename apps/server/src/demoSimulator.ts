import { repository as repo } from './store.js';
import { emitSeatUpdated, emitNotification, emitBookingEvent, emitDashboardRefresh } from './realtime.js';
import { v4 as uuid } from 'uuid';

function randomInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick<T>(arr: T[]) { return arr[Math.floor(Math.random() * arr.length)]; }

let running = false;

export function startDemoSimulation() {
  if (running) return;
  // only start when in-memory repository is available
  // access in-memory seed data
  const data: any = (repo as any).data;
  if (!data) return;
  running = true;
  console.log('Demo simulator started (in-memory mode)');

  // emit an initial dashboard refresh
  data.companies.forEach((c: any) => emitDashboardRefresh(c.tenantId));

  setInterval(() => {
    const tenants: string[] = data.branches.map((b: any) => String(b.tenantId));
    const tenantId: string = String(pick(tenants));
    const branches: any[] = data.branches.filter((b: any) => String(b.tenantId) === tenantId);
    const branch: any = pick(branches) as any;
    const branchSeats: any[] = data.seats.filter((s: any) => s.branchId === branch.id);
    const branchRooms: any[] = data.meetingRooms.filter((r: any) => r.branchId === branch.id);

    const eventType = pick(['seatBooking', 'meetingBooking', 'payment', 'invoice', 'newClient', 'feedback', 'occupancySpike']);

    try {
      switch (eventType) {
        case 'seatBooking': {
          const available = branchSeats.filter((s: any) => s.status === 'available');
          if (!available.length) break;
          const seat: any = pick(available);
          const customer = `DemoUser ${randomInt(100,999)}`;
          // call repository.bookSeat as platform admin for that tenant
          const admin = data.users.find((u: any) => u.role === 'admin' && u.tenantId === tenantId);
          const claims = { userId: admin.id, tenantId, companyId: admin.companyId, branchId: null, role: 'admin', email: admin.email };
          const booked = repo.bookSeat(claims as any, seat.id, customer) as any;
          emitSeatUpdated(booked);
          emitBookingEvent({ id: uuid(), tenantId: String(booked.tenantId), companyId: String(booked.companyId), branchId: String(booked.branchId), resourceType: 'seat', resourceId: String(booked.id), customerName: String(customer), startAt: new Date().toISOString(), endAt: new Date(Date.now() + 24*60*60*1000).toISOString(), status: 'booked' });
          emitNotification({ id: uuid(), tenantId: String(tenantId), companyId: String(booked.companyId), type: 'booking', title: 'Seat reserved', body: `${String(seat.label)} reserved by ${String(customer)}` });
          emitDashboardRefresh(String(tenantId));
          break;
        }
        case 'meetingBooking': {
          if (!branchRooms.length) break;
          const room: any = pick(branchRooms);
          const customer = `Team ${randomInt(10,99)}`;
          const admin = data.users.find((u: any) => u.role === 'admin' && u.tenantId === tenantId);
          const claims = { userId: admin.id, tenantId, companyId: admin.companyId, branchId: null, role: 'admin', email: admin.email };
          const startAt = new Date(Date.now() + randomInt(2,12) * 60 * 60 * 1000).toISOString();
          const endAt = new Date(Date.now() + (randomInt(3,13) * 60 * 60 * 1000)).toISOString();
          const booking: any = repo.bookMeetingRoom(claims as any, room.id, customer, startAt, endAt);
          emitBookingEvent(booking as any);
          emitNotification({ id: uuid(), tenantId: String(tenantId), companyId: String(booking.companyId), type: 'booking', title: 'Meeting room reserved', body: `${String(room.name)} reserved by ${String(customer)}` });
          emitDashboardRefresh(String(tenantId));
          break;
        }
        case 'payment': {
          // randomly mark a pending payment as paid
          const pending = data.payments.filter((p: any) => p.status === 'pending');
          if (!pending.length) break;
          const p: any = pick(pending);
          p.status = 'paid';
          p.paidAt = new Date().toISOString();
          emitNotification({ id: uuid(), tenantId: String(p.tenantId), companyId: String(p.companyId), type: 'payment', title: 'Payment completed', body: `Payment of ₹${p.amount} completed.` });
          emitDashboardRefresh(String(p.tenantId));
          break;
        }
        case 'invoice': {
          // generate an invoice for a random client
          const clients = data.clients.filter((c: any) => c.tenantId === tenantId);
          if (!clients.length) break;
          const client: any = pick(clients);
          const admin = data.users.find((u: any) => u.role === 'admin' && u.tenantId === tenantId);
          const claims = { userId: admin.id, tenantId, companyId: admin.companyId, branchId: null, role: 'admin', email: admin.email };
          const invoice: any = repo.generateInvoice(claims as any, { branchId: String(branch.id), clientId: String(client.id), quantity: randomInt(1,10), rate: Number(branch.pricingPerSeat) });
          emitNotification({ id: uuid(), tenantId: String(tenantId), companyId: String(invoice.companyId), type: 'payment', title: 'New invoice', body: `${String(invoice.invoiceNumber)} created for ${String(client.name)}` });
          emitDashboardRefresh(String(tenantId));
          break;
        }
        case 'newClient': {
          const admin = data.users.find((u: any) => u.role === 'admin' && u.tenantId === tenantId);
          const claims = { userId: admin.id, tenantId, companyId: admin.companyId, branchId: null, role: 'admin', email: admin.email };
          const name = `Client ${randomInt(100,999)}`;
          const client: any = repo.createClient(claims as any, { companyId: admin.companyId, name, contactName: 'Demo Contact', email: `${name.replace(/\s+/g,'').toLowerCase()}@demo.com`, stage: 'active' });
          emitNotification({ id: uuid(), tenantId: String(tenantId), companyId: String(client.companyId), type: 'booking', title: 'New client onboarded', body: `${String(client.name)} joined ${String(branch.name)}` });
          emitDashboardRefresh(String(tenantId));
          break;
        }
        case 'feedback': {
          const sample = ['Loved the lounge', 'AV needed in one room', 'Service was exceptional', 'Need more focus pods'];
          const msg = pick(sample);
          const clientForFb: any = pick(data.clients.filter((c:any)=>c.tenantId===tenantId));
          const fb: any = { id: uuid(), tenantId: String(tenantId), companyId: String(branch.companyId), branchId: String(branch.id), clientId: String(clientForFb.id), rating: pick([3,4,5]), category: 'workspace', message: msg, sentiment: 'positive', createdAt: new Date().toISOString() };
          data.feedback.unshift(fb);
          emitNotification({ id: uuid(), tenantId: String(tenantId), companyId: String(branch.companyId), type: 'renewal', title: 'Feedback received', body: String(msg) });
          emitDashboardRefresh(String(tenantId));
          break;
        }
        case 'occupancySpike': {
          // randomly set some available seats to reserved/booked to simulate spike
          const candidates = branchSeats.filter((s:any)=>s.status==='available');
          if (!candidates.length) break;
          const count = Math.max(1, Math.min(5, Math.floor(candidates.length * 0.12)));
          for (let i=0;i<count;i++){
            const seat: any = pick(candidates);
            seat.status = pick(['reserved','booked']);
            emitSeatUpdated(seat as any);
          }
          emitNotification({ id: uuid(), tenantId: String(tenantId), companyId: String(branch.companyId), type: 'booking', title: 'Occupancy spike', body: `${String(branch.name)} experiencing a short spike in occupancy.` });
          emitDashboardRefresh(String(tenantId));
          break;
        }
      }
    } catch (err) {
      // ignore simulation errors
      // console.error('Simulator error', err);
    }
  }, 3000 + Math.random() * 4000);
}

export function stopDemoSimulation() { running = false; }
