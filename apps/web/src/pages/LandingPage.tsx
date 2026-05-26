import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getPublicWorkspaces } from '../api';
import WorkspacePhoto from '../components/WorkspacePhoto';

function usePublicWorkspaces() {
  const [workspaces, setWorkspaces] = useState<Awaited<ReturnType<typeof getPublicWorkspaces>>['workspaces']>([]);

  useEffect(() => {
    let mounted = true;
    getPublicWorkspaces().then((response) => {
      if (mounted) setWorkspaces(response.workspaces);
    }).catch(() => {
      if (mounted) setWorkspaces([]);
    });
    return () => {
      mounted = false;
    };
  }, []);

  return workspaces;
}

const features = [
  { title: 'Multi-branch operations', desc: 'Coordinate teams, locations, and occupancy with a single operating layer.' },
  { title: 'Seat and room booking', desc: 'Premium booking flows for desks, cabins, and meeting rooms.' },
  { title: 'Realtime floor intelligence', desc: 'Live occupancy, spatial updates, and branch-specific activity.' },
  { title: 'Billing and invoices', desc: 'Subscriptions, payment states, and commercial reporting in one place.' },
  { title: 'CRM and feedback', desc: 'Track client stages, reviews, and workspace experience signals.' },
  { title: 'Command Center', desc: 'Investor-ready mission control for the whole coworking business.' }
];

const stats = [
  { label: 'Branches active', value: '05' },
  { label: 'Live occupancy', value: '74%' },
  { label: 'Invoices tracked', value: '128' },
  { label: 'Client NPS', value: '9.2' }
];

