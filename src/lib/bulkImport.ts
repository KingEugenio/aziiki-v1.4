import { api } from "./api";
import type {
  Business,
  Customer,
  Transaction,
  Invoice,
  Receipt,
  Quotation,
  Investment,
  Asset,
  Goal,
  Debt,
  InventoryItem,
} from "../types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: string | undefined | null): v is string => Boolean(v && UUID_RE.test(v));

export interface ImportableState {
  businesses: Business[];
  customers: Customer[];
  transactions: Transaction[];
  invoices: Invoice[];
  receipts: Receipt[];
  quotations: Quotation[];
  investments: Investment[];
  assets: Asset[];
  goals: Goal[];
  debts: Debt[];
  inventory: InventoryItem[];
}

/**
 * One-time migration path used when a guest (localStorage-only) session
 * converts to a real account, or when a brand-new account is seeded with
 * demo data. Every locally-generated id (e.g. "biz-1", "tx-abc123") is
 * discarded in favor of a real Postgres-issued UUID; foreign keys
 * (businessId, customerId) are remapped along the way so relational
 * integrity holds once the rows land behind RLS.
 *
 * This is intentionally the SAME shape of transform a one-off Firestore ->
 * Postgres migration script would need to run for early test users - see
 * scripts/migrate-firestore-to-supabase.md.
 */
