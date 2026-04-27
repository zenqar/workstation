'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { useBusiness } from '@/lib/contexts/BusinessContext';
import { createInvoice } from '@/lib/actions/invoices';
import { getContacts } from '@/lib/actions/contacts';
import { Plus, Trash2, ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';

export default function NewInvoiceClient({ defaultBusinessId, initialContacts = [], initialContext }: any) {
  const t = useTranslations();
  const router = useRouter();
  const locale = useLocale();
  const { activeBusiness } = useBusiness();
  const [contacts, setContacts] = useState(initialContacts || []);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    customer_mode: 'existing' as 'existing' | 'custom',
    contact_id: '',
    custom_customer_name: '',
    custom_customer_type: 'individual' as 'individual' | 'business',
    save_to_contacts: false,
    currency: initialContext?.settings?.default_currency || 'IQD',
    issue_date: new Date().toISOString().split('T')[0],
    due_date: '',
    discount_percent: 0,
    tax_rate: initialContext?.settings?.invoice_tax_rate || 0,
    notes: initialContext?.settings?.invoice_footer_note || '',
    internal_notes: '',
  });

  const [items, setItems] = useState([
    { description: '', quantity: 1, unit_price: 0 }
  ]);

  useEffect(() => {
    if (activeBusiness && activeBusiness.id !== defaultBusinessId) {
      getContacts(activeBusiness.id).then(setContacts);
    }
  }, [activeBusiness, defaultBusinessId]);

  const calculateSubtotal = () => items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  const subtotal = calculateSubtotal();
  const discountAmount = (subtotal * form.discount_percent) / 100;
  const taxable = subtotal - discountAmount;
  const taxAmount = (taxable * form.tax_rate) / 100;
  const total = taxable + taxAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBusiness) return;
    
    // Filter out empty items
    const validItems = items.filter(i => i.description.trim() !== '');
    if (validItems.length === 0) {
      setError(t('invoices.noItems'));
      return;
    }

    setSaving(true);
    setError('');

    const res = await createInvoice(activeBusiness.id, {
      ...form,
      due_date: form.due_date || undefined,
      items: validItems
    } as any);

    if (res?.error) {
      setError(res.error);
      setSaving(false);
    } else {
      router.push(`/${locale}/app/invoices/${res.data?.id}`);
    }
  };

  if (!activeBusiness) return <div className="animate-pulse text-white/50">{t('common.loading')}</div>;

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center gap-4 mb-6">
        <Link href={`/${locale}/app/invoices`} className="p-2 rounded-xl hover:bg-white/5 transition-colors text-white/60 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-white tracking-tight">{t('invoices.createTitle')}</h1>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="glass-card p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="space-y-1.5 lg:col-span-2">
            <div className="flex items-center justify-between">
              <label className="text-sm text-white/60">{t('invoices.customer')}</label>
              <button 
                type="button" 
                onClick={() => setForm({ ...form, customer_mode: form.customer_mode === 'existing' ? 'custom' : 'existing' })}
                className="text-xs text-zenqar-400 hover:text-zenqar-300"
              >
                {form.customer_mode === 'existing' ? '+ Enter Custom Name' : 'Select Existing'}
              </button>
            </div>
            
            {form.customer_mode === 'existing' ? (
              <select 
                className="input-glass"
                value={form.contact_id}
                onChange={e => setForm({...form, contact_id: e.target.value})}
              >
                <option value="">{t('invoices.selectCustomer')}</option>
                {contacts.filter((c: any) => c.type !== 'supplier').map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name} {c.company_name ? `(${c.company_name})` : ''}</option>
                ))}
              </select>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-3">
                  <select 
                    className="input-glass w-1/3"
                    value={form.custom_customer_type}
                    onChange={e => setForm({...form, custom_customer_type: e.target.value as 'individual' | 'business'})}
                  >
                    <option value="individual">Individual</option>
                    <option value="business">Business</option>
                  </select>
                  <input 
                    type="text"
                    className="input-glass flex-1"
                    placeholder="Customer or Business Name"
                    value={form.custom_customer_name}
                    onChange={e => setForm({...form, custom_customer_name: e.target.value})}
                    required={form.customer_mode === 'custom'}
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer group w-fit">
                  <div className="relative flex items-center justify-center w-4 h-4 rounded border border-white/20 bg-black/20 group-hover:border-zenqar-400 transition-colors">
                    <input 
                      type="checkbox" 
                      className="peer sr-only"
                      checked={form.save_to_contacts}
                      onChange={e => setForm({...form, save_to_contacts: e.target.checked})}
                    />
                    {form.save_to_contacts && <div className="absolute inset-0 m-0.5 bg-zenqar-500 rounded-sm"></div>}
                  </div>
                  <span className="text-xs text-white/50 group-hover:text-white/80 transition-colors">Save this to my contacts list</span>
                </label>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm text-white/60">{t('common.currency')}</label>
            <select 
              className="input-glass"
              value={form.currency}
              onChange={e => setForm({...form, currency: e.target.value})}
              required
            >
              <option value="IQD">IQD (عراقي)</option>
              <option value="USD">USD (دولار)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm text-white/60">{t('invoices.invoiceDate')}</label>
            <input 
              type="date" 
              className="input-glass"
              value={form.issue_date}
              onChange={e => setForm({...form, issue_date: e.target.value})}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm text-white/60">{t('invoices.dueDate')}</label>
            <input 
              type="date" 
              className="input-glass"
              value={form.due_date}
              onChange={e => setForm({...form, due_date: e.target.value})}
            />
          </div>
        </div>

        <div className="glass-card overflow-hidden">
          <div className="p-5 border-b border-white/5">
            <h3 className="font-semibold text-white">{t('invoices.lineItems')}</h3>
          </div>
          <div className="p-0 overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th className="w-1/2">{t('common.description')}</th>
                  <th className="w-24 text-right">{t('common.quantity')}</th>
                  <th className="w-32 text-right">{t('common.unitPrice')}</th>
                  <th className="w-32 text-right">{t('common.amount')}</th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {items.map((item, index) => (
                  <tr key={index}>
                    <td className="py-2">
                      <input 
                        type="text" 
                        placeholder={t('common.description')}
                        className="input-glass bg-transparent border-transparent hover:border-white/10"
                        value={item.description}
                        onChange={e => {
                          const newItems = [...items];
                          newItems[index].description = e.target.value;
                          setItems(newItems);
                        }}
                      />
                    </td>
                    <td className="py-2">
                      <input 
                        type="number" 
                        min="1"
                        step="0.01"
                        className="input-glass bg-transparent border-transparent hover:border-white/10 text-right"
                        value={item.quantity || ''}
                        onChange={e => {
                          const newItems = [...items];
                          newItems[index].quantity = parseFloat(e.target.value) || 0;
                          setItems(newItems);
                        }}
                      />
                    </td>
                    <td className="py-2">
                      <input 
                        type="number" 
                        min="0"
                        step="0.01"
                        className="input-glass bg-transparent border-transparent hover:border-white/10 text-right"
                        value={item.unit_price || ''}
                        onChange={e => {
                          const newItems = [...items];
                          newItems[index].unit_price = parseFloat(e.target.value) || 0;
                          setItems(newItems);
                        }}
                      />
                    </td>
                    <td className="py-2 text-right text-white/70 tabular-nums align-middle">
                      {(item.quantity * item.unit_price).toLocaleString()}
                    </td>
                    <td className="py-2 text-center align-middle">
                      <button 
                        type="button"
                        onClick={() => {
                          if (items.length > 1) {
                            setItems(items.filter((_, i) => i !== index));
                          }
                        }}
                        className="p-1.5 text-white/30 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t border-white/5">
            <button 
              type="button"
              onClick={() => setItems([...items, { description: '', quantity: 1, unit_price: 0 }])}
              className="text-sm font-medium text-zenqar-400 hover:text-zenqar-300 flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4" /> {t('invoices.addItem')}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-card p-6 space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm text-white/60">{t('common.notes')}</label>
              <textarea 
                className="input-glass min-h-[100px]"
                value={form.notes}
                onChange={e => setForm({...form, notes: e.target.value})}
                placeholder={t('common.optional')}
              />
            </div>
          </div>

          <div className="glass-card p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-white/60 text-sm">{t('common.subtotal')}</span>
                <span className="text-white tabular-nums">{subtotal.toLocaleString()}</span>
              </div>
              
              <div className="flex items-center justify-between gap-4">
                <label className="text-white/60 text-sm whitespace-nowrap">{t('invoices.discountPercent')}</label>
                <div className="flex items-center gap-2">
                  <input 
                    type="number" 
                    min="0" max="100" step="0.1"
                    className="input-glass w-24 text-right"
                    value={form.discount_percent || ''}
                    onChange={e => setForm({...form, discount_percent: parseFloat(e.target.value) || 0})}
                  />
                  <span className="text-white tabular-nums w-24 text-right">-{discountAmount.toLocaleString()}</span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <label className="text-white/60 text-sm whitespace-nowrap">{t('invoices.taxRate')}</label>
                <div className="flex items-center gap-2">
                  <input 
                    type="number" 
                    min="0" max="100" step="0.1"
                    className="input-glass w-24 text-right"
                    value={form.tax_rate || ''}
                    onChange={e => setForm({...form, tax_rate: parseFloat(e.target.value) || 0})}
                  />
                  <span className="text-white tabular-nums w-24 text-right">+{taxAmount.toLocaleString()}</span>
                </div>
              </div>

              <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                <span className="text-lg font-bold text-white">{t('common.total')}</span>
                <span className="text-2xl font-bold text-white tabular-nums">
                  {total.toLocaleString()} <span className="text-sm text-white/50 font-normal ml-1">{form.currency}</span>
                </span>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-white/5 flex justify-end">
              <button type="submit" disabled={saving} className="btn-primary w-full sm:w-auto">
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
