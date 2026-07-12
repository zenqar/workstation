'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { useBusiness } from '@/lib/contexts/BusinessContext';
import { createExpense } from '@/lib/actions/expenses';
import { createSupplierBill } from '@/lib/actions/bills';
import { getAccountsWithBalances } from '@/lib/actions/accounts';
import { getContacts } from '@/lib/actions/contacts';
import { ArrowLeft, Save, Receipt, ScanLine, LoaderCircle, UploadCloud, CheckCircle2, AlertTriangle, FileClock, Camera } from 'lucide-react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';

type ExpenseAccount = { id: string; name: string; currency: 'IQD' | 'USD'; balance: number };
type ExpenseContact = { id: string; name: string; company_name?: string | null; type: string };
type ScanResult = {
  document_type: 'invoice' | 'receipt' | 'other';
  supplier_name: string;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  currency: 'IQD' | 'USD';
  subtotal: number;
  tax: number;
  total: number;
  category: string;
  description: string;
  notes: string;
  confidence: number;
};

const ACCEPTED_DOCUMENT_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
const MAX_DOCUMENT_SIZE = 8 * 1024 * 1024;

function emptyExpenseForm() {
  return {
    account_id: '', contact_id: '', category: 'General', description: '', amount: 0,
    currency: 'IQD' as 'IQD' | 'USD', expense_date: new Date().toISOString().split('T')[0], note: '',
  };
}

