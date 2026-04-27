'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { useBusiness } from '@/lib/contexts/BusinessContext';
import { transferFunds } from '@/lib/actions/accounts';
import { ArrowLeft, ArrowRightLeft, Save } from 'lucide-react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';

export default function TransferFundsClient({ defaultBusinessId, accounts = [] }: any) {
  const t = useTranslations();
  const router = useRouter();
  const locale = useLocale();
  const { activeBusiness } = useBusiness();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    from_account_id: '',
    to_account_id: '',
    amount: 0,
    currency: 'IQD' as 'IQD' | 'USD',
    transfer_date: new Date().toISOString().split('T')[0],
    description: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBusiness) return;

    if (form.from_account_id === form.to_account_id) {
      setError('Source and destination accounts must be different');
      return;
    }
    
    setSaving(true);
    setError('');

    const res = await transferFunds(
      activeBusiness.id,
      form.from_account_id,
      form.to_account_id,
      form.amount,
      form.currency,
      form.transfer_date,
      form.description
    );

    if (res?.error) {
      setError(res.error);
      setSaving(false);
    } else {
      router.push(`/${locale}/app/accounts`);
      router.refresh();
    }
  };

  const filteredToAccounts = accounts.filter((acc: any) => acc.id !== form.from_account_id);

  if (!activeBusiness) return <div className="animate-pulse text-white/50">{t('common.loading')}</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-8">
      <div className="flex items-center gap-4 mb-6">
        <Link href={`/${locale}/app/accounts`} className="p-2 rounded-xl hover:bg-white/5 transition-colors text-white/60 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-white tracking-tight">{t('accounts.transfer')}</h1>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="glass-card p-6 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-white/5">
            <div className="w-10 h-10 rounded-xl bg-zenqar-500/20 flex items-center justify-center">
              <ArrowRightLeft className="w-5 h-5 text-zenqar-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Internal Transfer</h3>
              <p className="text-xs text-white/40">Move money between your own accounts</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm text-white/60">{t('accounts.transferFrom')}</label>
                <select 
                  className="input-glass"
                  value={form.from_account_id}
                  onChange={e => {
                    const acc = accounts.find((a: any) => a.id === e.target.value);
                    setForm({...form, from_account_id: e.target.value, currency: acc?.currency || form.currency});
                  }}
                  required
                >
                  <option value="">{t('common.selectOption')}</option>
                  {accounts.map((acc: any) => (
                    <option key={acc.id} value={acc.id}>{acc.name} ({formatCurrency(acc.balance, acc.currency)})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm text-white/60">{t('accounts.transferTo')}</label>
                <select 
                  className="input-glass"
                  value={form.to_account_id}
                  onChange={e => setForm({...form, to_account_id: e.target.value})}
                  required
                >
                  <option value="">{t('common.selectOption')}</option>
                  {filteredToAccounts.map((acc: any) => (
                    <option key={acc.id} value={acc.id}>{acc.name} ({formatCurrency(acc.balance, acc.currency)})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm text-white/60">{t('accounts.transferAmount')}</label>
                <div className="relative">
                  <input 
                    type="number" 
                    step="0.01"
                    min="0.01"
                    className="input-glass pr-12"
                    value={form.amount || ''}
                    onChange={e => setForm({...form, amount: parseFloat(e.target.value) || 0})}
                    required
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-white/40">{form.currency}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm text-white/60">{t('accounts.transferDate')}</label>
                <input 
                  type="date" 
                  className="input-glass"
                  value={form.transfer_date}
                  onChange={e => setForm({...form, transfer_date: e.target.value})}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm text-white/60">{t('common.description')}</label>
              <input 
                type="text" 
                className="input-glass"
                placeholder="Internal transfer"
                value={form.description}
                onChange={e => setForm({...form, description: e.target.value})}
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button type="submit" disabled={saving} className="btn-primary w-full sm:w-auto px-12">
              <ArrowRightLeft className="w-4 h-4" />
              {saving ? t('common.loading') : t('accounts.transfer')}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