export async function bulkImportState(state: ImportableState): Promise<ImportableState> {
  const businessIdMap = new Map<string, string>();
  const customerIdMap = new Map<string, string>();

  const newBusinesses: Business[] = [];
  for (const biz of state.businesses) {
    const created = await api.businesses.create({
      id: isUuid(biz.id) ? biz.id : undefined,
      name: biz.name,
      industry: biz.industry,
      logo: biz.logo,
      primaryColor: biz.primaryColor,
      taxRate: biz.taxRate,
      currency: biz.currency,
      description: biz.description,
      businessType: biz.businessType,
      allowFinancialApprovals: biz.allowFinancialApprovals,
      isPersonal: biz.isPersonal,
      locked: biz.locked,
    });
    businessIdMap.set(biz.id, created.id);
    newBusinesses.push({ ...biz, id: created.id, partners: [], shareholders: [], roles: [], auditLogs: [] });
  }

  const resolveBusinessId = (id: string) => businessIdMap.get(id) ?? id;

  const newCustomers: Customer[] = [];
  for (const c of state.customers) {
    const created = await api.customers.create({
      id: isUuid(c.id) ? c.id : undefined,
      businessId: resolveBusinessId(c.businessId),
      name: c.name,
      email: c.email || undefined,
      phone: c.phone,
      notes: c.notes,
      category: c.category,
      avatarColor: c.avatarColor,
    });
    customerIdMap.set(c.id, created.id);
    newCustomers.push(created);
  }

  const resolveCustomer = (customerId: string | undefined) => {
    if (!customerId) return { customerId: undefined, customClientName: undefined };
    if (customerIdMap.has(customerId)) return { customerId: customerIdMap.get(customerId), customClientName: undefined };
    if (customerId.startsWith("custom-")) return { customerId: undefined, customClientName: customerId.slice(7) };
    return { customerId: undefined, customClientName: customerId };
  };

  const newTransactions: Transaction[] = [];
  for (const t of state.transactions) {
    const { customerId } = resolveCustomer(t.customerId);
    const created = await api.transactions.create({
      id: isUuid(t.id) ? t.id : undefined,
      businessId: resolveBusinessId(t.businessId),
      date: t.date,
      type: t.type,
      category: t.category,
      amount: t.amount,
      description: t.description,
      paymentMethod: t.paymentMethod,
      customerId,
      proofUri: t.proofUri,
    });
    newTransactions.push(created);
  }

  const newInvoices: Invoice[] = [];
  for (const inv of state.invoices) {
    const { customerId, customClientName } = resolveCustomer(inv.customerId);
    const created = await api.invoices.create({
      id: isUuid(inv.id) ? inv.id : undefined,
      businessId: resolveBusinessId(inv.businessId),
      customerId,
      customClientName,
      invoiceNumber: inv.invoiceNumber,
      date: inv.date,
      dueDate: inv.dueDate,
      items: inv.items,
      discount: inv.discount,
      taxRate: inv.taxRate,
      status: inv.status,
      partialPaidAmount: inv.partialPaidAmount,
    });
    newInvoices.push(created);
  }

  const newReceipts: Receipt[] = [];
  for (const r of state.receipts) {
    const { customerId, customClientName } = resolveCustomer(r.customerId);
    const created = await api.receipts.create({
      id: isUuid(r.id) ? r.id : undefined,
      businessId: resolveBusinessId(r.businessId),
      customerId,
      customClientName,
      receiptNumber: r.receiptNumber,
      date: r.date,
      description: r.description,
      amountPaid: r.amountPaid,
      paymentMethod: r.paymentMethod,
    });
    newReceipts.push(created);
  }

  const newQuotations: Quotation[] = [];
  for (const q of state.quotations) {
    const { customerId, customClientName } = resolveCustomer(q.customerId);
    const created = await api.quotations.create({
      id: isUuid(q.id) ? q.id : undefined,
      businessId: resolveBusinessId(q.businessId),
      customerId,
      customClientName,
      quoteNumber: q.quoteNumber,
      date: q.date,
      validUntil: q.validUntil,
      items: q.items,
      discount: q.discount,
      status: q.status,
    });
    newQuotations.push(created);
  }

  const newInvestments: Investment[] = [];
  for (const inv of state.investments) {
    const created = await api.investments.create({
      id: isUuid(inv.id) ? inv.id : undefined,
      businessId: inv.businessId ? resolveBusinessId(inv.businessId) : undefined,
      type: inv.type,
      name: inv.name,
      institution: inv.institution,
      value: inv.value,
      amountInvested: inv.amountInvested,
      maturityDate: inv.maturityDate,
      expectedReturnRate: inv.expectedReturnRate,
      dateAcquired: inv.dateAcquired,
      notes: inv.notes,
    });
    newInvestments.push(created);
  }

  const newAssets: Asset[] = [];
  for (const a of state.assets) {
    const created = await api.assets.create({
      id: isUuid(a.id) ? a.id : undefined,
      businessId: a.businessId ? resolveBusinessId(a.businessId) : undefined,
      name: a.name,
      category: a.category,
      purchaseDate: a.purchaseDate,
      purchasePrice: a.purchasePrice,
      currentValue: a.currentValue,
      depreciationMethod: a.depreciationMethod,
      usefulLifeYears: a.usefulLifeYears,
      salvageValue: a.salvageValue,
      maintenanceLastDate: a.maintenanceLastDate,
      maintenanceNextDate: a.maintenanceNextDate,
      maintenanceStatus: a.maintenanceStatus,
      maintenanceNotes: a.maintenanceNotes,
      documentsNotes: a.documentsNotes,
      notes: a.notes,
    });
    newAssets.push(created);
  }

  const newGoals: Goal[] = [];
  for (const g of state.goals) {
    const created = await api.goals.create({
      id: isUuid(g.id) ? g.id : undefined,
      businessId: resolveBusinessId(g.businessId),
      type: g.type,
      name: g.name,
      currentAmount: g.currentAmount,
      targetAmount: g.targetAmount,
      deadline: g.deadline,
    });
    newGoals.push(created);
  }

  const newDebts: Debt[] = [];
  for (const d of state.debts) {
    const created = await api.debts.create({
      id: isUuid(d.id) ? d.id : undefined,
      businessId: d.businessId ? resolveBusinessId(d.businessId) : undefined,
      creditor: d.creditor,
      amount: d.amount,
      interestRate: d.interestRate,
      dueDate: d.dueDate,
      type: d.type,
    });
    newDebts.push(created);
  }

  const newInventory: InventoryItem[] = [];
  for (const i of state.inventory) {
    const created = await api.inventory.create({
      id: isUuid(i.id) ? i.id : undefined,
      businessId: resolveBusinessId(i.businessId),
      name: i.name,
      sku: i.sku,
      quantity: i.quantity,
      minStockAlert: i.minStockAlert,
      unitCost: i.unitCost,
      unitPrice: i.unitPrice,
      supplierName: i.supplierName,
      supplierContact: i.supplierContact,
    });
    newInventory.push(created);
  }

  return {
    businesses: newBusinesses,
    customers: newCustomers,
    transactions: newTransactions,
    invoices: newInvoices,
    receipts: newReceipts,
    quotations: newQuotations,
    investments: newInvestments,
    assets: newAssets,
    goals: newGoals,
    debts: newDebts,
    inventory: newInventory,
  };
}