export default function NewExpenseClient({
  accounts = [],
  contacts = [],
  defaultBusinessId,
  scannerFirst = false,
}: {
  accounts?: ExpenseAccount[];
  contacts?: ExpenseContact[];
  defaultBusinessId?: string;
  scannerFirst?: boolean;
}) {
  const t = useTranslations();
  const router = useRouter();
  const locale = useLocale();
  const { activeBusiness } = useBusiness();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState('');
  const [selectedFileName, setSelectedFileName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [scanDetails, setScanDetails] = useState<ScanResult | null>(null);
  const [entryType, setEntryType] = useState<'paid' | 'unpaid'>('paid');
  const [dragActive, setDragActive] = useState(false);
  const [savePhase, setSavePhase] = useState<'idle' | 'uploading' | 'saving'>('idle');
  const [accountOptions, setAccountOptions] = useState(accounts);
  const [contactOptions, setContactOptions] = useState(contacts);
  const scanRequestRef = useRef(0);
  const previousBusinessIdRef = useRef(activeBusiness?.id);

  const [form, setForm] = useState(emptyExpenseForm);

  useEffect(() => {
    if (!activeBusiness || !defaultBusinessId) return;
    let mounted = true;
    const optionsPromise = activeBusiness.id === defaultBusinessId
      ? Promise.resolve([accounts, contacts] as const)
      : Promise.all([
          getAccountsWithBalances(activeBusiness.id),
          getContacts(activeBusiness.id),
        ]);
    optionsPromise.then(([nextAccounts, nextContacts]) => {
      if (!mounted) return;
      setAccountOptions(nextAccounts as ExpenseAccount[]);
      setContactOptions(nextContacts as ExpenseContact[]);
      if (previousBusinessIdRef.current && previousBusinessIdRef.current !== activeBusiness.id) {
        scanRequestRef.current += 1;
        setForm(emptyExpenseForm());
        setSelectedFile(null);
        setSelectedFileName('');
        setScanDetails(null);
        setScanMessage('');
        setError('');
        setEntryType('paid');
      }
      previousBusinessIdRef.current = activeBusiness.id;
    });
    return () => { mounted = false; };
  }, [activeBusiness, defaultBusinessId, accounts, contacts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBusiness || scanning) return;
    if (scannerFirst && !scanDetails) {
      setError('Scan a document successfully before saving it.');
      return;
    }
    if (entryType === 'paid' && !form.account_id) {
      setError('Choose the account this expense was paid from.');
      return;
    }

    setSaving(true);
    setError('');
    let attachmentPath: string | null = null;
    try {
      if (selectedFile) {
        setSavePhase('uploading');
        const uploadBody = new FormData();
        uploadBody.append('business_id', activeBusiness.id);
        uploadBody.append('file', selectedFile);
        const uploadResponse = await fetch('/api/documents/upload', { method: 'POST', body: uploadBody });
        const uploadResult = await uploadResponse.json() as { path?: string; error?: string };
        if (!uploadResponse.ok || !uploadResult.path) throw new Error(uploadResult.error || 'The original document could not be saved.');
        attachmentPath = uploadResult.path;
      }

      setSavePhase('saving');
      const result = entryType === 'unpaid'
        ? await createSupplierBill(activeBusiness.id, {
            contact_id: form.contact_id || null,
            supplier_name: scanDetails?.supplier_name || '',
            invoice_number: scanDetails?.invoice_number || null,
            category: form.category,
            description: form.description,
            currency: form.currency,
            issue_date: form.expense_date,
            due_date: scanDetails?.due_date || null,
            subtotal: scanDetails?.subtotal || form.amount,
            tax_amount: scanDetails?.tax || 0,
            total: form.amount,
            notes: form.note || null,
            attachment_path: attachmentPath,
          })
        : await createExpense(activeBusiness.id, {
            ...form,
            contact_id: form.contact_id || null,
            note: form.note || null,
            receipt_url: attachmentPath,
          });

      if (result.error) {
        if (attachmentPath) void fetch('/api/documents/upload', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: attachmentPath }) });
        throw new Error(result.error);
      }

      router.push(`/${locale}/app/${entryType === 'unpaid' ? 'bills' : 'expenses'}`);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'The document could not be saved.');
      setSaving(false);
      setSavePhase('idle');
    }
  };

  const handleScan = async (file: File | undefined) => {
    if (!file || scanning || !activeBusiness) return;
    if (!ACCEPTED_DOCUMENT_TYPES.has(file.type)) {
      setError('Choose a PDF, JPG, PNG, or WebP document.');
      return;
    }
    if (file.size === 0 || file.size > MAX_DOCUMENT_SIZE) {
      setError('The document must be smaller than 8 MB.');
      return;
    }
    const requestId = ++scanRequestRef.current;
    setSelectedFile(file);
    setSelectedFileName(file.name);
    setScanning(true);
    setError('');
    setScanMessage('');
    setScanDetails(null);
    setForm(current => ({ ...emptyExpenseForm(), account_id: current.account_id }));
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('business_id', activeBusiness.id);
      const response = await fetch('/api/ai/scan-document', { method: 'POST', body });
      const result = await response.json() as { data?: ScanResult; error?: string };
      if (!response.ok || !result.data) throw new Error(result.error || 'The document could not be scanned.');
      if (scanRequestRef.current !== requestId) return;
      const scan = result.data;
      const normalizedSupplier = scan.supplier_name.trim().toLowerCase();
      const matchedSupplier = normalizedSupplier ? contactOptions.find(contact =>
        [contact.name, contact.company_name].some(value => value?.trim().toLowerCase() === normalizedSupplier)
      ) : undefined;
      setForm(current => ({
        ...current,
        category: scan.category,
        description: scan.description,
        amount: scan.total,
        currency: scan.currency,
        expense_date: scan.issue_date || current.expense_date,
        note: scan.notes,
        contact_id: matchedSupplier?.id || '',
        account_id: current.account_id && accountOptions.some(account => account.id === current.account_id && account.currency === scan.currency) ? current.account_id : '',
      }));
      setScanDetails(scan);
      setEntryType(scan.document_type === 'invoice' ? 'unpaid' : 'paid');
      setScanMessage(`Scan complete (${Math.round(scan.confidence * 100)}% confidence)${matchedSupplier ? ` · matched ${matchedSupplier.name}` : ''}. Review every field before saving.`);
    } catch (scanError) {
      if (scanRequestRef.current === requestId) setError(scanError instanceof Error ? scanError.message : 'The document could not be scanned.');
    } finally {
      if (scanRequestRef.current === requestId) setScanning(false);
    }
  };

  if (!activeBusiness) return <div className="animate-pulse text-white/50">{t('common.loading')}</div>;

  const categories = [
    'General', 'Utilities', 'Rent', 'Salaries', 'Transport', 
    'Marketing', 'Software', 'Equipment', 'Maintenance', 'Other'
  ];
  const currentStep = saving ? 2 : scanDetails ? 1 : 0;
  const matchingAccounts = accountOptions.filter(account => account.currency === form.currency);

  return (
    <div className={scannerFirst ? 'max-w-4xl mx-auto space-y-6 pb-8' : 'max-w-2xl mx-auto space-y-6 pb-8'}>
      <div className="flex items-center gap-4 mb-6">
        <Link href={`/${locale}/app/${scannerFirst ? 'dashboard' : 'expenses'}`} className="p-2 rounded-xl hover:bg-white/5 transition-colors text-white/60 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">{scannerFirst ? 'AI Document Inbox' : t('expenses.newExpense')}</h1>
          {scannerFirst && <p className="mt-1 text-sm text-white/45">Turn a paper invoice or receipt into a digital bookkeeping entry in three simple steps.</p>}
        </div>
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
              <h3 className="text-lg font-semibold text-white">{scannerFirst ? 'Review bookkeeping details' : 'Expense details'}</h3>
              <p className="text-xs text-white/40">{scannerFirst ? 'The original document will be kept privately with the entry' : 'Record a business expense or purchase'}</p>
            </div>
          </div>

          {scannerFirst && (
            <div className="grid grid-cols-3 gap-2" aria-label="Document import steps">
              {['1. Upload', '2. Review', '3. Save'].map((step, index) => (
                <div key={step} className={`rounded-xl border px-3 py-2 text-center text-xs font-semibold ${index <= currentStep ? 'border-zenqar-500/30 bg-zenqar-500/10 text-zenqar-300' : 'border-white/10 text-white/35'}`}>{step}</div>
              ))}
            </div>
          )}

          <div
            className={`rounded-2xl border bg-zenqar-500/[0.07] transition-colors ${dragActive ? 'border-zenqar-300 bg-zenqar-500/15' : 'border-zenqar-500/30'} ${scannerFirst ? 'p-8 text-center' : 'p-4'}`}
            onDragEnter={event => { event.preventDefault(); if (!scanning) setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDragOver={event => event.preventDefault()}
            onDrop={event => {
              event.preventDefault();
              setDragActive(false);
              void handleScan(event.dataTransfer.files?.[0]);
            }}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className={scannerFirst ? 'mx-auto' : ''}>
                {scannerFirst && <UploadCloud className="mx-auto mb-3 h-10 w-10 text-zenqar-400" />}
                <p className={`flex items-center gap-2 font-semibold text-white ${scannerFirst ? 'justify-center text-lg' : 'text-sm'}`}><ScanLine className="h-4 w-4 text-zenqar-400" /> Scan paper invoice or receipt</p>
                <p className="mt-1 text-xs text-white/45">Upload or drag in a PDF, JPG, PNG, or WebP (max 8 MB). Scanning sends it to your configured OpenRouter model; saving keeps the original privately for your audit trail.</p>
                {selectedFileName && <p className="mt-2 text-xs font-medium text-white/70">{selectedFileName}</p>}
              </div>
              <div className={`flex flex-wrap justify-center gap-2 ${scannerFirst ? 'mx-auto mt-2' : ''}`}>
                <label className="btn-primary cursor-pointer whitespace-nowrap">
                  {scanning ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                  {scanning ? 'Scanning…' : 'Choose document'}
                  <input className="sr-only" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={scanning} onChange={event => { void handleScan(event.target.files?.[0]); event.currentTarget.value = ''; }} />
                </label>
                {scannerFirst && <label className="btn-secondary cursor-pointer whitespace-nowrap"><Camera className="h-4 w-4" /> Take photo<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={scanning} onChange={event => { void handleScan(event.target.files?.[0]); event.currentTarget.value = ''; }} /></label>}
              </div>
            </div>
            {scanMessage && <p className={`mt-3 text-xs text-emerald-300 ${scannerFirst ? 'flex items-center justify-center gap-1' : ''}`} role="status"><CheckCircle2 className="h-3.5 w-3.5" />{scanMessage}</p>}
          </div>

          {scanDetails && scannerFirst && (
            <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
              <div className="grid gap-3 sm:grid-cols-4">
                <div><p className="text-[10px] uppercase tracking-wider text-white/35">Supplier</p><p className="mt-1 truncate text-sm font-medium text-white">{scanDetails.supplier_name || 'Not detected'}</p></div>
                <div><p className="text-[10px] uppercase tracking-wider text-white/35">Invoice number</p><p className="mt-1 text-sm font-medium text-white">{scanDetails.invoice_number || 'Not detected'}</p></div>
                <div><p className="text-[10px] uppercase tracking-wider text-white/35">Due date</p><p className="mt-1 text-sm font-medium text-white">{scanDetails.due_date || 'Not shown'}</p></div>
                <div><p className="text-[10px] uppercase tracking-wider text-white/35">Tax</p><p className="mt-1 text-sm font-medium text-white">{formatCurrency(scanDetails.tax, scanDetails.currency)}</p></div>
              </div>
              {scanDetails.confidence < 0.7 && <p className="flex items-start gap-2 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />Low-confidence scan: compare every field with the original document before saving.</p>}
            </div>
          )}

          {scannerFirst && scanDetails && (
            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm font-semibold text-white">Has this document already been paid?</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={() => setEntryType('paid')} className={`rounded-2xl border p-4 text-left transition-colors ${entryType === 'paid' ? 'border-emerald-400/40 bg-emerald-500/10' : 'border-white/10 bg-white/[0.02]'}`}>
                  <span className="flex items-center gap-2 font-semibold text-white"><Receipt className="h-4 w-4 text-emerald-300" /> Yes, record paid expense</span>
                  <span className="mt-1 block text-xs text-white/45">Reduces the selected cash or bank account now.</span>
                </button>
                <button type="button" onClick={() => setEntryType('unpaid')} className={`rounded-2xl border p-4 text-left transition-colors ${entryType === 'unpaid' ? 'border-amber-400/40 bg-amber-500/10' : 'border-white/10 bg-white/[0.02]'}`}>
                  <span className="flex items-center gap-2 font-semibold text-white"><FileClock className="h-4 w-4 text-amber-300" /> No, save as supplier bill</span>
                  <span className="mt-1 block text-xs text-white/45">Tracks money owed without changing an account balance.</span>
                </button>
              </div>
            </fieldset>
          )}

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

            {entryType === 'paid' && <div className="space-y-1.5 md:col-span-2">
              <label className="text-sm text-white/60">{t('expenses.paidFrom')}</label>
              <select 
                className="select-glass"
                value={form.account_id}
                onChange={e => setForm({...form, account_id: e.target.value})}
                required
              >
                <option value="">{t('common.selectOption')}</option>
                {matchingAccounts.map(account => (
                  <option key={account.id} value={account.id}>{account.name} ({formatCurrency(account.balance, account.currency)})</option>
                ))}
              </select>
              {matchingAccounts.length === 0 && (
                <p className="mt-1 text-xs text-red-400">No {form.currency} account exists. <Link href={`/${locale}/app/accounts/new`} className="underline hover:text-red-300">Create one first</Link>.</p>
              )}
            </div>}

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-sm text-white/60">{t('expenses.supplier')}</label>
              <select 
                className="select-glass"
                value={form.contact_id}
                onChange={e => setForm({...form, contact_id: e.target.value})}
              >
                <option value="">{t('common.optional')}</option>
                {contactOptions.filter(contact => contact.type !== 'customer').map(contact => (
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
            <button type="submit" disabled={saving || scanning || !form.description || !form.amount || (entryType === 'paid' && !form.account_id) || (scannerFirst && !scanDetails)} className="btn-primary w-full sm:w-auto px-12">
              <Save className="w-4 h-4" />
              {savePhase === 'uploading' ? 'Saving original…' : savePhase === 'saving' ? 'Posting entry…' : entryType === 'unpaid' ? 'Save supplier bill' : 'Save paid expense'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
