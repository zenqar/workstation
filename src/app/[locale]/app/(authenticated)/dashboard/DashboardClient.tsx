'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useBusiness } from '@/lib/contexts/BusinessContext';
import { getDashboardStats } from '@/lib/actions/businesses';
import { getInvoices } from '@/lib/actions/invoices';
import { getExpenses } from '@/lib/actions/expenses';
import { formatCurrency, formatDate, INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS, cn } from '@/lib/utils';
import { Wallet, TrendingDown, TrendingUp, AlertCircle, ArrowRight, Plus } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import WelcomeTour from '@/components/WelcomeTour';
import ContactRequests from './ContactRequests';

export default function DashboardClient({
  defaultBusinessId,
  initialStats,
  initialInvoices,
  initialExpenses,
  incomingRequests = []
}: any) {
  const t = useTranslations();
  const { activeBusiness } = useBusiness();
  const [stats, setStats] = useState(initialStats);
  const [invoices, setInvoices] = useState(initialInvoices);
  const [expenses, setExpenses] = useState(initialExpenses);
  const [loading, setLoading] = useState(false);
  const locale = useLocale();

  useEffect(() => {
    // If the active business is different from the default one used on the server,
    // fetch the new data for the active business.
    if (activeBusiness && activeBusiness.id !== defaultBusinessId) {
      let isMounted = true;
      setLoading(true);
      
      Promise.all([
        getDashboardStats(activeBusiness.id),
        getInvoices(activeBusiness.id),
        getExpenses(activeBusiness.id)
      ]).then(([newStats, newInvoices, newExpenses]) => {
        if (isMounted) {
          setStats(newStats);
          setInvoices(newInvoices.slice(0, 5));
          setExpenses(newExpenses.slice(0, 5));
          setLoading(false);
        }
      });

      return () => { isMounted = false; };
    }
  }, [activeBusiness, defaultBusinessId]);

  if (!activeBusiness) return <div className="animate-pulse text-white/50">{t('common.loading')}</div>;

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">{t('dashboard.title')}</h1>
          <p className="text-sm text-white/50 mt-1">
            {activeBusiness.name}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/${locale}/app/invoices/new`} className="btn-primary">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">{t('dashboard.newInvoice')}</span>
          </Link>
          <Link href={`/${locale}/app/contacts/new`} className="btn-secondary">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">{t('dashboard.addContact')}</span>
          </Link>
          <Link href={`/${locale}/app/accounts/transfer`} className="btn-secondary">
            <TrendingUp className="w-4 h-4" />
            <span className="hidden sm:inline">{t('dashboard.transferFunds')}</span>
          </Link>
          <Link href={`/${locale}/app/expenses/new`} className="btn-secondary">
            <TrendingDown className="w-4 h-4" />
            <span className="hidden sm:inline">{t('dashboard.addExpense')}</span>
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center text-white/40">{t('common.loading')}</div>
      ) : (
        <>
          <ContactRequests requests={incomingRequests} />

          {/* Main Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 stagger-children">
            <div className="stats-card group">
              <div className="mouse-light"></div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-white/50">{t('dashboard.totalBalanceIqd')}</h3>
                <div className="w-10 h-10 rounded-xl bg-zenqar-500/10 border border-zenqar-500/20 flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-zenqar-400" />
                </div>
              </div>
              <div className="text-3xl font-bold text-white tabular-nums tracking-tight">
                {formatCurrency(stats.totalBalanceIqd, 'IQD')}
              </div>
            </div>

            <div className="stats-card group">
              <div className="mouse-light"></div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-white/50">{t('dashboard.totalBalanceUsd')}</h3>
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-emerald-400" />
                </div>
              </div>
              <div className="text-3xl font-bold text-white tabular-nums tracking-tight">
                {formatCurrency(stats.totalBalanceUsd, 'USD')}
              </div>
            </div>

            <div className="stats-card group">
              <div className="mouse-light"></div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-white/50">{t('dashboard.estimatedTotal')}</h3>
                <span className="text-[10px] uppercase tracking-wider text-white/30 px-2 py-1 rounded bg-white/5 border border-white/10">
                  {t('dashboard.currentRate')}: {stats.fxRate}
                </span>
              </div>
              <div className="text-3xl font-bold text-white tabular-nums tracking-tight">
                {formatCurrency(stats.estimatedTotalIqd, 'IQD')}
              </div>
            </div>
          </div>

          {/* Secondary Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
            <div className="glass-card p-4 relative overflow-hidden group">
              <div className="mouse-light"></div>
              <p className="text-xs text-white/50 mb-1">{t('dashboard.unpaidInvoices')}</p>
              <p className="text-xl font-semibold text-white">{stats.unpaidInvoicesCount}</p>
            </div>
            <div className="glass-card p-4 relative overflow-hidden group">
              <div className="mouse-light"></div>
              <p className="text-xs text-red-400/80 mb-1">{t('dashboard.overdueInvoices')}</p>
              <p className="text-xl font-semibold text-red-400">{stats.overdueInvoicesCount}</p>
            </div>
            <div className="glass-card p-4 relative overflow-hidden group">
              <div className="mouse-light"></div>
              <p className="text-xs text-white/50 mb-1">{t('dashboard.paymentsThisMonth')}</p>
              <p className="text-xl font-semibold text-white">{stats.paymentsThisMonth}</p>
            </div>
            <div className="glass-card p-4 relative overflow-hidden group">
              <div className="mouse-light"></div>
              <p className="text-xs text-white/50 mb-1">{t('dashboard.expensesThisMonth')}</p>
              <p className="text-xl font-semibold text-white">{stats.expensesThisMonth}</p>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Recent Invoices */}
            <div className="glass-card flex flex-col relative overflow-hidden group">
              <div className="mouse-light"></div>
              <div className="p-5 border-b border-white/5 flex items-center justify-between">
                <h3 className="font-semibold text-white">{t('dashboard.recentInvoices')}</h3>
                <Link href={`/${locale}/app/invoices`} className="text-xs text-zenqar-400 hover:text-zenqar-300 flex items-center gap-1">
                  {t('dashboard.viewAll')} <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="p-0 overflow-x-auto">
                {invoices.length > 0 ? (
                  <table className="data-table">
                    <tbody>
                      {invoices.map((inv: any) => (
                        <tr key={inv.id}>
                          <td className="w-1/3">
                            <Link href={`/${locale}/app/invoices/${inv.id}`} className="font-medium text-white hover:text-zenqar-400 transition-colors">
                              {inv.invoice_number}
                            </Link>
                            <div className="text-xs text-white/40 mt-1">{inv.contact?.name || '—'}</div>
                          </td>
                          <td>
                            {(() => {
                              const isOverdue = ['issued', 'sent', 'partially_paid'].includes(inv.status) && inv.due_date && new Date(inv.due_date) < new Date(new Date().setHours(0,0,0,0));
                              const displayStatus = isOverdue ? 'overdue' : inv.status;
                              return (
                                <span className={cn('badge', INVOICE_STATUS_COLORS[displayStatus as keyof typeof INVOICE_STATUS_COLORS])}>
                                  {t(`invoices.statuses.${displayStatus}`)}
                                </span>
                              );
                            })()}
                          </td>
                          <td className="text-right">
                            <span className="font-medium tabular-nums">{formatCurrency(inv.total, inv.currency)}</span>
                            <div className="text-xs text-white/40 mt-1">{formatDate(inv.issue_date)}</div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-8 text-center text-white/40 text-sm">
                    {t('dashboard.noRecentInvoices')}
                  </div>
                )}
              </div>
            </div>

            {/* Recent Expenses */}
            <div className="glass-card flex flex-col relative overflow-hidden group">
              <div className="mouse-light"></div>
              <div className="p-5 border-b border-white/5 flex items-center justify-between">
                <h3 className="font-semibold text-white">{t('dashboard.recentExpenses')}</h3>
                <Link href={`/${locale}/app/expenses`} className="text-xs text-zenqar-400 hover:text-zenqar-300 flex items-center gap-1">
                  {t('dashboard.viewAll')} <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="p-0 overflow-x-auto">
                {expenses.length > 0 ? (
                  <table className="data-table">
                    <tbody>
                      {expenses.map((exp: any) => (
                        <tr key={exp.id}>
                          <td className="w-1/2">
                            <div className="font-medium text-white">{exp.description}</div>
                            <div className="text-xs text-white/40 mt-1">{t(`expenses.categories.${exp.category}`)}</div>
                          </td>
                          <td className="text-right">
                            <span className="font-medium tabular-nums text-red-400">-{formatCurrency(exp.amount, exp.currency)}</span>
                            <div className="text-xs text-white/40 mt-1">{formatDate(exp.expense_date)}</div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-8 text-center text-white/40 text-sm">
                    {t('dashboard.noRecentExpenses')}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Welcome tour — shows on first visit, dismissible */}
      <WelcomeTour />
    </div>
  );
}
