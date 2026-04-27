'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { useBusiness } from '@/lib/contexts/BusinessContext';
import { createAccount } from '@/lib/actions/accounts';
import { ArrowLeft, Save, Wallet } from 'lucide-react';
import Link from 'next/link';

export default function NewAccountClient({ defaultBusinessId }: { defaultBusinessId: string }) {
  const t = useTranslations();
  const router = useRouter();
  const locale = useLocale();
  const { activeBusiness } = useBusiness();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    name: '',
    account_type: 'cash' as 'cash' | 'bank' | 'wallet' | 'other',
    currency: 'IQD' as 'IQD' | 'USD',
    display_detail: '',
    bank_name: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBusiness) return;
    
    setSaving(true);
    setError('');

    const res = await createAccount(activeBusiness.id, {
      ...form,
      display_detail: form.display_detail || null,
      bank_name: form.bank_name || null,
    });

    if (res?.error) {
      setError(res.error);
      setSaving(false);
    } else {
      router.push(`/${locale}/app/accounts`);
      router.refresh();
    }
  };

  if (!activeBusiness) return <div className="animate-pulse text-white/50">{t('common.loading')}</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-8">
      <div className="flex items-center gap-4 mb-6">
        <Link href={`/${locale}/app/accounts`} className="p-2 rounded-xl hover:bg-white/5 transition-colors text-white/60 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-white tracking-tight">{t('accounts.newAccount')}</h1>
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
              <Wallet className="w-5 h-5 text-zenqar-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">{t('accounts.accountType')}</h3>
              <p className="text-xs text-white/40">Select where the money is stored</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-sm text-white/60">{t('accounts.accountName')}</label>
              <input 
                type="text" 
                className="input-glass"
                placeholder="e.g. Main Cash, Bank of Baghdad"
                value={form.name}
                onChange={e => setForm({...form, name: e.target.value})}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm text-white/60">{t('accounts.accountType')}</label>
              <select 
                className="select-glass"
                value={form.account_type}
                onChange={e => setForm({...form, account_type: e.target.value as any})}
                required
              >
                <option value="cash">{t('accounts.types.cash')}</option>
                <option value="bank">{t('accounts.types.bank')}</option>
                <option value="wallet">{t('accounts.types.wallet')}</option>
                <option value="other">{t('accounts.types.other')}</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm text-white/60">{t('common.currency')}</label>
              <select 
                className="select-glass"
                value={form.currency}
                onChange={e => setForm({...form, currency: e.target.value as any})}
                required
              >
                <option value="IQD">IQD (عراقي)</option>
                <option value="USD">USD (دولار)</option>
              </select>
            </div>

            {form.account_type === 'bank' && (
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-sm text-white/60">{t('accounts.bankName')}</label>
                <input 
                  type="text" 
                  className="input-glass"
                  value={form.bank_name}
                  onChange={e => setForm({...form, bank_name: e.target.value})}
                  placeholder="e.g. Trade Bank of Iraq"
                />
              </div>
            )}

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-sm text-white/60">{t('accounts.displayDetail')}</label>
              <input 
                type="text" 
                className="input-glass"
                value={form.display_detail}
                onChange={e => setForm({...form, display_detail: e.target.value})}
                placeholder="e.g. **** 1234"
              />
              <p className="text-[10px] text-white/30">Optional: For internal display purposes only.</p>
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button type="submit" disabled={saving} className="btn-primary w-full sm:w-auto px-12">
              <Save className="w-4 h-4" />
              {saving ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
