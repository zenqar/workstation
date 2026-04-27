'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { issueInvoice, cancelInvoice, recordPayment } from '@/lib/actions/invoices';
import { ArrowLeft, CheckCircle, XCircle, DollarSign, Download, Printer, Share2 } from 'lucide-react';
import Link from 'next/link';
import { formatCurrency, formatDate, INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS, cn } from '@/lib/utils';

export default function InvoiceDetailsClient({ invoice, accounts, businessId }: any) {
  const t = useTranslations();
  const router = useRouter();
  const locale = useLocale();
  const [loading, setLoading] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    account_id: '',
    amount: invoice.total - (invoice.amount_paid || 0),
    payment_date: new Date().toISOString().split('T')[0],
    reference: '',
    note: ''
  });

  const handleIssue = async () => {
    if (!confirm(t('invoices.issueInvoiceConfirm'))) return;
    setLoading(true);
    const res = await issueInvoice(businessId, invoice.id);
    if (res?.error) alert(res.error);
    setLoading(false);
    router.refresh();
  };

  const handleCancel = async () => {
    if (!confirm(t('invoices.cancelConfirm'))) return;
    setLoading(true);
    const res = await cancelInvoice(businessId, invoice.id);
    if (res?.error) alert(res.error);
    setLoading(false);
    router.refresh();
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await recordPayment(businessId, invoice.id, {
      ...paymentForm,
      currency: invoice.currency
    });
    if (res?.error) {
      alert(res.error);
      setLoading(false);
    } else {
      setShowPaymentModal(false);
      setLoading(false);
      router.refresh();
    }
  const handlePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/${locale}/verify/${invoice.verification_token}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Invoice ${invoice.invoice_number}`,
          text: `View invoice ${invoice.invoice_number} from ${invoice.business?.name || 'Zenqar'}`,
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        alert('Link copied to clipboard!');
      }
    } catch (err) {
      console.error('Error sharing:', err);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href={`/${locale}/app/invoices`} className="p-2 rounded-xl hover:bg-white/5 transition-colors text-white/60 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">{invoice.invoice_number}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={cn('badge', INVOICE_STATUS_COLORS[invoice.status as keyof typeof INVOICE_STATUS_COLORS])}>
                {t(`invoices.statuses.${invoice.status}`)}
              </span>
              <span className="text-white/30 text-xs">• {formatDate(invoice.issue_date)}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {invoice.status === 'draft' && (
            <button onClick={handleIssue} disabled={loading} className="btn-primary">
              <CheckCircle className="w-4 h-4" />
              <span>{t('invoices.issueInvoice')}</span>
            </button>
          )}
          {['issued', 'sent', 'partially_paid'].includes(invoice.status) && (
            <button onClick={() => setShowPaymentModal(true)} className="btn-primary">
              <DollarSign className="w-4 h-4" />
              <span>{t('invoices.recordPayment')}</span>
            </button>
          )}
          {invoice.status !== 'draft' && invoice.status !== 'cancelled' && (
            <button onClick={handleCancel} disabled={loading} className="btn-secondary text-red-400 hover:bg-red-500/10 border-red-500/20">
              <XCircle className="w-4 h-4" />
              <span>{t('invoices.cancelInvoice')}</span>
            </button>
          )}
          <button onClick={handlePrint} className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all" title={t('common.print')}>
            <Printer className="w-4 h-4" />
          </button>
          <button onClick={handleShare} className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all" title={t('common.share')}>
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card overflow-hidden">
            <div className="p-6 border-b border-white/5 flex justify-between items-start">
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-white/40 uppercase tracking-wider mb-1">{t('invoices.customer')}</p>
                  <h3 className="text-lg font-semibold text-white">
                    {invoice.contact?.name || invoice.custom_customer_name || '—'}
                  </h3>
                  {(invoice.contact?.company_name || invoice.custom_customer_type === 'business') && (
                    <p className="text-sm text-white/50">{invoice.contact?.company_name || invoice.custom_customer_name}</p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-white/40 uppercase tracking-wider mb-1">{t('common.total')}</p>
                <p className="text-2xl font-bold text-white tabular-nums">
                  {formatCurrency(invoice.total, invoice.currency)}
                </p>
                {invoice.amount_paid > 0 && (
                  <p className="text-xs text-emerald-400 mt-1">
                    {t('invoices.amountPaid')}: {formatCurrency(invoice.amount_paid, invoice.currency)}
                  </p>
                )}
              </div>
            </div>

            <div className="p-0 overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('common.description')}</th>
                    <th className="text-right">{t('common.quantity')}</th>
                    <th className="text-right">{t('common.unitPrice')}</th>
                    <th className="text-right">{t('common.amount')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {invoice.invoice_items?.map((item: any) => (
                    <tr key={item.id}>
                      <td className="text-white">{item.description}</td>
                      <td className="text-right tabular-nums">{item.quantity}</td>
                      <td className="text-right tabular-nums">{formatCurrency(item.unit_price, invoice.currency)}</td>
                      <td className="text-right tabular-nums font-medium text-white">
                        {formatCurrency(item.quantity * item.unit_price, invoice.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-6 border-t border-white/5">
              <div className="flex flex-col items-end space-y-2">
                <div className="flex justify-between w-full max-w-xs text-sm">
                  <span className="text-white/50">{t('common.subtotal')}</span>
                  <span className="text-white tabular-nums">{formatCurrency(invoice.subtotal, invoice.currency)}</span>
                </div>
                {invoice.discount_amount > 0 && (
                  <div className="flex justify-between w-full max-w-xs text-sm">
                    <span className="text-white/50">{t('common.discount')} ({invoice.discount_percent}%)</span>
                    <span className="text-red-400 tabular-nums">-{formatCurrency(invoice.discount_amount, invoice.currency)}</span>
                  </div>
                )}
                {invoice.tax_amount > 0 && (
                  <div className="flex justify-between w-full max-w-xs text-sm">
                    <span className="text-white/50">{t('common.tax')} ({invoice.tax_rate}%)</span>
                    <span className="text-white/80 tabular-nums">+{formatCurrency(invoice.tax_amount, invoice.currency)}</span>
                  </div>
                )}
                <div className="flex justify-between w-full max-w-xs pt-4 border-t border-white/5">
                  <span className="text-lg font-bold text-white">{t('common.total')}</span>
                  <span className="text-xl font-bold text-white tabular-nums">{formatCurrency(invoice.total, invoice.currency)}</span>
                </div>
              </div>
            </div>
          </div>

          {invoice.notes && (
            <div className="glass-card p-6">
              <h4 className="text-sm font-semibold text-white/60 mb-2 uppercase tracking-wider">{t('common.notes')}</h4>
              <p className="text-white/80 text-sm whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="glass-card p-6 space-y-4">
            <h4 className="text-sm font-semibold text-white mb-2 uppercase tracking-wider">Dates & Terms</h4>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-white/40 mb-1">{t('invoices.invoiceDate')}</p>
                <p className="text-sm text-white">{formatDate(invoice.issue_date)}</p>
              </div>
              <div>
                <p className="text-xs text-white/40 mb-1">{t('invoices.dueDate')}</p>
                <p className="text-sm text-white">{invoice.due_date ? formatDate(invoice.due_date) : 'No due date'}</p>
              </div>
              {invoice.payment_terms && (
                <div>
                  <p className="text-xs text-white/40 mb-1">{t('invoices.paymentTerms')}</p>
                  <p className="text-sm text-white">{invoice.payment_terms}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-white mb-6">{t('invoices.recordPayment')}</h3>
            <form onSubmit={handlePayment} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm text-white/60">{t('payments.receivedInto')}</label>
                <select 
                  className="input-glass"
                  value={paymentForm.account_id}
                  onChange={e => setPaymentForm({...paymentForm, account_id: e.target.value})}
                  required
                >
                  <option value="">{t('common.selectOption')}</option>
                  {accounts.filter((a: any) => a.currency === invoice.currency).map((acc: any) => (
                    <option key={acc.id} value={acc.id}>{acc.name} ({formatCurrency(acc.balance, acc.currency)})</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm text-white/60">{t('common.amount')}</label>
                <div className="relative">
                  <input 
                    type="number" 
                    step="0.01"
                    className="input-glass"
                    value={paymentForm.amount}
                    onChange={e => setPaymentForm({...paymentForm, amount: parseFloat(e.target.value) || 0})}
                    required
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/40">{invoice.currency}</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm text-white/60">{t('payments.paymentDate')}</label>
                <input 
                  type="date" 
                  className="input-glass"
                  value={paymentForm.payment_date}
                  onChange={e => setPaymentForm({...paymentForm, payment_date: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm text-white/60">{t('payments.reference')}</label>
                <input 
                  type="text" 
                  className="input-glass"
                  value={paymentForm.reference}
                  onChange={e => setPaymentForm({...paymentForm, reference: e.target.value})}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowPaymentModal(false)} className="btn-secondary flex-1">
                  {t('common.cancel')}
                </button>
                <button type="submit" disabled={loading} className="btn-primary flex-1">
                  {loading ? t('common.loading') : t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
