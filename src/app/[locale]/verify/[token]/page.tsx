import { createAdminClient } from '@/lib/supabase/admin';
import { formatCurrency, formatDate, INVOICE_STATUS_COLORS } from '@/lib/utils';
import { getTranslations } from 'next-intl/server';
import { CheckCircle2, XCircle, Building2, Receipt, ShieldCheck, ThumbsUp, Wallet } from 'lucide-react';
import { acceptInvoicePublic, claimPaymentPublic } from '@/lib/actions/invoices';
import VerifyActions from './VerifyActions';
import Link from 'next/link';

export default async function VerifyInvoicePage({ params }: { params: Promise<{ token: string; locale: string }> }) {
  const { token, locale } = await params;
  const t = await getTranslations();

  const supabase = await createAdminClient();
  
  // Try searching by verification_token first
  let { data: invoice, error } = await supabase
    .from('invoices')
    .select('*, business:businesses(*), contact:contacts(*), invoice_items(*)')
    .eq('verification_token', token)
    .single();

  // If not found, try searching by invoice_number (case-insensitive) as a fallback
  if (!invoice) {
    const { data: fallbackInvoice } = await supabase
      .from('invoices')
      .select('*, business:businesses(*), contact:contacts(*), invoice_items(*)')
      .ilike('invoice_number', token)
      .limit(1)
      .single();
    
      if (fallbackInvoice) {
        invoice = fallbackInvoice;
      }
    }

    let paymentAccounts: any[] = [];
    let fxRate = 1310;

    if (invoice?.payment_account_ids?.length > 0) {
      const [accsRes, fxRes] = await Promise.all([
        supabase.from('accounts').select('*').in('id', invoice.payment_account_ids),
        supabase.from('fx_rate_snapshots').select('rate').order('fetched_at', { ascending: false }).limit(1).maybeSingle()
      ]);
      paymentAccounts = accsRes.data || [];
      fxRate = fxRes.data?.rate || 1310;
    }

  const isValid = invoice && invoice.status !== 'draft' && invoice.status !== 'cancelled';

  return (
    <div className="min-h-screen bg-dark-bg text-foreground flex flex-col items-center py-12 px-4 relative">
      {/* Background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-zenqar-500/20 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-2xl relative z-10">
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-primary-gradient flex items-center justify-center shadow-glow mx-auto mb-6">
            <span className="text-white font-bold text-3xl">Z</span>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">{t('verification.title')}</h1>
          <p className="text-white/50 mt-2">{t('verification.subtitle')}</p>
        </div>

        {isValid ? (
          <div className="glass-card-elevated border-emerald-500/30 overflow-hidden">
            <div className="bg-emerald-500/10 px-6 py-4 border-b border-emerald-500/20 flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              <div>
                <h2 className="font-semibold text-emerald-400">{t('verification.validInvoice')}</h2>
                <p className="text-xs text-emerald-400/70">{t('verification.verifiedMessage')}</p>
              </div>
            </div>

            <div className="p-6 md:p-8 space-y-8">
              <div className="flex flex-col md:flex-row justify-between gap-6 pb-8 border-b border-white/10">
                <div>
                  <p className="text-sm text-white/50 mb-1">{t('verification.issuedBy')}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold text-white">{invoice.business.name}</span>
                      {invoice.business.verification_status === 'verified' && (
                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-yellow-500/10 border border-yellow-500/20 text-[9px] font-black uppercase tracking-widest text-yellow-500" title="This company is Zenqar Verified">
                          <ShieldCheck className="w-3 h-3" />
                          Verified
                        </div>
                      )}
                    </div>
                  {invoice.business.legal_name && (
                    <p className="text-sm text-white/50 mt-1">{invoice.business.legal_name}</p>
                  )}
                  {invoice.business.tax_number && (
                    <p className="text-sm text-white/50">{t('settings.taxNumber')}: {invoice.business.tax_number}</p>
                  )}
                </div>
                <div className="md:text-right">
                  <p className="text-sm text-white/50 mb-1">{t('invoices.customer')}</p>
                  <p className="text-lg font-medium text-white">{invoice.contact?.name || '—'}</p>
                  {invoice.contact?.company_name && (
                    <p className="text-sm text-white/50">{invoice.contact.company_name}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-white/50 mb-1">{t('verification.invoiceNumber')}</p>
                  <p className="font-medium text-white">{invoice.invoice_number}</p>
                </div>
                <div>
                  <p className="text-xs text-white/50 mb-1">{t('verification.issueDate')}</p>
                  <p className="font-medium text-white">{formatDate(invoice.issue_date)}</p>
                </div>
                <div>
                  <p className="text-xs text-white/50 mb-1">{t('verification.dueDate')}</p>
                  <p className="font-medium text-white">{invoice.due_date ? formatDate(invoice.due_date) : '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-white/50 mb-1">{t('verification.status')}</p>
                  <span className={`badge ${INVOICE_STATUS_COLORS[invoice.status as keyof typeof INVOICE_STATUS_COLORS]}`}>
                    {t(`invoices.statuses.${invoice.status}`)}
                  </span>
                </div>
              </div>

              <div className="pt-8 border-t border-white/10">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-2 text-white/50 font-medium">{t('common.description')}</th>
                      <th className="text-right py-2 text-white/50 font-medium">{t('common.quantity')}</th>
                      <th className="text-right py-2 text-white/50 font-medium">{t('common.unitPrice')}</th>
                      <th className="text-right py-2 text-white/50 font-medium">{t('common.amount')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {invoice.invoice_items.map((item: any) => (
                      <tr key={item.id}>
                        <td className="py-3 text-white">{item.description}</td>
                        <td className="py-3 text-right text-white/70">{item.quantity}</td>
                        <td className="py-3 text-right text-white/70 tabular-nums">{formatCurrency(item.unit_price, invoice.currency)}</td>
                        <td className="py-3 text-right text-white tabular-nums">{formatCurrency(item.quantity * item.unit_price, invoice.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pt-6 flex justify-end">
                <div className="w-full max-w-xs space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/60">{t('common.subtotal')}</span>
                    <span className="text-white tabular-nums">{formatCurrency(invoice.subtotal, invoice.currency)}</span>
                  </div>
                  {invoice.discount_amount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-white/60">{t('common.discount')} ({invoice.discount_percent}%)</span>
                      <span className="text-white tabular-nums">-{formatCurrency(invoice.discount_amount, invoice.currency)}</span>
                    </div>
                  )}
                  {invoice.tax_amount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-white/60">{t('common.tax')} ({invoice.tax_rate}%)</span>
                      <span className="text-white tabular-nums">{formatCurrency(invoice.tax_amount, invoice.currency)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-3 border-t border-white/10">
                    <span className="font-semibold text-white">{t('verification.total')}</span>
                    <div className="text-right">
                      <span className="font-bold text-lg text-white tabular-nums">{formatCurrency(invoice.total, invoice.currency)}</span>
                      {invoice.currency === 'USD' && (
                        <p className="text-[10px] font-bold text-zenqar-400 mt-0.5">
                          ≈ {Math.round(invoice.total * fxRate).toLocaleString()} IQD
                          <span className="block text-[8px] text-white/20 uppercase tracking-tighter">Market Street Price (+10%)</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              {invoice.payment_account_ids?.length > 0 && (
                <div className="pt-8 border-t border-white/10">
                  <h3 className="text-[10px] font-black text-white/40 mb-4 uppercase tracking-[0.2em]">Payment Instructions</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {paymentAccounts.map((acc: any) => (
                      <div key={acc.id} className="relative overflow-hidden p-4 rounded-2xl bg-white/[0.03] border border-white/10 group hover:border-zenqar-500/50 transition-all duration-300">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-zenqar-500/5 blur-[40px] rounded-full -mr-12 -mt-12 group-hover:bg-zenqar-500/10 transition-colors" />
                        <div className="relative z-10 space-y-3">
                          <div className="flex justify-between items-start">
                            <p className="text-[10px] font-bold text-zenqar-400 uppercase tracking-widest">{acc.name}</p>
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/40 font-bold uppercase">{acc.currency}</span>
                          </div>
                          <div>
                            {acc.bank_name && <p className="text-sm font-semibold text-white mb-1">{acc.bank_name}</p>}
                            <p className="text-base font-mono tracking-wider text-white select-all">{acc.display_detail || 'N/A'}</p>
                          </div>
                          <p className="text-[10px] text-white/20 uppercase font-bold">{acc.account_type}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <VerifyActions 
                token={token}
                status={invoice.status}
                locale={locale}
              />
            </div>
          </div>
        ) : (
          <div className="glass-card border-red-500/30 overflow-hidden text-center p-12">
            <XCircle className="w-16 h-16 text-red-500/50 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">{t('verification.invalidInvoice')}</h2>
            <p className="text-white/50">{t('verification.invalidMessage')}</p>
          </div>
        )}

        <div className="mt-12 text-center">
          <Link href={`/${locale}`} className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-white transition-colors">
            <Receipt className="w-4 h-4" />
            {t('verification.poweredBy')}
          </Link>
        </div>
      </div>
    </div>
  );
}
