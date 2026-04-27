'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useBusiness } from '@/lib/contexts/BusinessContext';
import { getAccountsWithBalances } from '@/lib/actions/accounts';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Plus, Wallet, ArrowRightLeft } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useParams } from 'next/navigation';

export default function AccountsClient({ defaultBusinessId, initialAccounts = [] }: any) {
  const t = useTranslations();
  const { activeBusiness, activeRole } = useBusiness();
  const [accounts, setAccounts] = useState(initialAccounts || []);
  const [loading, setLoading] = useState(false);
  const locale = useLocale();

  useEffect(() => {
    if (activeBusiness && activeBusiness.id !== defaultBusinessId) {
      let isMounted = true;
      setLoading(true);
      getAccountsWithBalances(activeBusiness.id).then((newAccounts) => {
        if (isMounted) {
          setAccounts(newAccounts);
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
          <h1 className="text-2xl font-bold text-white tracking-tight">{t('accounts.title')}</h1>
          <p className="text-sm text-white/50 mt-1">{t('dashboard.totalBalanceIqd')} / USD</p>
        </div>
        {activeRole && ['owner', 'admin', 'accountant'].includes(activeRole) && (
          <div className="flex gap-2">
            <Link href={`/${locale}/app/accounts/transfer`} className="btn-secondary">
              <ArrowRightLeft className="w-4 h-4" />
              <span className="hidden sm:inline">{t('accounts.transfer')}</span>
            </Link>
            <Link href={`/${locale}/app/accounts/new`} className="btn-primary">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">{t('accounts.newAccount')}</span>
            </Link>
          </div>
        )}
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center text-white/40">{t('common.loading')}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(accounts || []).map((acc: any) => (
            <Link key={acc.id} href={`/${locale}/app/accounts/${acc.id}`}>
              <div className="glass-card p-6 flex flex-col h-full hover:border-zenqar-500/50 transition-colors group cursor-pointer">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-zenqar-500/20 transition-colors">
                      <Wallet className="w-5 h-5 text-white/60 group-hover:text-zenqar-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{acc.name}</h3>
                      <p className="text-xs text-white/40">{t(`accounts.types.${acc.account_type}`)}</p>
                    </div>
                  </div>
                  <span className="text-xs font-medium px-2 py-1 rounded bg-white/10 text-white/70">
                    {acc.currency}
                  </span>
                </div>
                
                <div className="mt-auto">
                  <p className="text-sm text-white/50 mb-1">{t('accounts.balance')}</p>
                  <p className="text-2xl font-bold text-white tabular-nums">
                    {formatCurrency(acc.balance, acc.currency)}
                  </p>
                </div>
                
                {acc.display_detail && (
                  <div className="mt-4 pt-4 border-t border-white/5 text-xs text-white/40">
                    {acc.bank_name ? `${acc.bank_name} • ` : ''}{acc.display_detail}
                  </div>
                )}
              </div>
            </Link>
          ))}
          {accounts.length === 0 && (
            <div className="col-span-full glass-card p-12 flex flex-col items-center justify-center text-center">
              <Wallet className="w-12 h-12 text-white/20 mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">{t('common.noData')}</h3>
              <p className="text-sm text-white/50">{t('accounts.noTransactions')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
