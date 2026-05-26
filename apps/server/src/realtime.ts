import { createServer } from 'node:http';
import { Server as SocketServer } from 'socket.io';
import { verifyToken } from './auth.js';
import type { SeatRecord } from './types.js';

let io: SocketServer | null = null;

export function attachRealtime(server: ReturnType<typeof createServer>) {
  io = new SocketServer(server, {
    cors: {
      origin: '*'
    }
  });

  io.use((socket, next) => {
    try {
      const token = String(socket.handshake.auth?.token ?? socket.handshake.headers.authorization?.replace('Bearer ', '') ?? '');
      if (!token) {
        throw new Error('Missing token');
      }
      socket.data.claims = verifyToken(token);
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const claims = socket.data.claims as { tenantId: string; branchId: string | null; role: string };
    socket.join(`tenant:${claims.tenantId}`);
    if (claims.branchId) {
      socket.join(`branch:${claims.branchId}`);
    }
    socket.emit('realtime:ready', { tenantId: claims.tenantId, role: claims.role });
  });
}

export function emitSeatUpdated(seat: SeatRecord) {
  io?.to(`tenant:${seat.tenantId}`).emit('seat:updated', seat);
  io?.to(`branch:${seat.branchId}`).emit('seat:updated', seat);
}

export function emitNotification(notification: { id: string; tenantId: string; companyId: string; type: string; title: string; body: string; createdAt?: string }) {
  io?.to(`tenant:${notification.tenantId}`).emit('notification:created', notification);
}

export function emitBookingEvent(booking: { id: string; tenantId: string; companyId: string; branchId: string; resourceType: string; resourceId: string; customerName: string; startAt: string; endAt: string; status: string }) {
  io?.to(`tenant:${booking.tenantId}`).emit('booking:created', booking);
  io?.to(`branch:${booking.branchId}`).emit('booking:created', booking);
  if (booking.resourceType === 'seat') {
    // also emit seat updated for visual changes
    io?.to(`tenant:${booking.tenantId}`).emit('seat:updated', { id: booking.resourceId, tenantId: booking.tenantId, branchId: booking.branchId, status: booking.status } as any);
    io?.to(`branch:${booking.branchId}`).emit('seat:updated', { id: booking.resourceId, tenantId: booking.tenantId, branchId: booking.branchId, status: booking.status } as any);
  }
}

export function emitDashboardRefresh(tenantId: string) {
  io?.to(`tenant:${tenantId}`).emit('dashboard:refresh', { tenantId, ts: Date.now() });
}
