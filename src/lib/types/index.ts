// ============================================================
// Zenqar — Core TypeScript Types
// ============================================================

export type UserRole = 'owner' | 'admin' | 'accountant' | 'staff' | 'viewer';
export type ContactType = 'customer' | 'supplier' | 'both';
export type AccountType = 'cash' | 'bank' | 'wallet' | 'other';
export type CurrencyCode = 'IQD' | 'USD';
export type InvoiceStatus = 'draft' | 'issued' | 'sent' | 'accepted' | 'payment_claimed' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled';
export type TransactionType = 'payment_received' | 'expense_paid' | 'transfer_in' | 'transfer_out' | 'opening_balance' | 'manual_adjustment' | 'owner_deposit' | 'owner_withdrawal';
export type MembershipStatus = 'active' | 'pending' | 'suspended';
export type AppLanguage = 'en' | 'ar' | 'ku';

// ============================================================
// Database row types
// ============================================================

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  preferred_language: AppLanguage;
  phone: string | null;
  is_platform_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface Business {
  id: string;
  name: string;
  legal_name: string | null;
  logo_url: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  country: string;
  tax_number: string | null;
  invoice_prefix: string;
  invoice_sequence: number;
  default_currency: CurrencyCode;
  default_language: AppLanguage;
  timezone: string;
  verification_status?: 'unverified' | 'pending' | 'verified' | 'rejected';
  verification_notes?: string | null;
  tax_id_number?: string | null;
  business_registration_number?: string | null;
  incorporation_date?: string | null;
  industry?: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BusinessMembership {
  id: string;
  business_id: string;
  user_id: string | null;
  email: string | null;
  role: UserRole;
  status: MembershipStatus;
  invited_by: string | null;
  invited_at: string | null;
  joined_at: string;
  created_at: string;
  updated_at: string;
}

export interface BusinessSettings {
  id: string;
  business_id: string;
  invoice_due_days: number;
  invoice_footer_note: string | null;
  invoice_tax_label: string;
  invoice_tax_rate: number;
  show_tax_on_invoice: boolean;
  show_discount_on_invoice: boolean;
  payout_bank_name: string | null;
  payout_account_name: string | null;
  payout_account_number: string | null;
  payout_iban: string | null;
  payout_swift: string | null;
  payout_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  business_id: string;
  type: ContactType;
  name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  notes: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Account {
  id: string;
  business_id: string;
  name: string;
  account_type: AccountType;
  currency: CurrencyCode;
  display_detail: string | null;
  bank_name: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Computed (not in DB)
  balance?: number;
}

export interface Invoice {
  id: string;
  business_id: string;
  invoice_number: string;
  contact_id: string | null;
  status: InvoiceStatus;
  currency: CurrencyCode;
  issue_date: string;
  due_date: string | null;
  payment_terms: string | null;
  subtotal: number;
  discount_amount: number;
  discount_percent: number;
  tax_amount: number;
  tax_rate: number;
  total: number;
  amount_paid: number;
  amount_due: number;
  notes: string | null;
  internal_notes: string | null;
  custom_customer_name: string | null;
  custom_customer_type: string | null;
  snapshot_json: Record<string, unknown> | null;
  snapshot_taken_at: string | null;
  verification_token: string;
  payment_account_ids: string[];
  created_by: string | null;
  issued_by: string | null;
  issued_at: string | null;
  created_at: string;
  updated_at: string;
  accepted_at: string | null;
  payment_claimed_at: string | null;
  payment_confirmed_at: string | null;
  // Joined
  contact?: Contact;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  business_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  sort_order: number;
  created_at: string;
}

export interface Payment {
  id: string;
  business_id: string;
  invoice_id: string;
  account_id: string;
  amount: number;
  currency: CurrencyCode;
  payment_date: string;
  reference: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  invoice?: Invoice;
  account?: Account;
}

export interface Expense {
  id: string;
  business_id: string;
  account_id: string;
  contact_id: string | null;
  category: string;
  description: string;
  amount: number;
  currency: CurrencyCode;
  expense_date: string;
  note: string | null;
  receipt_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  account?: Account;
  contact?: Contact;
}

export interface MoneyTransaction {
  id: string;
  business_id: string;
  account_id: string;
  type: TransactionType;
  amount: number;
  currency: CurrencyCode;
  reference_id: string | null;
  reference_table: string | null;
  description: string | null;
  transaction_date: string;
  fx_rate_used: number | null;
  created_by: string | null;
  created_at: string;
}

export interface FxRateSnapshot {
  id: string;
  from_currency: string;
  to_currency: string;
  rate: number;
  source: string;
  fetched_at: string;
}

// ============================================================
// App-level types (not raw DB rows)
// ============================================================

export interface BusinessContext {
  business: Business;
  membership: BusinessMembership;
  role: UserRole;
  settings: BusinessSettings | null;
  accounts: Account[];
}

export interface DashboardStats {
  totalBalanceIqd: number;
  totalBalanceUsd: number;
  unpaidInvoicesCount: number;
  overdueInvoicesCount: number;
  invoicesThisMonth: number;
  paymentsThisMonth: number;
  paymentsAmountThisMonthIqd: number;
  paymentsAmountThisMonthUsd: number;
  expensesThisMonth: number;
  expensesAmountThisMonthIqd: number;
  expensesAmountThisMonthUsd: number;
  fxRate: number;
  fxRateUpdatedAt: string | null;
}

export interface InvoiceFormData {
  customer_mode: 'existing' | 'custom';
  contact_id: string | null;
  custom_customer_name: string | null;
  custom_customer_type: string | null;
  save_to_contacts: boolean;
  currency: CurrencyCode;
  issue_date: string;
  due_date: string | null;
  payment_terms: string | null;
  items: InvoiceItemFormData[];
  discount_percent: number;
  tax_rate: number;
  notes: string | null;
  internal_notes: string | null;
  payment_account_ids?: string[];
}

export interface InvoiceItemFormData {
  description: string;
  quantity: number;
  unit_price: number;
}

export interface PublicInvoiceVerification {
  verification_token: string;
  invoice_number: string;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string | null;
  total: number;
  currency: CurrencyCode;
  amount_paid: number;
  business_name: string;
  business_logo_url: string | null;
  customer_name: string | null;
}

export interface ActionResult<T = void> {
  data?: T;
  error?: string;
}
