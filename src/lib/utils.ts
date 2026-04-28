import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { CurrencyCode, InvoiceStatus, UserRole } from './types';

// ============================================================
// Tailwind class merging
// ============================================================

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ============================================================
// Currency formatting
// ============================================================

export function formatCurrency(
  amount: number,
  currency: CurrencyCode,
  locale = 'en-US'
): string {
  if (currency === 'IQD') {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'IQD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatNumber(amount: number, decimals = 2): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

// ============================================================
// Date formatting
// ============================================================

export function formatDate(
  dateStr: string | null | undefined,
  locale = 'en-US'
): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-CA'); // YYYY-MM-DD
}

export function isOverdue(dueDateStr: string | null | undefined): boolean {
  if (!dueDateStr) return false;
  return new Date(dueDateStr) < new Date();
}

// ============================================================
// Invoice status helpers
// ============================================================

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft:          'Draft',
  issued:         'Issued',
  sent:           'Sent',
  partially_paid: 'Partially Paid',
  paid:           'Paid',
  accepted:       'Accepted',
  payment_claimed: 'Payment Claimed',
  overdue:        'Overdue',
  cancelled:      'Cancelled',
};

export const INVOICE_STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft:          'text-slate-400 bg-slate-400/10 border-slate-400/20',
  issued:         'text-blue-400 bg-blue-400/10 border-blue-400/20',
  sent:           'text-violet-400 bg-violet-400/10 border-violet-400/20',
  partially_paid: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  paid:           'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  accepted:       'text-teal-400 bg-teal-400/10 border-teal-400/20',
  payment_claimed: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
  overdue:        'text-red-400 bg-red-400/10 border-red-400/20',
  cancelled:      'text-gray-500 bg-gray-500/10 border-gray-500/20',
};

// ============================================================
// Role helpers
// ============================================================

export const ROLE_LABELS: Record<UserRole, string> = {
  owner:      'Owner',
  admin:      'Admin',
  accountant: 'Accountant',
  staff:      'Staff',
  viewer:     'Viewer',
};

export function canWrite(role: UserRole): boolean {
  return ['owner', 'admin', 'accountant', 'staff'].includes(role);
}

export function canManage(role: UserRole): boolean {
  return ['owner', 'admin', 'accountant'].includes(role);
}

export function canAdmin(role: UserRole): boolean {
  return ['owner', 'admin'].includes(role);
}

// ============================================================
// URL helpers
// ============================================================

export function getVerificationUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${base}/verify/${token}`;
}

// ============================================================
// Misc
// ============================================================

export function generateInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

export function truncate(str: string, length = 50): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '…';
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
