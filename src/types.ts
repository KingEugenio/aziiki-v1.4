export type PaymentMethod = "Mobile Money" | "Cash" | "Bank Transfer";

export interface Transaction {
  id: string;
  date: string;
  type: "income" | "expense";
  category: string;
  amount: number;
  description: string;
  paymentMethod: PaymentMethod;
  customerId?: string;
  proofUri?: string;
  businessId: string;
  currency?: string;
  exchangeRateToBusinessCurrency?: number;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  rate: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  date: string;
  dueDate: string;
  items: InvoiceItem[];
  discount: number; // percentage
  taxRate: number; // percentage
  status: "Draft" | "Sent" | "Paid" | "Overdue";
  partialPaidAmount: number;
  logoUrl?: string;
  businessId: string;
  currency?: string;
  exchangeRateToBusinessCurrency?: number;
}

export interface Receipt {
  id: string;
  receiptNumber: string;
  customerId: string;
  invoiceId?: string;
  date: string;
  description: string;
  amountPaid: number;
  paymentMethod: PaymentMethod;
  businessId: string;
  currency?: string;
  exchangeRateToBusinessCurrency?: number;
}

export interface Quotation {
  id: string;
  quoteNumber: string;
  customerId: string;
  date: string;
  validUntil: string;
  items: InvoiceItem[];
  discount: number;
  totalAmount: number;
  status: "Draft" | "Sent" | "Converted" | "Accepted";
  businessId: string;
  currency?: string;
  exchangeRateToBusinessCurrency?: number;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  notes: string;
  category: string;
  businessId: string;
  avatarColor: string;
  preferredCurrency?: string;
}

export interface Partner {
  id: string;
  name: string;
  ownershipPercentage: number;
  capitalContribution: number;
  withdrawals: number;
}

export interface Shareholder {
  id: string;
  name: string;
  sharesCount: number;
  equityValue: number;
  capitalContribution: number;
}

export type RoleType = "Owner" | "Admin" | "Accountant" | "Staff";

export interface UserRole {
  id: string;
  name: string;
  email: string;
  role: RoleType;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userName: string;
  action: string;
  details: string;
}

export interface Business {
  id: string;
  name: string;
  industry: string;
  logo: string;
  primaryColor: string;
  taxRate: number;
  currency: string;
  description: string;
  businessType?: "Sole Proprietor" | "Partnership" | "Company";
  partners?: Partner[];
  shareholders?: Shareholder[];
  roles?: UserRole[];
  allowFinancialApprovals?: boolean;
  auditLogs?: AuditLog[];
  locked?: boolean;
  countryCode?: string;
  timezone?: string;
  isPersonal?: boolean;
  accounts?: PersonalAccount[];
  budgets?: PersonalBudget[];
}

export interface PersonalAccount {
  id: string;
  name: string;
  type: "MTN Mobile Money" | "Telecel Cash" | "AirtelTigo Money" | "Bank Account" | "Cash Wallet" | "Savings Account";
  initialBalance: number;
  balance: number;
}

export interface PersonalBudget {
  category: string;
  limitAmount: number;
}

export interface Investment {
  id: string;
  type: "Treasury Bill" | "Mutual Fund" | "Fixed Deposit" | "Stock" | "Bond" | "Real Estate" | "Business Investment" | "Savings Account" | "SACCO/Cooperative";
  name: string;
  institution: string;
  value: number; // Current estimated value
  amountInvested: number; // Initial capital invested
  maturityDate?: string;
  expectedReturnRate: number; // annual representation in %
  dateAcquired: string; // purchase date
  notes?: string;
  businessId?: string;
}

export interface Asset {
  id: string;
  name: string;
  category: "Machinery" | "Equipment" | "Vehicle" | "Real Estate" | "Computer/IT" | "Other";
  purchaseDate: string;
  purchasePrice: number;
  currentValue: number;
  depreciationMethod?: "Straight Line" | "Double Declining" | "None";
  usefulLifeYears?: number; // for depreciation calculations
  salvageValue?: number; // residual value
  maintenanceLastDate?: string;
  maintenanceNextDate?: string;
  maintenanceStatus?: "Good" | "Needs Service" | "Overdue";
  maintenanceNotes?: string;
  documentsNotes?: string; // notes about warranties or receipts
  notes?: string;
  businessId?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  minStockAlert: number;
  unitCost: number;
  unitPrice: number;
  supplierName: string;
  supplierContact: string;
  businessId: string;
}

export interface Goal {
  id: string;
  type: "Revenue" | "Savings" | "Equipment" | "Expansion";
  name: string;
  currentAmount: number;
  targetAmount: number;
  deadline: string;
  businessId: string;
  currency?: string;
}

export interface Debt {
  id: string;
  creditor: string;
  amount: number;
  interestRate: number;
  dueDate: string;
  type: "Loan" | "Supplier Credit" | "Overdraft";
  businessId?: string;
  currency?: string;
}
