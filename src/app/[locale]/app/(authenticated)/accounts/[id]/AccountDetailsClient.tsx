'use client';

import { useTranslations, useLocale } from 'next-intl';
import { ArrowLeft, Wallet, TrendingUp, TrendingDown } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { adjustAccountBalance } from '@/lib/actions/accounts';
import { useState } from 'react';
import { Settings } from 'lucide-react';

export default function AccountDetailsClient({ account, transactions, businessId }: any) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [targetBalance, setTargetBalance] = useState(account.balance);
  const [loading, setLoading] = useState(false);

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await adjustAccountBalance(businessId, account.id, targetBalance, account.currency);
    if (res?.error) alert(res.error);
    else {
      setShowAdjustModal(false);
      router.refresh();
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center gap-4 mb-6">
        <Link href={`/${locale}/app/accounts`} className="p-2 rounded-xl hover:bg-white/5 transition-colors text-white/60 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">{account.name}</h1>
          <p className="text-sm text-white/40">{t(`accounts.types.${account.account_type}`)} • {account.currency}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="stats-card md:col-span-1">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-medium text-white/50">{t('accounts.balance')}</p>
            <button 
              onClick={() => setShowAdjustModal(true)}
              className="p-1 rounded-md hover:bg-white/5 text-white/20 hover:text-white transition-colors"
              title="Manually adjust balance"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-3xl font-bold text-white tabular-nums tracking-tight">
            {formatCurrency(account.balance, account.currency)}
          </p>
          {account.bank_name && (
            <p className="text-xs text-white/30 mt-4 pt-4 border-t border-white/5">
              {account.bank_name} {account.display_detail ? `• ${account.display_detail}` : ''}
            </p>
          )}
        </div>

        <div className="lg:col-span-2 glass-card flex flex-col h-full">
          <div className="p-5 border-b border-white/5">
            <h3 className="font-semibold text-white">{t('accounts.transactions')}</h3>
          </div>
          <div className="p-0 overflow-x-auto flex-1">
            {transactions.length > 0 ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('common.date')}</th>
                    <th>{t('common.description')}</th>
                    <th className="text-right">{t('common.amount')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {transactions.map((tx: any) => (
                    <tr key={tx.id}>
                      <td className="text-xs text-white/60">{formatDate(tx.transaction_date)}</td>
                      <td>
                        <div className="text-sm text-white font-medium">{tx.description}</div>
                        <div className="text-[10px] text-white/30 uppercase tracking-tighter">{tx.type}</div>
                      </td>
                      <td className="text-right tabular-nums font-semibold">
                        <span className={cn(
                          tx.type === 'deposit' ? 'text-emerald-400' : 'text-red-400'
                        )}>
                          {tx.type === 'deposit' ? '+' : '-'}{formatCurrency(tx.amount, account.currency)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-center p-8">
                <TrendingUp className="w-12 h-12 text-white/10 mb-4" />
                <p className="text-sm text-white/40">{t('accounts.noTransactions')}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Adjust Balance Modal */}
      {showAdjustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-white mb-2">Adjust Balance</h3>
            <p className="text-sm text-white/50 mb-6">Enter the current actual balance. A manual adjustment transaction will be recorded to sync the ledger.</p>
            
            <form onSubmit={handleAdjust} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm text-white/60">Actual Current Balance</label>
                <div className="relative">
                  <input 
                    type="number" 
                    step="0.01"
                    className="input-glass"
                    value={targetBalance}
                    onChange={e => setTargetBalance(parseFloat(e.target.value) || 0)}
                    required
                    autoFocus
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/40">{account.currency}</span>
                </div>
              </div>
              
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAdjustModal(false)} className="btn-secondary flex-1">
                  {t('common.cancel')}
                </button>
                <button type="submit" disabled={loading} className="btn-primary flex-1">
                  {loading ? t('common.loading') : 'Update Balance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
