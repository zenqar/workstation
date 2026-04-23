'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useBusiness } from '@/lib/contexts/BusinessContext';
import { getPayments } from '@/lib/actions/payments';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Plus, CreditCard, Search } from 'lucide-react';
import Link from 'next/link';

export default function PaymentsClient({ defaultBusinessId, initialPayments }: any) {
  const t = useTranslations();
  const { activeBusiness, activeRole } = useBusiness();
  const [payments, setPayments] = useState(initialPayments);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (activeBusiness && activeBusiness.id !== defaultBusinessId) {
      let isMounted = true;
      setLoading(true);
      getPayments(activeBusiness.id).then((newPayments) => {
        if (isMounted) {
          setPayments(newPayments);
          setLoading(false);
        }
      });
      return () => { isMounted = false; };
    }
  }, [activeBusiness, defaultBusinessId]);

  const filteredPayments = payments.filter((p: any) => 
    (p.reference && p.reference.toLowerCase().includes(search.toLowerCase())) ||
    (p.invoice?.invoice_number && p.invoice.invoice_number.toLowerCase().includes(search.toLowerCase())) ||
    (p.invoice?.contact?.name && p.invoice.contact.name.toLowerCase().includes(search.toLowerCase()))
  );

  if (!activeBusiness) return <div className="animate-pulse text-white/50">{t('common.loading')}</div>;

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white tracking-tight">{t('payments.title')}</h1>
        {activeRole && ['owner', 'admin', 'accountant', 'staff'].includes(activeRole) && (
          <Link href="/app/invoices" className="btn-primary">
            <Plus className="w-4 h-4" />
            <span>{t('payments.newPayment')}</span>
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
            {filteredPayments.length > 0 ? (
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th>{t('common.date')}</th>
                    <th>{t('payments.invoice')}</th>
                    <th>{t('invoices.customer')}</th>
                    <th>{t('payments.receivedInto')}</th>
                    <th>{t('payments.reference')}</th>
                    <th className="text-right">{t('common.amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.map((p: any) => (
                    <tr key={p.id}>
                      <td className="text-white/70">{formatDate(p.payment_date)}</td>
                      <td>
                        <Link href={`/app/invoices/${p.invoice_id}`} className="font-medium text-white hover:text-zenqar-400 transition-colors">
                          {p.invoice?.invoice_number || '—'}
                        </Link>
                      </td>
                      <td className="text-white/80">{p.invoice?.contact?.name || '—'}</td>
                      <td className="text-white/70">{p.account?.name || '—'}</td>
                      <td className="text-white/50 text-sm">{p.reference || '—'}</td>
                      <td className="text-right">
                        <span className="font-medium tabular-nums text-emerald-400">
                          +{formatCurrency(p.amount, p.currency)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-12 flex flex-col items-center justify-center text-center">
                <CreditCard className="w-12 h-12 text-white/20 mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">{t('common.noData')}</h3>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
