'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { useBusiness } from '@/lib/contexts/BusinessContext';
import { createExpense } from '@/lib/actions/expenses';
import { ArrowLeft, Save, Receipt, ScanLine, LoaderCircle } from 'lucide-react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';

type ExpenseAccount = { id: string; name: string; currency: 'IQD' | 'USD'; balance: number };
type ExpenseContact = { id: string; name: string; type: string };

export default function NewExpenseClient({ accounts = [], contacts = [] }: { accounts?: ExpenseAccount[]; contacts?: ExpenseContact[] }) {
  const t = useTranslations();
  const router = useRouter();
  const locale = useLocale();
  const { activeBusiness } = useBusiness();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState('');

  const [form, setForm] = useState({
    account_id: '',
    contact_id: '',
    category: 'General',
    description: '',
    amount: 0,
    currency: 'IQD' as 'IQD' | 'USD',
    expense_date: new Date().toISOString().split('T')[0],
    note: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBusiness) return;
    
    setSaving(true);
    setError('');

    const res = await createExpense(activeBusiness.id, {
      ...form,
      contact_id: form.contact_id || null,
      note: form.note || null,
    });

    if (res?.error) {
      setError(res.error);
      setSaving(false);
    } else {
      router.push(`/${locale}/app/expenses`);
      router.refresh();
    }
  };

  const handleScan = async (file: File | undefined) => {
    if (!file) return;
    setScanning(true);
    setError('');
    setScanMessage('');
    try {
      const body = new FormData();
      body.append('file', file);
      const response = await fetch('/api/ai/scan-document', { method: 'POST', body });
      const result = await response.json() as { data?: { supplier_name: string; invoice_number: string; issue_date: string; currency: 'IQD' | 'USD'; total: number; category: string; description: string; notes: string; confidence: number }; error?: string };
      if (!response.ok || !result.data) throw new Error(result.error || 'The document could not be scanned.');
      const scan = result.data;
      setForm(current => ({
        ...current,
        category: scan.category,
        description: scan.description,
        amount: scan.total,
        currency: scan.currency,
        expense_date: scan.issue_date || current.expense_date,
        note: [scan.supplier_name && `Supplier: ${scan.supplier_name}`, scan.invoice_number && `Invoice: ${scan.invoice_number}`, scan.notes].filter(Boolean).join(' · '),
        account_id: current.account_id && accounts.some(account => account.id === current.account_id && account.currency === scan.currency) ? current.account_id : '',
      }));
      setScanMessage(`Scan complete (${Math.round(scan.confidence * 100)}% confidence). Review every field before saving.`);
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : 'The document could not be scanned.');
    } finally {
      setScanning(false);
    }
  };

  if (!activeBusiness) return <div className="animate-pulse text-white/50">{t('common.loading')}</div>;

  const categories = [
    'General', 'Utilities', 'Rent', 'Salaries', 'Transport', 
    'Marketing', 'Software', 'Equipment', 'Maintenance', 'Other'
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-8">
      <div className="flex items-center gap-4 mb-6">
        <Link href={`/${locale}/app/expenses`} className="p-2 rounded-xl hover:bg-white/5 transition-colors text-white/60 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-white tracking-tight">{t('expenses.newExpense')}</h1>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="glass-card p-6 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-white/5">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
              <Receipt className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Expense Details</h3>
              <p className="text-xs text-white/40">Record a business expense or purchase</p>
            </div>
          </div>

          <div className="rounded-2xl border border-zenqar-500/20 bg-zenqar-500/5 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold text-white"><ScanLine className="h-4 w-4 text-zenqar-400" /> AI document scan</p>
                <p className="mt-1 text-xs text-white/45">Upload a PDF or invoice image (max 8 MB). It is sent to your configured AI provider for extraction; Zenqar does not save an expense until you review and submit.</p>
              </div>
              <label className="btn-primary cursor-pointer whitespace-nowrap">
                {scanning ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
                {scanning ? 'Scanning…' : 'Scan document'}
                <input className="sr-only" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={scanning} onChange={event => void handleScan(event.target.files?.[0])} />
              </label>
            </div>
            {scanMessage && <p className="mt-3 text-xs text-emerald-300" role="status">{scanMessage}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-sm text-white/60">{t('common.description')}</label>
              <input 
                type="text" 
                className="input-glass"
                placeholder="e.g. Office supplies, Server hosting"
                value={form.description}
                onChange={e => setForm({...form, description: e.target.value})}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm text-white/60">{t('expenses.category')}</label>
              <select 
                className="select-glass"
                value={form.category}
                onChange={e => setForm({...form, category: e.target.value})}
                required
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{t(`expenses.categories.${cat}`)}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm text-white/60">{t('expenses.expenseDate')}</label>
              <input 
                type="date" 
                className="input-glass"
                value={form.expense_date}
                onChange={e => setForm({...form, expense_date: e.target.value})}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm text-white/60">{t('common.amount')}</label>
              <input 
                type="number" 
                step="0.01"
                min="0.01"
                className="input-glass"
                value={form.amount || ''}
                onChange={e => setForm({...form, amount: parseFloat(e.target.value) || 0})}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm text-white/60">{t('common.currency')}</label>
              <select 
                className="select-glass"
                value={form.currency}
                onChange={e => setForm({...form, currency: e.target.value as 'IQD' | 'USD'})}
                required
              >
                <option value="IQD">IQD (عراقي)</option>
                <option value="USD">USD (دولار)</option>
              </select>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-sm text-white/60">{t('expenses.paidFrom')}</label>
              <select 
                className="select-glass"
                value={form.account_id}
                onChange={e => setForm({...form, account_id: e.target.value})}
                required
              >
                <option value="">{t('common.selectOption')}</option>
                {accounts.filter(account => account.currency === form.currency).map(account => (
                  <option key={account.id} value={account.id}>{account.name} ({formatCurrency(account.balance, account.currency)})</option>
                ))}
              </select>
              {accounts.filter(account => account.currency === form.currency).length === 0 && (
                <p className="text-[10px] text-red-400 mt-1">No accounts found for {form.currency}</p>
              )}
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-sm text-white/60">{t('expenses.supplier')}</label>
              <select 
                className="select-glass"
                value={form.contact_id}
                onChange={e => setForm({...form, contact_id: e.target.value})}
              >
                <option value="">{t('common.optional')}</option>
                {contacts.filter(contact => contact.type !== 'customer').map(contact => (
                  <option key={contact.id} value={contact.id}>{contact.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5 pt-2">
            <label className="text-sm text-white/60">{t('common.notes')}</label>
            <textarea 
              className="textarea-glass min-h-[80px]"
              value={form.note}
              onChange={e => setForm({...form, note: e.target.value})}
              placeholder={t('common.optional')}
            />
          </div>

          <div className="pt-4 flex justify-end">
            <button type="submit" disabled={saving || !form.account_id} className="btn-primary w-full sm:w-auto px-12">
              <Save className="w-4 h-4" />
              {saving ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
