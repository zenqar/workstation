import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { BarChart3, CircleDollarSign, Download, Receipt, Scale } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getLocalizedPath } from '@/lib/utils/locale';
import { formatCurrency } from '@/lib/utils';

type Currency = 'IQD' | 'USD';
type Totals = Record<Currency, number>;

const zeroTotals = (): Totals => ({ IQD: 0, USD: 0 });

export default async function ReportsPage() {
  const locale = await getLocale();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(getLocalizedPath(locale, '/login'));

  const { data: membership } = await supabase.from('business_memberships').select('business_id').eq('user_id', user.id).eq('status', 'active').limit(1).maybeSingle();
  if (!membership) redirect(getLocalizedPath(locale, '/app/onboarding'));

  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const startIso = start.toISOString();

  const [{ data: payments }, { data: expenses }, { data: invoices }] = await Promise.all([
    supabase.from('payments').select('amount,currency,payment_date').eq('business_id', membership.business_id).gte('payment_date', startIso.slice(0, 10)),
    supabase.from('expenses').select('amount,currency,category,expense_date').eq('business_id', membership.business_id).gte('expense_date', startIso.slice(0, 10)),
    supabase.from('invoices').select('total,amount_paid,currency,status').eq('business_id', membership.business_id),
  ]);

  const income = zeroTotals();
  const spending = zeroTotals();
  const receivables = zeroTotals();
  const categoryTotals = new Map<string, Totals>();
  for (const payment of payments || []) income[payment.currency as Currency] += Number(payment.amount) || 0;
  for (const expense of expenses || []) {
    const currency = expense.currency as Currency;
    const amount = Number(expense.amount) || 0;
    spending[currency] += amount;
    const current = categoryTotals.get(expense.category) || zeroTotals();
    current[currency] += amount;
    categoryTotals.set(expense.category, current);
  }
  for (const invoice of invoices || []) {
    if (!['paid', 'cancelled', 'draft'].includes(invoice.status)) receivables[invoice.currency as Currency] += Math.max(0, Number(invoice.total) - Number(invoice.amount_paid));
  }
  const net: Totals = { IQD: income.IQD - spending.IQD, USD: income.USD - spending.USD };
  const categories = [...categoryTotals.entries()].sort((a, b) => (b[1].IQD + b[1].USD) - (a[1].IQD + a[1].USD));

  const cards = [
    { label: 'Income this month', values: income, icon: CircleDollarSign, color: 'text-emerald-400' },
    { label: 'Expenses this month', values: spending, icon: Receipt, color: 'text-red-400' },
    { label: 'Net cash movement', values: net, icon: Scale, color: 'text-zenqar-400' },
    { label: 'Outstanding receivables', values: receivables, icon: BarChart3, color: 'text-amber-400' },
  ];

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-2xl font-bold text-white">Financial reports</h1><p className="mt-1 text-sm text-white/45">A current-month cash summary and open invoice position, separated by currency.</p></div><a href={`/api/exports/transactions?businessId=${membership.business_id}`} className="btn-secondary"><Download className="h-4 w-4" /> Download bookkeeping CSV</a></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(card => <div key={card.label} className="glass-card p-5"><div className="flex items-center justify-between"><p className="text-xs uppercase tracking-wide text-white/40">{card.label}</p><card.icon className={`h-5 w-5 ${card.color}`} /></div><p className="mt-4 text-xl font-bold text-white">{formatCurrency(card.values.IQD, 'IQD')}</p><p className="mt-1 text-sm text-white/55">{formatCurrency(card.values.USD, 'USD')}</p></div>)}
      </div>
      <div className="glass-card overflow-hidden">
        <div className="border-b border-white/5 p-5"><h2 className="font-semibold text-white">Expenses by category this month</h2></div>
        {categories.length === 0 ? <p className="p-8 text-center text-sm text-white/35">No expenses recorded this month.</p> : <div className="divide-y divide-white/5">{categories.map(([category, values]) => <div key={category} className="grid grid-cols-3 gap-3 p-4 text-sm"><span className="font-medium text-white/80">{category}</span><span className="text-right text-white/60">{formatCurrency(values.IQD, 'IQD')}</span><span className="text-right text-white/60">{formatCurrency(values.USD, 'USD')}</span></div>)}</div>}
      </div>
      <p className="text-xs text-white/30">Cash-basis summary. Income reflects recorded payments; expenses reflect recorded expense transactions. Review with a qualified accountant for statutory reporting.</p>
    </div>
  );
}
