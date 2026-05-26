import React, { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { createInvoice, getDashboard, listBranches, listClients, listCompanies, listInvoices } from '../api';
import { useToast } from '../components/Toast';
import { downloadInvoicePdf, resolveInvoiceContext } from '../lib/invoicePdf';
import type { Branch, Client, Company, DashboardResponse, Invoice } from '../types';
import { useAuthStore } from '../store/auth';
import { motion } from 'framer-motion';

function panelClassName(extra = '') {
  return `rounded-[28px] border border-slate-200/80 bg-white/85 shadow-[0_24px_80px_rgba(15,23,42,0.06)] backdrop-blur-xl ${extra}`;
}

function AnimatedStatCard({ label, value, hint, accent }: { label: string; value: string; hint: string; accent: string }) {
  return (
    <motion.div whileHover={{ y: -4 }} className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-soft">
      <div className="text-xs uppercase tracking-[0.3em] text-slate-400">{label}</div>
      <div className="mt-3 text-3xl font-bold" style={{ color: accent }}>{value}</div>
      <div className="mt-2 text-sm text-slate-500">{hint}</div>
    </motion.div>
  );
}

export function BillingPage() {
  const toast = useToast();
  const { user, claims } = useAuthStore();
  const isClient = claims?.role === 'client';
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState({ branchId: '', clientId: '', quantity: 1, rate: 14500 });

  useEffect(() => {
    if (isClient) {
      Promise.all([listInvoices(), listBranches(), listCompanies()]).then(([invoiceData, branchData, companyData]) => {
        setInvoices(invoiceData);
        setBranches(branchData);
        setCompanies(companyData);
      });
      return;
    }
    Promise.all([getDashboard(), listInvoices(), listBranches(), listClients(), listCompanies()]).then(([dashboardData, invoiceData, branchData, clientData, companyData]) => {
      setDashboard(dashboardData);
      setInvoices(invoiceData);
      setBranches(branchData);
      setClients(clientData);
      setCompanies(companyData);
      setForm((current) => ({ ...current, branchId: branchData[0]?.id ?? current.branchId, clientId: clientData[0]?.id ?? current.clientId }));
    });
  }, [isClient]);

  const paymentByInvoice = useMemo(() => new Map((dashboard?.payments ?? []).map((payment) => [payment.invoiceId, payment])), [dashboard]);

  const transactionMetrics = useMemo(() => {
    const payments = dashboard?.payments ?? [];
    return {
      total: payments.reduce((sum, payment) => sum + payment.amount, 0),
      paid: payments.filter((payment) => payment.status === 'paid').reduce((sum, payment) => sum + payment.amount, 0),
      pending: payments.filter((payment) => payment.status === 'pending' || payment.status === 'overdue').reduce((sum, payment) => sum + payment.amount, 0)
    };
  }, [dashboard]);

  const handleDownload = (invoice: Invoice) => {
    const payment = paymentByInvoice.get(invoice.id);
    const client = clients.find((item) => item.id === invoice.clientId);
    downloadInvoicePdf(resolveInvoiceContext(invoice, {
      clientName: isClient ? (user?.name ?? 'Client') : (client?.name ?? 'Client'),
      companies,
      branches,
      paymentStatus: payment?.status ?? invoice.status
    }));
    toast.success('Invoice downloaded', invoice.invoiceNumber);
  };

  const submit = async () => {
    try {
      const invoice = await createInvoice(form);
      setInvoices((current) => [invoice, ...current]);
      toast.success('Invoice generated', `${invoice.invoiceNumber} created with pending payment.`);
    } catch (error) {
      toast.error('Invoice failed', error instanceof Error ? error.message : 'Unable to generate invoice.');
    }
  };

  if (isClient) {
    return (
      <div className="space-y-6">
        <div className={panelClassName('px-5 py-4 md:px-7')}>
          <div className="text-2xl font-bold text-slate-900">Billing & payments</div>
          <div className="mt-1 text-sm text-slate-500">Booking-linked invoices and payment status for every workspace you book.</div>
        </div>
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="mt-4 space-y-3">
            {invoices.length ? invoices.map((invoice) => {
              const payment = paymentByInvoice.get(invoice.id);
              return (
                <div key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <div>
                    <div className="font-semibold text-slate-900">{invoice.invoiceNumber}</div>
                    <div className="text-sm text-slate-500">{invoice.lineItems[0]?.label ?? 'Workspace booking'} · ₹{invoice.total.toLocaleString()}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold capitalize text-slate-600">{payment?.status ?? invoice.status}</span>
                    <button onClick={() => handleDownload(invoice)} className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white">Download PDF</button>
                  </div>
                </div>
              );
            }) : <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">Book a desk or meeting room to generate your first invoice.</div>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className={panelClassName('px-5 py-4 md:px-7')}>
        <div className="text-2xl font-bold text-slate-900">Billing</div>
        <div className="mt-1 text-sm text-slate-500">Simple booking-linked invoicing, payment tracking, and downloadable PDFs.</div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <AnimatedStatCard label="Total billed" value={`₹${transactionMetrics.total.toLocaleString()}`} hint="All invoice amounts recorded." accent="#8b5cf6" />
        <AnimatedStatCard label="Collected" value={`₹${transactionMetrics.paid.toLocaleString()}`} hint="Paid workspace charges." accent="#34d399" />
        <AnimatedStatCard label="Pending" value={`₹${transactionMetrics.pending.toLocaleString()}`} hint="Awaiting payment confirmation." accent="#fb923c" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.05fr,0.95fr]">
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="text-lg font-semibold text-slate-900">Invoice history</div>
          <div className="mt-4 space-y-3">
            {invoices.map((invoice) => {
              const payment = paymentByInvoice.get(invoice.id);
              return (
                <div key={invoice.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-900">{invoice.invoiceNumber}</div>
                      <div className="text-sm text-slate-500">{invoice.lineItems[0]?.label} · ₹{invoice.total.toLocaleString()}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold capitalize">{payment?.status ?? invoice.status}</span>
                      <button onClick={() => handleDownload(invoice)} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700">PDF</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="text-lg font-semibold text-slate-900">Generate invoice</div>
            <div className="mt-4 space-y-3">
              <select value={form.branchId} onChange={(event) => setForm((current) => ({ ...current, branchId: event.target.value }))} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm">
                {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </select>
              <select value={form.clientId} onChange={(event) => setForm((current) => ({ ...current, clientId: event.target.value }))} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm">
                {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
              </select>
              <input value={form.quantity} type="number" onChange={(event) => setForm((current) => ({ ...current, quantity: Number(event.target.value) }))} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
              <input value={form.rate} type="number" onChange={(event) => setForm((current) => ({ ...current, rate: Number(event.target.value) }))} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
              <button onClick={() => void submit()} className="w-full rounded-2xl bg-violet-600 px-4 py-3 font-semibold text-white">Generate invoice</button>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="text-lg font-semibold text-slate-900">Transaction history</div>
            <div className="mt-4 space-y-3">
              {(dashboard?.payments ?? []).slice(0, 8).map((payment, index) => (
                <div key={payment.referenceId || `${payment.invoiceId}-${index}`} className="rounded-2xl bg-slate-50 p-3 text-sm">
                  <div className="font-semibold text-slate-900">₹{payment.amount.toLocaleString()}</div>
                  <div className="text-slate-500 capitalize">{payment.status}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="text-lg font-semibold text-slate-900">Payment status mix</div>
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { name: 'Paid', value: (dashboard?.payments ?? []).filter((payment) => payment.status === 'paid').length },
                  { name: 'Pending', value: (dashboard?.payments ?? []).filter((payment) => payment.status === 'pending').length },
                  { name: 'Refunded', value: (dashboard?.payments ?? []).filter((payment) => payment.status === 'refunded').length }
                ]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.08)" />
                  <XAxis dataKey="name" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Tooltip />
                  <Bar dataKey="value" fill="#8b5cf6" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
