'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { issueInvoice, cancelInvoice, recordPayment, payIncomingInvoice } from '@/lib/actions/invoices';
import { ArrowLeft, CheckCircle, XCircle, DollarSign, Download, Printer, Share2, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { formatCurrency, formatDate, INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS, cn } from '@/lib/utils';

export default function InvoiceDetailsClient({ invoice, accounts, businessId }: any) {
  const t = useTranslations();
  const router = useRouter();
  const locale = useLocale();
  const [loading, setLoading] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    payments: [{ account_id: '', amount: invoice.total - (invoice.amount_paid || 0) }],
    payment_date: new Date().toISOString().split('T')[0],
    reference: '',
    note: ''
  });

  const isIncoming = invoice.business_id !== businessId;

  const addPaymentSource = () => {
    setPaymentForm({
      ...paymentForm,
      payments: [...paymentForm.payments, { account_id: '', amount: 0 }]
    });
  };

  const removePaymentSource = (index: number) => {
    const newPayments = [...paymentForm.payments];
    newPayments.splice(index, 1);
    setPaymentForm({ ...paymentForm, payments: newPayments });
  };

  const updatePaymentEntry = (index: number, field: string, value: any) => {
    const newPayments = [...paymentForm.payments];
    newPayments[index] = { ...newPayments[index], [field]: value };
    setPaymentForm({ ...paymentForm, payments: newPayments });
  };

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
    
    const payload = {
      ...paymentForm,
      currency: invoice.currency
    };

    const res = isIncoming 
      ? await payIncomingInvoice(businessId, invoice.id, payload)
      : await recordPayment(businessId, invoice.id, payload);

    if (res?.error) {
      alert(res.error);
      setLoading(false);
    } else {
      setShowPaymentModal(false);
      setLoading(false);
      router.refresh();
    }
  };

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
          {invoice.status === 'draft' && !isIncoming && (
            <button onClick={handleIssue} disabled={loading} className="btn-primary">
              <CheckCircle className="w-4 h-4" />
              <span>{t('invoices.issueInvoice')}</span>
            </button>
          )}
          {['issued', 'sent', 'accepted', 'payment_claimed', 'partially_paid'].includes(invoice.status) && (
            <button onClick={() => setShowPaymentModal(true)} className="btn-primary">
              <DollarSign className="w-4 h-4" />
              <span>{invoice.status === 'payment_claimed' ? 'Confirm & Record Payment' : (isIncoming ? 'Pay Invoice' : t('invoices.recordPayment'))}</span>
            </button>
          )}
          {invoice.status !== 'draft' && invoice.status !== 'cancelled' && !isIncoming && (
            <button onClick={handleCancel} disabled={loading} className="btn-secondary text-red-400 hover:bg-red-500/10 border-red-500/20">
              <XCircle className="w-4 h-4" />
              <span>{t('invoices.cancelInvoice')}</span>
            </button>
          )}
          <button onClick={handlePrint} className="btn-secondary whitespace-nowrap" title={t('common.print')}>
            <Download className="w-4 h-4" />
            <span>Download PDF / Print</span>
          </button>
          <button onClick={handleShare} className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all" title={t('common.share')}>
            <Share2 className="w-4 h-4" />
          </button>
        </div>
        
        {invoice.status === 'payment_claimed' && (
          <div className="mt-6 p-4 rounded-2xl bg-zenqar-500/10 border border-zenqar-500/20 flex items-center gap-4 animate-in slide-in-from-top-2 duration-300">
            <div className="w-10 h-10 rounded-full bg-zenqar-500/20 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-zenqar-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Payment Claimed by Customer</p>
              <p className="text-xs text-white/50">The customer has marked this invoice as paid. Please verify your accounts and confirm the receipt.</p>
            </div>
          </div>
        )}

        {invoice.status === 'accepted' && (
          <div className="mt-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-4 animate-in slide-in-from-top-2 duration-300">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <ThumbsUp className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Invoice Accepted</p>
              <p className="text-xs text-white/50">The customer has reviewed and accepted the terms of this invoice.</p>
            </div>
          </div>
        )}
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

          {(invoice.payment_account_ids?.length > 0) && (
            <div className="glass-card p-6 space-y-4">
              <h4 className="text-sm font-semibold text-white mb-2 uppercase tracking-wider">Payment Instructions</h4>
              <div className="space-y-3">
                {accounts.filter((a: any) => invoice.payment_account_ids.includes(a.id)).map((acc: any) => (
                  <div key={acc.id} className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1">
                    <p className="text-[10px] uppercase font-bold text-zenqar-400">{acc.name}</p>
                    {acc.bank_name && <p className="text-xs text-white font-medium">{acc.bank_name}</p>}
                    <p className="text-xs text-white/80 font-mono tracking-wider">{acc.display_detail || 'No details provided'}</p>
                    <p className="text-[10px] text-white/30 uppercase">{acc.account_type} • {acc.currency}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">{isIncoming ? 'Pay Invoice' : t('invoices.recordPayment')}</h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-white/40 hover:text-white">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePayment} className="space-y-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-semibold text-white/60 uppercase tracking-wider">Payment Sources</label>
                  <button 
                    type="button" 
                    onClick={addPaymentSource}
                    className="flex items-center gap-1.5 text-xs font-bold text-zenqar-400 hover:text-zenqar-300 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Split Payment
                  </button>
                </div>

                {paymentForm.payments.map((entry, idx) => (
                  <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end p-3 rounded-xl bg-white/5 border border-white/5">
                    <div className="sm:col-span-7 space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-white/40">{isIncoming ? 'Pay From Account' : 'Received Into'}</label>
                      <select 
                        className="input-glass text-sm"
                        value={entry.account_id}
                        onChange={e => updatePaymentEntry(idx, 'account_id', e.target.value)}
                        required
                      >
                        <option value="">Select Account</option>
                        {accounts.filter((a: any) => a.currency === invoice.currency).map((acc: any) => (
                          <option key={acc.id} value={acc.id}>{acc.name} ({formatCurrency(acc.balance, acc.currency)})</option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-4 space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-white/40">{t('common.amount')}</label>
                      <div className="relative">
                        <input 
                          type="number" 
                          step="0.01"
                          className="input-glass text-sm pr-12"
                          value={entry.amount}
                          onChange={e => updatePaymentEntry(idx, 'amount', parseFloat(e.target.value) || 0)}
                          required
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-white/20">{invoice.currency}</span>
                      </div>
                    </div>
                    <div className="sm:col-span-1 flex justify-center pb-2">
                      {paymentForm.payments.length > 1 && (
                        <button 
                          type="button" 
                          onClick={() => removePaymentSource(idx)}
                          className="p-2 text-white/20 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-white/40">{t('payments.paymentDate')}</label>
                  <input 
                    type="date" 
                    className="input-glass"
                    value={paymentForm.payment_date}
                    onChange={e => setPaymentForm({...paymentForm, payment_date: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-white/40">{t('payments.reference')}</label>
                  <input 
                    type="text" 
                    className="input-glass"
                    value={paymentForm.reference}
                    onChange={e => setPaymentForm({...paymentForm, reference: e.target.value})}
                    placeholder="e.g. Check #, Transfer Ref"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-6 border-t border-white/5">
                <button type="button" onClick={() => setShowPaymentModal(false)} className="btn-secondary flex-1">
                  {t('common.cancel')}
                </button>
                <button type="submit" disabled={loading} className="btn-primary flex-1">
                  {loading ? t('common.loading') : 'Confirm Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
