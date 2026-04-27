'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useBusiness } from '@/lib/contexts/BusinessContext';
import { getExpenses } from '@/lib/actions/expenses';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Plus, Receipt, Search } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function ExpensesClient({ defaultBusinessId, initialExpenses }: any) {
  const t = useTranslations();
  const { activeBusiness, activeRole } = useBusiness();
  const [expenses, setExpenses] = useState(initialExpenses);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const locale = useLocale();

  useEffect(() => {
    if (activeBusiness && activeBusiness.id !== defaultBusinessId) {
      let isMounted = true;
      setLoading(true);
      getExpenses(activeBusiness.id).then((newExpenses) => {
        if (isMounted) {
          setExpenses(newExpenses);
          setLoading(false);
        }
      });
      return () => { isMounted = false; };
    }
  }, [activeBusiness, defaultBusinessId]);

  const filteredExpenses = expenses.filter((e: any) => 
    e.description.toLowerCase().includes(search.toLowerCase()) ||
    (e.contact?.name && e.contact.name.toLowerCase().includes(search.toLowerCase()))
  );

  if (!activeBusiness) return <div className="animate-pulse text-white/50">{t('common.loading')}</div>;

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white tracking-tight">{t('expenses.title')}</h1>
        {activeRole && ['owner', 'admin', 'accountant', 'staff'].includes(activeRole) && (
          <Link href={`/${locale}/app/expenses/new`} className="btn-primary">
            <Plus className="w-4 h-4" />
            <span>{t('expenses.newExpense')}</span>
          </Link>
        )}
      </div>

      <div className="glass-card p-4 sm:p-6">
        <div className="mb-6 flex items-center bg-white/5 border border-white/10 rounded-xl px-3 py-2 w-full max-w-md focus-within:border-zenqar-500/50 focus-within:ring-1 focus-within:ring-zenqar-500/50 transition-all">
          <Search className="w-5 h-5 text-white/40 mr-2" />
          <input 
            type="text" 
            placeholder={t('common.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent border-none outline-none text-white text-sm w-full placeholder:text-white/30"
          />
        </div>

        {loading ? (
          <div className="h-32 flex items-center justify-center text-white/40">{t('common.loading')}</div>
        ) : (
          <div className="overflow-x-auto">
            {filteredExpenses.length > 0 ? (
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th>{t('common.date')}</th>
                    <th>{t('common.description')}</th>
                    <th>{t('expenses.category')}</th>
                    <th>{t('expenses.paidFrom')}</th>
                    <th className="text-right">{t('common.amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.map((exp: any) => (
                    <tr key={exp.id}>
                      <td className="text-white/70">{formatDate(exp.expense_date)}</td>
                      <td>
                        <div className="font-medium text-white">{exp.description}</div>
                        {exp.contact?.name && <div className="text-xs text-white/40 mt-1">{exp.contact.name}</div>}
                      </td>
                      <td>
                        <span className="text-xs px-2 py-1 bg-white/5 rounded-full text-white/70">
                          {t(`expenses.categories.${exp.category}`)}
                        </span>
                      </td>
                      <td className="text-white/70">{exp.account?.name || '—'}</td>
                      <td className="text-right">
                        <span className="font-medium tabular-nums text-red-400">
                          -{formatCurrency(exp.amount, exp.currency)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-12 flex flex-col items-center justify-center text-center">
                <Receipt className="w-12 h-12 text-white/20 mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">{t('common.noData')}</h3>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
