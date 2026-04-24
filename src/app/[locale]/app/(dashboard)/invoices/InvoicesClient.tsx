'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useBusiness } from '@/lib/contexts/BusinessContext';
import { getInvoices } from '@/lib/actions/invoices';
import { formatCurrency, formatDate, INVOICE_STATUS_COLORS, cn } from '@/lib/utils';
import { Plus, FileText, Search } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function InvoicesClient({ defaultBusinessId, initialInvoices }: any) {
  const t = useTranslations();
  const { activeBusiness, activeRole } = useBusiness();
  const [invoices, setInvoices] = useState(initialInvoices);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const params = useParams();
  const locale = params.locale as string;

  useEffect(() => {
    if (activeBusiness && activeBusiness.id !== defaultBusinessId) {
      let isMounted = true;
      setLoading(true);
      getInvoices(activeBusiness.id).then((newInvoices) => {
        if (isMounted) {
          setInvoices(newInvoices);
          setLoading(false);
        }
      });
      return () => { isMounted = false; };
    }
  }, [activeBusiness, defaultBusinessId]);

  const filteredInvoices = invoices.filter((inv: any) => 
    inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
    (inv.contact?.name && inv.contact.name.toLowerCase().includes(search.toLowerCase()))
  );

  if (!activeBusiness) return <div className="animate-pulse text-white/50">{t('common.loading')}</div>;

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white tracking-tight">{t('invoices.title')}</h1>
        {activeRole && ['owner', 'admin', 'accountant', 'staff'].includes(activeRole) && (
          <Link href={`/${locale}/app/invoices/new`} className="btn-primary">
            <Plus className="w-4 h-4" />
            <span>{t('invoices.newInvoice')}</span>
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
            {filteredInvoices.length > 0 ? (
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th>{t('invoices.invoiceNumber')}</th>
                    <th>{t('invoices.customer')}</th>
                    <th>{t('common.status')}</th>
                    <th>{t('invoices.invoiceDate')}</th>
                    <th>{t('invoices.dueDate')}</th>
                    <th className="text-right">{t('common.amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((inv: any) => (
                    <tr key={inv.id}>
                      <td>
                        <Link href={`/${locale}/app/invoices/${inv.id}`} className="font-medium text-white hover:text-zenqar-400 transition-colors">
                          {inv.invoice_number}
                        </Link>
                      </td>
                      <td>
                        <div className="text-white/80">{inv.contact?.name || '—'}</div>
                      </td>
                      <td>
                        <span className={cn('badge', INVOICE_STATUS_COLORS[inv.status as keyof typeof INVOICE_STATUS_COLORS])}>
                          {t(`invoices.statuses.${inv.status}`)}
                        </span>
                      </td>
                      <td className="text-white/70">{formatDate(inv.issue_date)}</td>
                      <td className="text-white/70">{formatDate(inv.due_date)}</td>
                      <td className="text-right">
                        <span className="font-medium tabular-nums text-white">
                          {formatCurrency(inv.total, inv.currency)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-12 flex flex-col items-center justify-center text-center">
                <FileText className="w-12 h-12 text-white/20 mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">{t('common.noData')}</h3>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