export default function LandingPage() {
  const workspaces = usePublicWorkspaces();
  const [cityFilter, setCityFilter] = useState('all');
  const cities = useMemo(() => ['all', ...Array.from(new Set(workspaces.map((workspace) => workspace.branch.city)))], [workspaces]);
  const filtered = useMemo(() => workspaces.filter((workspace) => cityFilter === 'all' || workspace.branch.city === cityFilter), [workspaces, cityFilter]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.12),transparent_28%),radial-gradient(circle_at_top_right,rgba(96,165,250,0.10),transparent_24%),linear-gradient(180deg,#fbf9f7_0%,#f4efe8_100%)] px-4 py-6 text-slate-900 md:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-[32px] border border-white/70 bg-white/78 px-5 py-4 shadow-[0_18px_60px_rgba(15,23,42,0.06)] backdrop-blur-xl md:px-7">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(139,92,246,0.95),rgba(96,165,250,0.9),rgba(45,212,191,0.85))] text-sm font-bold text-white shadow-lg">D</div>
              <div>
                <div className="text-xs uppercase tracking-[0.35em] text-slate-400">Deskora</div>
                <div className="font-display text-xl font-semibold text-slate-900">Coworking Operating System</div>
              </div>
            </div>
            <nav className="flex flex-wrap items-center gap-3 text-sm">
              <a href="#spaces" className="rounded-full px-4 py-2 text-slate-600 transition hover:bg-white hover:text-slate-900">Spaces</a>
              <a href="#features" className="rounded-full px-4 py-2 text-slate-600 transition hover:bg-white hover:text-slate-900">Features</a>
              <a href="#pricing" className="rounded-full px-4 py-2 text-slate-600 transition hover:bg-white hover:text-slate-900">Pricing</a>
              <Link to="/explore" className="rounded-full border border-slate-200 bg-white px-5 py-2.5 font-semibold text-slate-700 shadow-sm">Explore Workspaces</Link>
              <Link to="/sign-up" className="rounded-full border border-slate-200 bg-white px-5 py-2.5 font-semibold text-slate-700 shadow-sm">Sign up</Link>
              <Link to="/sign-in" className="rounded-full bg-slate-900 px-5 py-2.5 font-semibold text-white shadow-[0_12px_30px_rgba(15,23,42,0.14)]">Sign in</Link>
            </nav>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.05fr,0.95fr] lg:items-stretch">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }} className="rounded-[36px] border border-white/70 bg-white/80 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.07)] backdrop-blur-xl md:p-8">
            <div className="inline-flex rounded-full bg-[rgb(var(--role-accent-soft))] px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-[rgb(var(--role-accent-text))]">Modern coworking OS</div>
            <h1 className="mt-5 max-w-2xl font-display text-5xl font-bold leading-[1.02] text-slate-900 md:text-7xl">A premium command layer for modern coworking businesses.</h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">Deskora brings realtime bookings, billing, client operations, and spatial intelligence into one elegant control plane designed for investor demos and commercial teams.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/sign-up?role=admin" className="rounded-full bg-[linear-gradient(135deg,rgba(139,92,246,0.95),rgba(96,165,250,0.95))] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(139,92,246,0.24)]">Create workspace</Link>
              <Link to="/explore" className="rounded-full border border-slate-200 bg-white px-6 py-3.5 text-sm font-semibold text-slate-700 shadow-sm">Explore spaces</Link>
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.label} className="rounded-[24px] border border-slate-200/80 bg-white/90 p-4 shadow-sm">
                  <div className="text-xs uppercase tracking-[0.28em] text-slate-400">{stat.label}</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900">{stat.value}</div>
                </div>
              ))}
            </div>
          </motion.div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-[1.15fr,0.85fr]">
            <WorkspacePhoto title="Morning light in the main workspace" subtitle="Premium seating, soft acoustics, and a calm daytime atmosphere" tag="Featured workspace" className="min-h-[340px]" />
            <div className="grid gap-4">
              <WorkspacePhoto title="Open desk floor" subtitle="Collaboration-ready seating, bright interiors, and flexible layouts" tag="Workspace" className="min-h-[160px]" compact />
              <WorkspacePhoto title="Community lounge" subtitle="Coffee bar energy with warm, editorial styling" tag="Atmosphere" className="min-h-[160px]" compact />
            </div>
          </div>
        </section>

        <section id="spaces" className="space-y-4 rounded-[34px] border border-white/70 bg-white/78 p-5 shadow-[0_20px_70px_rgba(15,23,42,0.06)] backdrop-blur-xl md:p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-sm uppercase tracking-[0.32em] text-slate-400">Coworking marketplace</div>
              <h2 className="mt-2 font-display text-3xl font-semibold text-slate-900">Explore live coworking spaces across every brand and branch.</h2>
            </div>
            <div className="max-w-xl text-sm leading-6 text-slate-500">Browse occupancy, amenities, pricing, and availability before signing up. New branches automatically appear here when operators add them.</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {cities.map((city) => (
              <button key={city} onClick={() => setCityFilter(city)} className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${cityFilter === city ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {city === 'all' ? 'All cities' : city}
              </button>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((workspace) => (
              <div key={workspace.branch.id} className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                <WorkspacePhoto title={workspace.branch.name} subtitle={`${workspace.company.name} · ${workspace.branch.city}`} tag={workspace.company.industry} src={workspace.heroImageUrl} seed={workspace.gallerySeed} compact className="aspect-square rounded-none border-0" />
                <div className="p-4">
                  <div className="text-lg font-semibold text-slate-900">{workspace.branch.name}</div>
                  <div className="mt-1 text-sm text-slate-500">{workspace.company.name} · {workspace.branch.address}</div>
                  <div className="mt-2 text-sm leading-6 text-slate-500">{workspace.description}</div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-500">
                    <div className="rounded-2xl bg-slate-50 px-3 py-2">Occupancy {workspace.occupancyRate}%</div>
                    <div className="rounded-2xl bg-slate-50 px-3 py-2">Desks {workspace.availableDesks} open</div>
                    <div className="rounded-2xl bg-slate-50 px-3 py-2">Rooms {workspace.meetingRoomCount}</div>
                    <div className="rounded-2xl bg-slate-50 px-3 py-2">₹{workspace.pricingMin} - ₹{workspace.pricingMax}</div>
                    <div className="rounded-2xl bg-slate-50 px-3 py-2">Rating {workspace.rating}/5</div>
                    <div className="rounded-2xl bg-slate-50 px-3 py-2">{workspace.operatingHours}</div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {workspace.amenities.slice(0, 3).map((amenity) => <span key={amenity} className="rounded-full bg-[rgb(var(--role-accent-soft))] px-3 py-1 text-[11px] font-semibold text-[rgb(var(--role-accent-text))]">{amenity}</span>)}
                  </div>
                  <div className="mt-4 flex gap-3">
                    <Link to={`/workspace/${workspace.company.id}/${workspace.branch.id}`} className="rounded-full bg-[linear-gradient(135deg,rgba(139,92,246,0.95),rgba(96,165,250,0.95))] px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(139,92,246,0.24)]">Explore Workspace</Link>
                    <Link to={`/sign-up?role=client&branchId=${workspace.branch.id}`} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">Create account</Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="features" className="space-y-4">
          <div>
            <div className="text-sm uppercase tracking-[0.32em] text-slate-400">Features</div>
            <h2 className="mt-2 font-display text-3xl font-semibold text-slate-900">Everything feels polished, calm, and investor-ready.</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {features.map((feature, index) => (
              <motion.div key={feature.title} whileHover={{ y: -6 }} className="rounded-[28px] border border-white/80 bg-white/88 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.05)] backdrop-blur-xl">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(139,92,246,0.14),rgba(96,165,250,0.14),rgba(45,212,191,0.14))] text-sm font-semibold text-slate-700">0{index + 1}</div>
                  <div className="text-lg font-semibold text-slate-900">{feature.title}</div>
                </div>
                <div className="mt-3 text-sm leading-6 text-slate-500">{feature.desc}</div>
              </motion.div>
            ))}
          </div>
        </section>

        <section id="pricing" className="grid gap-4 xl:grid-cols-[0.95fr,1.05fr]">
          <div className="rounded-[34px] border border-white/70 bg-white/80 p-6 shadow-[0_20px_70px_rgba(15,23,42,0.06)] backdrop-blur-xl md:p-8">
            <div className="text-sm uppercase tracking-[0.32em] text-slate-400">Why spaces choose Deskora</div>
              <h2 className="mt-2 font-display text-3xl font-semibold text-slate-900">Spaces that feel calm, premium, and genuinely commercial.</h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-slate-500">Deskora showcases real coworking interiors, meeting rooms, and lounges so the platform feels like a real workplace network rather than a generic admin panel.</p>
            <div className="mt-6 space-y-3 text-sm text-slate-600">
              <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">Premium cabins with focus, privacy, and acoustic comfort.</div>
              <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">Meeting rooms built for presentations, workshops, and team sessions.</div>
              <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">Open lounges, desk zones, and cabins that feel active, warm, and believable.</div>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-[30px] border border-white/70 bg-white/90 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
              <div className="text-sm font-semibold text-slate-500">Starter</div>
              <div className="mt-3 text-4xl font-bold text-slate-900">₹4,999</div>
              <div className="mt-2 text-sm text-slate-500">For small studios and emerging operators.</div>
            </div>
            <div className="rounded-[30px] border border-[rgb(var(--role-accent))]/15 bg-[rgb(var(--role-accent-soft))] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
              <div className="inline-flex rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-[rgb(var(--role-accent-text))]">Popular</div>
              <div className="mt-3 text-4xl font-bold text-slate-900">₹14,999</div>
              <div className="mt-2 text-sm text-slate-500">Built for multi-branch coworking operations.</div>
            </div>
            <div className="rounded-[30px] border border-white/70 bg-white/90 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
              <div className="text-sm font-semibold text-slate-500">Enterprise</div>
              <div className="mt-3 text-4xl font-bold text-slate-900">Custom</div>
              <div className="mt-2 text-sm text-slate-500">For serious startups and enterprise coworking groups.</div>
            </div>
          </div>
        </section>

        <section id="testimonials" className="space-y-4 rounded-[34px] border border-white/70 bg-white/78 p-6 shadow-[0_20px_70px_rgba(15,23,42,0.06)] backdrop-blur-xl">
          <div className="text-sm uppercase tracking-[0.32em] text-slate-400">Testimonials</div>
          <div className="grid gap-4 md:grid-cols-3">
            <blockquote className="rounded-[28px] bg-white/90 p-5 shadow-sm">
              <div className="font-semibold text-slate-900">“The meeting rooms and lounge areas feel like a real premium coworking brand.”</div>
              <div className="mt-3 text-sm text-slate-500">— Maya Singh, Founder, Blue Oak Studios</div>
            </blockquote>
            <blockquote className="rounded-[28px] bg-white/90 p-5 shadow-sm">
              <div className="font-semibold text-slate-900">“The open desks and private cabins make the space feel active and believable.”</div>
              <div className="mt-3 text-sm text-slate-500">— Arjun Patel, Operations, Aurora Workspaces</div>
            </blockquote>
            <blockquote className="rounded-[28px] bg-white/90 p-5 shadow-sm">
              <div className="font-semibold text-slate-900">“The whole atmosphere feels like a real workspace network, not a demo mockup.”</div>
              <div className="mt-3 text-sm text-slate-500">— Nina Alvarez, Community Manager, Orbit Collective</div>
            </blockquote>
          </div>
        </section>

        <footer className="rounded-[28px] border border-white/70 bg-white/72 px-5 py-5 shadow-[0_18px_50px_rgba(15,23,42,0.05)] backdrop-blur-xl">
          <div className="flex flex-col gap-3 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
            <div>© {new Date().getFullYear()} Deskora — built for coworking operators.</div>
            <div className="flex gap-4">
              <a href="#spaces">Spaces</a>
              <a href="#pricing">Pricing</a>
              <a href="#testimonials">Testimonials</a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
