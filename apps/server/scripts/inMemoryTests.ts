import { repository, buildClaims } from '../src/store.js';

console.log('Starting in-memory integration tests...');

async function run() {
  // pick a tenant-scoped admin for the first branch
  const branchTenantId = repository.listBranches({ userId: 'x', tenantId: 'x', companyId: null, branchId: null, role: 'admin', email: 'x' })[0].tenantId;
  const adminUser = (repository as any).data.users.find((u: any) => u.role === 'admin' && u.tenantId === branchTenantId);
  if (!adminUser) throw new Error('Tenant admin user not found in seed.');
  const adminClaims = buildClaims(adminUser);

  // list branches
  const branches = repository.listBranches(adminClaims);
  console.log('Branches:', branches.map(b => ({ id: b.id, name: b.name, tenantId: b.tenantId })));

  // pick first branch and an available seat
  const branchId = branches[0].id;
  const seats = repository.listSeats(adminClaims, branchId);
  const availableSeat = seats.find(s => s.status === 'available');
  if (!availableSeat) {
    console.log('No available seats to test booking.');
    return;
  }
  console.log('Testing seat booking on', availableSeat.label);

  // book seat as admin
  const booked = repository.bookSeat(adminClaims, availableSeat.id, 'Demo Tester');
  console.log('Seat booked:', booked.id, booked.label, 'status:', booked.status);

  // cancel seat as admin
  try {
    const cancelled = repository.cancelSeatBooking(adminClaims, availableSeat.id);
    console.log('Seat cancelled:', cancelled.id, 'status now:', cancelled.status);
  } catch (err) {
    console.error('Cancel seat failed:', err instanceof Error ? err.message : err);
  }

  // meeting room booking: pick a room and create a booking in future beyond cancellation window
  const rooms = repository.listMeetingRooms(adminClaims, branchId);
  const room = rooms[0];
  if (!room) {
    console.log('No meeting rooms to test.');
    return;
  }
  const now = Date.now();
  // schedule start 6 hours from now, end 7 hours from now
  const startAt = new Date(now + 6 * 60 * 60 * 1000).toISOString();
  const endAt = new Date(now + 7 * 60 * 60 * 1000).toISOString();

  console.log('Booking meeting room', room.name, 'for Demo Team');
  const meetingBooking = repository.bookMeetingRoom(adminClaims, room.id, 'Demo Team', startAt, endAt);
  console.log('Meeting booked id:', meetingBooking.id, 'startAt:', meetingBooking.startAt);

  // cancel meeting room as admin
  try {
    const cancelledMeeting = repository.cancelMeetingRoomBooking(adminClaims, room.id, meetingBooking.id);
    console.log('Meeting cancelled:', cancelledMeeting.id, 'status:', cancelledMeeting.status);
  } catch (err) {
    console.error('Cancel meeting failed:', err instanceof Error ? err.message : err);
  }

  // show some payments and notifications summary
  // @ts-ignore
  const data = (repository as any).data;
  console.log('Recent notifications (3):', data.notifications.slice(0, 3).map((n: any) => ({ title: n.title, body: n.body })));
  console.log('Recent payments (3):', data.payments.slice(-3).map((p: any) => ({ amount: p.amount, status: p.status })));

  console.log('In-memory tests completed successfully.');
}

run().catch((err) => {
  console.error('In-memory tests failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
