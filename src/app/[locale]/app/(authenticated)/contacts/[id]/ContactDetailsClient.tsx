'use client';

import { useTranslations, useLocale } from 'next-intl';
import { ArrowLeft, User, Mail, Phone, MapPin, FileText, Trash2, ShieldCheck, Clock } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { formatCurrency, formatDate, cn, INVOICE_STATUS_COLORS } from '@/lib/utils';
import { deleteContact } from '@/lib/actions/contacts';
import { useState } from 'react';

export default function ContactDetailsClient({ contact, invoices, businessId }: any) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm(t('common.confirmDelete'))) return;
    setDeleting(true);
    const res = await deleteContact(businessId, contact.id);
    if (res?.error) alert(res.error);
    else router.push(`/${locale}/app/contacts`);
    setDeleting(false);
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <Link href={`/${locale}/app/contacts`} className="p-2 rounded-xl hover:bg-white/5 transition-colors text-white/60 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold text-white tracking-tight">{contact.name}</h1>
        </div>
        <button 
          onClick={handleDelete}
          disabled={deleting}
          className="btn-secondary text-red-400 hover:text-red-300 hover:bg-red-500/10 border-red-500/20"
        >
          <Trash2 className="w-4 h-4" />
          <span>{deleting ? t('common.loading') : t('common.delete')}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6">
          <div className="glass-card p-6 space-y-6">
            <div className="flex items-center gap-4 pb-4 border-b border-white/5">
              <div className="w-12 h-12 rounded-full bg-zenqar-500/20 flex items-center justify-center text-xl font-bold text-zenqar-400">
                {contact.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="font-semibold text-white">{contact.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-white/10 text-white/60">
                    {t(`contacts.${contact.type}`)}
                  </span>
                  {contact.connection_status === 'connected' && (
                    <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-zenqar-500/20 text-zenqar-400 border border-zenqar-500/20">
                      <ShieldCheck className="w-3 h-3" /> Connected
                    </span>
                  )}
                  {contact.connection_status === 'pending' && (
                    <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                      <Clock className="w-3 h-3" /> Pending
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {contact.email && (
                <div className="flex items-start gap-3">
                  <Mail className="w-4 h-4 text-white/30 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-[10px] text-white/40 uppercase tracking-tighter">{t('common.email')}</p>
                    <p className="text-sm text-white/80">{contact.email}</p>
                  </div>
                </div>
              )}
              {contact.phone && (
                <div className="flex items-start gap-3">
                  <Phone className="w-4 h-4 text-white/30 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-[10px] text-white/40 uppercase tracking-tighter">{t('common.phone')}</p>
                    <p className="text-sm text-white/80">{contact.phone}</p>
                  </div>
                </div>
              )}
              {(contact.address || contact.city) && (
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-white/30 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-[10px] text-white/40 uppercase tracking-tighter">{t('common.address')}</p>
                    <p className="text-sm text-white/80">
                      {contact.address && <span>{contact.address}, </span>}
                      {contact.city && <span>{contact.city}</span>}
                      {contact.country && <span>, {contact.country}</span>}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {contact.notes && (
            <div className="glass-card p-6">
              <h4 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">{t('common.notes')}</h4>
              <p className="text-sm text-white/70 whitespace-pre-wrap">{contact.notes}</p>
            </div>
          )}
        </div>

        <div className="lg:col-span-2 glass-card flex flex-col h-full">
          <div className="p-5 border-b border-white/5 flex items-center justify-between">
            <h3 className="font-semibold text-white">{t('contacts.invoiceHistory')}</h3>
          </div>
          <div className="p-0 overflow-x-auto flex-1">
            {invoices.length > 0 ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('invoices.invoiceNumber')}</th>
                    <th>{t('common.status')}</th>
                    <th className="text-right">{t('common.amount')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {invoices.map((inv: any) => (
                    <tr key={inv.id}>
                      <td>
                        <Link href={`/${locale}/app/invoices/${inv.id}`} className="text-sm text-white font-medium hover:text-zenqar-400 transition-colors">
                          {inv.invoice_number}
                        </Link>
                        <div className="text-[10px] text-white/30">{formatDate(inv.issue_date)}</div>
                      </td>
                      <td>
                        <span className={cn('badge', INVOICE_STATUS_COLORS[inv.status as keyof typeof INVOICE_STATUS_COLORS])}>
                          {t(`invoices.statuses.${inv.status}`)}
                        </span>
                      </td>
                      <td className="text-right tabular-nums font-semibold text-white">
                        {formatCurrency(inv.total, inv.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-center p-8">
                <FileText className="w-12 h-12 text-white/10 mb-4" />
                <p className="text-sm text-white/40">{t('contacts.noInvoices')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
