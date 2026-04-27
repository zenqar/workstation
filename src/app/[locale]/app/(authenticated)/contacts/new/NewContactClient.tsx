'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { useBusiness } from '@/lib/contexts/BusinessContext';
import { createContact } from '@/lib/actions/contacts';
import { ArrowLeft, Save, User } from 'lucide-react';
import Link from 'next/link';

export default function NewContactClient({ defaultBusinessId }: { defaultBusinessId: string }) {
  const t = useTranslations();
  const router = useRouter();
  const locale = useLocale();
  const { activeBusiness } = useBusiness();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    type: 'customer' as 'customer' | 'supplier' | 'both',
    name: '',
    company_name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    country: 'Iraq',
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBusiness) return;
    
    setSaving(true);
    setError('');

    const res = await createContact(activeBusiness.id, {
      ...form,
      company_name: form.company_name || null,
      email: form.email || null,
      phone: form.phone || null,
      address: form.address || null,
      city: form.city || null,
      country: form.country || null,
      notes: form.notes || null,
    });

    if (res?.error) {
      setError(res.error);
      setSaving(false);
    } else {
      router.push(`/${locale}/app/contacts`);
      router.refresh();
    }
  };

  if (!activeBusiness) return <div className="animate-pulse text-white/50">{t('common.loading')}</div>;

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center gap-4 mb-6">
        <Link href={`/${locale}/app/contacts`} className="p-2 rounded-xl hover:bg-white/5 transition-colors text-white/60 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-white tracking-tight">{t('contacts.newContact')}</h1>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="glass-card p-6 space-y-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <User className="w-5 h-5 text-zenqar-400" />
                {t('contacts.contactDetails')}
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm text-white/60">{t('common.name')}</label>
                  <input 
                    type="text" 
                    className="input-glass"
                    value={form.name}
                    onChange={e => setForm({...form, name: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-white/60">{t('contacts.type')}</label>
                  <select 
                    className="select-glass"
                    value={form.type}
                    onChange={e => setForm({...form, type: e.target.value as any})}
                    required
                  >
                    <option value="customer">{t('contacts.customer')}</option>
                    <option value="supplier">{t('contacts.supplier')}</option>
                    <option value="both">{t('contacts.both')}</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-white/60">{t('contacts.companyName')}</label>
                  <input 
                    type="text" 
                    className="input-glass"
                    value={form.company_name}
                    onChange={e => setForm({...form, company_name: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-white/60">{t('common.email')}</label>
                  <input 
                    type="email" 
                    className="input-glass"
                    value={form.email}
                    onChange={e => setForm({...form, email: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-white/60">{t('common.phone')}</label>
                  <input 
                    type="text" 
                    className="input-glass"
                    value={form.phone}
                    onChange={e => setForm({...form, phone: e.target.value})}
                  />
                </div>
              </div>
            </div>

            <div className="glass-card p-6 space-y-4">
              <h3 className="text-lg font-semibold text-white">{t('common.address')}</h3>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm text-white/60">{t('common.address')}</label>
                  <input 
                    type="text" 
                    className="input-glass"
                    value={form.address}
                    onChange={e => setForm({...form, address: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm text-white/60">{t('common.city')}</label>
                    <input 
                      type="text" 
                      className="input-glass"
                      value={form.city}
                      onChange={e => setForm({...form, city: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm text-white/60">{t('common.country')}</label>
                    <input 
                      type="text" 
                      className="input-glass"
                      value={form.country}
                      onChange={e => setForm({...form, country: e.target.value})}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="glass-card p-6 space-y-4">
              <h3 className="text-lg font-semibold text-white">{t('common.notes')}</h3>
              <textarea 
                className="textarea-glass min-h-[150px]"
                value={form.notes}
                onChange={e => setForm({...form, notes: e.target.value})}
                placeholder={t('common.optional')}
              />
            </div>

            <div className="pt-4">
              <button type="submit" disabled={saving} className="btn-primary w-full">
                <Save className="w-4 h-4" />
                {saving ? t('common.loading') : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
