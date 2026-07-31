import { calculateInvoiceTotals } from "../../lib/money";
import { formatMoneyIntl } from "../../lib/currency";

function money(amount: number, currency: string): string {
  return formatMoneyIntl(amount, currency);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface DocumentItem {
  description: string;
  quantity: number;
  rate: number;
}

interface BusinessInfo {
  name: string;
  logo?: string | null;
}

/**
 * Server-rendered HTML matching the content of the on-screen "Print Sheet"
 * view in InvoiceReceiptBuilder.tsx (business header, line items, totals) -
 * sent as the email body itself rather than a binary PDF attachment, so the
 * server doesn't need a heavyweight PDF-rendering dependency (Puppeteer,
 * wkhtmltopdf, etc.) just for this one feature.
 *
 * `currency` is the DOCUMENT's own currency (invoice.currency), not
 * necessarily the business's current currency - a document keeps whatever
 * currency it was issued in even if the business later switches.
 */
export function renderInvoiceEmailHtml(params: {
  business: BusinessInfo;
  currency: string;
  invoiceNumber: string;
  date: string;
  dueDate: string;
  customerName: string;
  items: DocumentItem[];
  discount: number;
  taxRate: number;
}): string {
  const totals = calculateInvoiceTotals(params.items, params.discount, params.taxRate);
  const currency = params.currency;

  const rows = params.items
    .map(
      (item) => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #eee;">${escapeHtml(item.description)}</td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:center;">${item.quantity}</td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;">${money(item.rate, currency)}</td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;">${money(item.rate * item.quantity, currency)}</td>
        </tr>`
    )
    .join("");

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#1e293b;max-width:600px;margin:0 auto;">
    <div style="border-bottom:3px solid #102A43;padding-bottom:16px;margin-bottom:24px;">
      <h1 style="font-size:20px;margin:0;color:#102A43;">${escapeHtml(params.business.name)}</h1>
      <p style="margin:4px 0 0;color:#64748b;font-size:13px;">Invoice ${escapeHtml(params.invoiceNumber)}</p>
    </div>
    <table style="width:100%;font-size:13px;margin-bottom:16px;">
      <tr>
        <td style="color:#64748b;">Billed to</td>
        <td style="text-align:right;color:#64748b;">Date / Due</td>
      </tr>
      <tr>
        <td style="font-weight:bold;">${escapeHtml(params.customerName)}</td>
        <td style="text-align:right;font-weight:bold;">${escapeHtml(params.date)} / ${escapeHtml(params.dueDate)}</td>
      </tr>
    </table>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead>
        <tr style="text-align:left;color:#64748b;text-transform:uppercase;font-size:11px;">
          <th style="padding-bottom:8px;">Description</th>
          <th style="padding-bottom:8px;text-align:center;">Qty</th>
          <th style="padding-bottom:8px;text-align:right;">Rate</th>
          <th style="padding-bottom:8px;text-align:right;">Amount</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <table style="width:100%;font-size:13px;margin-top:16px;">
      <tr><td style="color:#64748b;">Subtotal</td><td style="text-align:right;">${money(totals.subtotal, currency)}</td></tr>
      ${params.discount > 0 ? `<tr><td style="color:#64748b;">Discount (${params.discount}%)</td><td style="text-align:right;">-${money(totals.discountAmount, currency)}</td></tr>` : ""}
      ${params.taxRate > 0 ? `<tr><td style="color:#64748b;">Tax (${params.taxRate}%)</td><td style="text-align:right;">+${money(totals.taxAmount, currency)}</td></tr>` : ""}
      <tr style="font-weight:bold;font-size:15px;"><td style="padding-top:8px;">Total</td><td style="text-align:right;padding-top:8px;">${money(totals.total, currency)}</td></tr>
    </table>
    <p style="margin-top:32px;color:#94a3b8;font-size:11px;">Sent via Aziiki - Your Business. Organized.</p>
  </div>`;
}

export function renderReceiptEmailHtml(params: {
  business: BusinessInfo;
  currency: string;
  receiptNumber: string;
  date: string;
  customerName: string;
  description: string;
  amountPaid: number;
  paymentMethod: string;
}): string {
  const currency = params.currency;
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#1e293b;max-width:600px;margin:0 auto;">
    <div style="border-bottom:3px solid #10B981;padding-bottom:16px;margin-bottom:24px;">
      <h1 style="font-size:20px;margin:0;color:#102A43;">${escapeHtml(params.business.name)}</h1>
      <p style="margin:4px 0 0;color:#64748b;font-size:13px;">Receipt ${escapeHtml(params.receiptNumber)}</p>
    </div>
    <table style="width:100%;font-size:13px;">
      <tr><td style="color:#64748b;padding:6px 0;">Received from</td><td style="text-align:right;font-weight:bold;">${escapeHtml(params.customerName)}</td></tr>
      <tr><td style="color:#64748b;padding:6px 0;">Date</td><td style="text-align:right;">${escapeHtml(params.date)}</td></tr>
      <tr><td style="color:#64748b;padding:6px 0;">Payment method</td><td style="text-align:right;">${escapeHtml(params.paymentMethod)}</td></tr>
      <tr><td style="color:#64748b;padding:6px 0;">Description</td><td style="text-align:right;">${escapeHtml(params.description)}</td></tr>
      <tr style="font-weight:bold;font-size:15px;"><td style="padding-top:12px;">Amount paid</td><td style="text-align:right;padding-top:12px;">${money(params.amountPaid, currency)}</td></tr>
    </table>
    <p style="margin-top:32px;color:#94a3b8;font-size:11px;">Sent via Aziiki - Your Business. Organized.</p>
  </div>`;
}
