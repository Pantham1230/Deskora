# Deskora

Deskora is a multi-tenant coworking Space OS for managing branches, seats, meeting rooms, clients, invoices, staff, and analytics.

## What’s Included

- `apps/server` is the Express + TypeScript API for auth, booking, billing, tenant isolation, and realtime updates.
- `apps/web` is the Vite + React frontend with the dashboard, booking flows, CRM views, and analytics pages.
- `apps/server/db` contains the PostgreSQL schema and seed data used by the server.

## Getting Started

1. Install dependencies from the repository root with `npm install`.
2. Start the API with `npm run dev`.
3. In a second terminal, start the frontend with `npm run dev:web`.
4. Optionally set `DATABASE_URL` if you want the server to use PostgreSQL instead of the seeded in-memory store.
5. Optionally run `npm run seed` to refresh the demo data.

## Available Scripts

- `npm run dev` starts the API on port `4000`.
- `npm run dev:web` starts the web app on port `5173` and proxies `/api` to the backend.
- `npm run build` builds both workspaces.
- `npm run start` builds the project and starts the server.
- `npm run seed` loads the server seed data.

## Authentication

Deskora uses three roles:

- `admin` for full tenant operations, branch setup, billing, analytics, employee management, and booking controls.
- `staff` for day-to-day operations, bookings, client handling, and branch support within the assigned tenant.
- `client` for seat and meeting-room booking, feedback, and tenant-safe workspace visibility.

Authentication entry points:

- `/sign-in` is the canonical login screen.
- `/login` redirects to `/sign-in` for compatibility.
- Unauthenticated access to `/app/*` also redirects to `/sign-in`.

## Project Notes

- Seeded demo accounts live in `apps/server/src/seed.ts`.
- The frontend stores only the auth token and claims in `localStorage` through `apps/web/src/store/auth.ts`.
- All records include `tenant_id` for isolation.
- Booking logic prevents double-booking for seats and meeting rooms.
- Invoice generation and notifications use deterministic mock data so the UI works without external services.

## Runtime

- API: `http://localhost:4000`
- Web app: `http://localhost:5173`
- The Vite app proxies `/api` to the backend during development.
