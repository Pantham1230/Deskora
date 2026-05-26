import { jsPDF } from 'jspdf';
import type { Branch, Company, Invoice, PaymentStatus } from '../types';

export type InvoicePdfContext = {
  invoice: Invoice;
  clientName: string;
  companyName: string;
  branchName: string;
  resourceName: string;
  bookingDate: string;
  bookingTime: string;
  duration: string;
  paymentStatus: PaymentStatus | string;
  workspaceBrand?: string;
};

export function buildInvoicePdf(context: InvoicePdfContext) {
  const pdf = new jsPDF();
  const brand = context.workspaceBrand ?? 'Deskora';
  const margin = 16;

  pdf.setFillColor(139, 92, 246);
  pdf.rect(0, 0, 210, 36, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(20);
  pdf.text(brand, margin, 18);
  pdf.setFontSize(10);
  pdf.text('Coworking Invoice', margin, 28);

  pdf.setTextColor(30, 41, 59);
  pdf.setFontSize(11);
  let y = 48;
  const row = (label: string, value: string) => {
    pdf.setFont('helvetica', 'bold');
    pdf.text(label, margin, y);
    pdf.setFont('helvetica', 'normal');
    pdf.text(value, margin + 52, y);
    y += 8;
  };

  row('Invoice ID', context.invoice.invoiceNumber);
  row('Client', context.clientName);
  row('Workspace', context.companyName);
  row('Branch', context.branchName);
  row('Seat / Room', context.resourceName);
  row('Booking Date', context.bookingDate);
  row('Booking Time', context.bookingTime);
  row('Duration', context.duration);
  row('Amount', `₹${context.invoice.total.toLocaleString()}`);
  row('Payment Status', String(context.paymentStatus));
  row('Generated', new Date().toLocaleString());

  y += 6;
  pdf.setDrawColor(226, 232, 240);
  pdf.line(margin, y, 194, y);
  y += 10;
  pdf.setFontSize(9);
  pdf.setTextColor(100, 116, 139);
  pdf.text('GST placeholder: 18% applicable where required.', margin, y);
  y += 6;
  pdf.text('support@deskora.com', margin, y);

  return pdf;
}

export function downloadInvoicePdf(context: InvoicePdfContext) {
  buildInvoicePdf(context).save(`${context.invoice.invoiceNumber}.pdf`);
}

export function resolveInvoiceContext(
  invoice: Invoice,
  options: {
    clientName: string;
    companies: Company[];
    branches: Branch[];
    resourceName?: string;
    paymentStatus?: string;
  }
) {
  const branch = options.branches.find((item) => item.id === invoice.branchId);
  const company = options.companies.find((item) => item.id === invoice.companyId);
  const line = invoice.lineItems[0];
  return {
    invoice,
    clientName: options.clientName,
    companyName: company?.name ?? 'Workspace',
    branchName: branch?.name ?? 'Branch',
    resourceName: options.resourceName ?? line?.label ?? 'Booking',
    bookingDate: new Date(invoice.issueDate).toLocaleDateString(),
    bookingTime: new Date(invoice.issueDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    duration: line ? `${line.quantity} unit(s)` : '—',
    paymentStatus: options.paymentStatus ?? invoice.status,
    workspaceBrand: company?.name ?? 'Deskora'
  } satisfies InvoicePdfContext;
}
