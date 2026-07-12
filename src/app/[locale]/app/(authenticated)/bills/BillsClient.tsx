'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { FileClock, Paperclip, ScanLine, Search, Wallet, X } from 'lucide-react';
import { useBusiness } from '@/lib/contexts/BusinessContext';
import { getSupplierBills, paySupplierBill } from '@/lib/actions/bills';
import { getAccountsWithBalances } from '@/lib/actions/accounts';
import { formatCurrency, formatDate } from '@/lib/utils';

type Bill = {
  id: string;
  supplier_name: string;
  invoice_number: string | null;
  description: string;
  category: string;
  currency: 'IQD' | 'USD';
  issue_date: string;
  due_date: string | null;
  total: number;
  amount_paid: number;
  status: 'unpaid' | 'partially_paid' | 'paid' | 'cancelled';
  attachment_path: string | null;
  contact?: { id: string; name: string } | null;
};

type Account = { id: string; name: string; currency: 'IQD' | 'USD'; balance: number; is_active: boolean };

export default function BillsClient({ defaultBusinessId, initialBills, initialAccounts }: {
  defaultBusinessId: string;
  initialBills: Bill[];
  initialAccounts: Account[];
}) {
  const locale = useLocale();
  const { activeBusiness, activeRole } = useBusiness();
  const [bills, setBills] = useState(initialBills);
  const [accounts, setAccounts] = useState(initialAccounts);
  const [search, setSearch] = useState('');
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [accountId, setAccountId] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!activeBusiness || activeBusiness.id === defaultBusinessId) return;
    let mounted = true;
    Promise.all([getSupplierBills(activeBusiness.id), getAccountsWithBalances(activeBusiness.id)]).then(([nextBills, nextAccounts]) => {
      if (!mounted) return;
      setBills(nextBills as Bill[]);
      setAccounts(nextAccounts as Account[]);
      setSelectedBill(null);
    });
    return () => { mounted = false; };
  }, [activeBusiness, defaultBusinessId]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return bills;
    return bills.filter(bill => [bill.supplier_name, bill.contact?.name, bill.invoice_number, bill.description]
      .some(value => value?.toLowerCase().includes(query)));
  }, [bills, search]);

  async function handlePay(event: React.FormEvent) {
    event.preventDefault();
    if (!activeBusiness || !selectedBill || !accountId) return;
    setSaving(true);
    setError('');
    const result = await paySupplierBill(activeBusiness.id, selectedBill.id, accountId, paymentDate);
    if (result.error) {
      setError(result.error);
      setSaving(false);
      return;
    }
    setBills(current => current.map(bill => bill.id === selectedBill.id ? { ...bill, status: 'paid', amount_paid: bill.total } : bill));
    setSelectedBill(null);
    setAccountId('');
    setSaving(false);
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Supplier bills</h1>
          <p className="mt-1 text-sm text-white/45">Track invoices you owe without reducing cash until they are actually paid.</p>
        </div>
        <Link href={`/${locale}/app/documents`} className="btn-primary"><ScanLine className="h-4 w-4" /> Scan supplier invoice</Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="glass-card p-4"><p className="text-xs text-white/45">Open bills</p><p className="mt-1 text-2xl font-bold text-white">{bills.filter(bill => ['unpaid', 'partially_paid'].includes(bill.status)).length}</p></div>
        <div className="glass-card p-4"><p className="text-xs text-white/45">Overdue</p><p className="mt-1 text-2xl font-bold text-red-400">{bills.filter(bill => bill.status === 'unpaid' && bill.due_date && new Date(bill.due_date) < new Date()).length}</p></div>
        <div className="glass-card p-4"><p className="text-xs text-white/45">Documents attached</p><p className="mt-1 text-2xl font-bold text-zenqar-300">{bills.filter(bill => bill.attachment_path).length}</p></div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="border-b border-white/5 p-4">
          <label className="flex max-w-md items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <Search className="h-4 w-4 text-white/35" />
            <span className="sr-only">Search supplier bills</span>
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search supplier, number, or description" className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/25" />
          </label>
        </div>
        {filtered.length ? (
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead><tr><th>Supplier</th><th>Invoice</th><th>Due</th><th>Status</th><th className="text-right">Amount</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>{filtered.map(bill => {
                const overdue = bill.status === 'unpaid' && !!bill.due_date && new Date(bill.due_date) < new Date();
                return <tr key={bill.id}>
                  <td><p className="font-medium text-white">{bill.contact?.name || bill.supplier_name || 'Unknown supplier'}</p><p className="mt-1 text-xs text-white/35">{bill.description}</p></td>
                  <td className="text-white/65">{bill.invoice_number || '—'}</td>
                  <td className={overdue ? 'text-red-400' : 'text-white/65'}>{bill.due_date ? formatDate(bill.due_date) : 'No due date'}</td>
                  <td><span className={`badge ${bill.status === 'paid' ? 'bg-emerald-500/10 text-emerald-300' : overdue ? 'bg-red-500/10 text-red-300' : 'bg-amber-500/10 text-amber-300'}`}>{overdue ? 'overdue' : bill.status.replace('_', ' ')}</span></td>
                  <td className="text-right font-semibold text-white">{formatCurrency(bill.total - bill.amount_paid, bill.currency)}</td>
                  <td><div className="flex justify-end gap-2">
                    {bill.attachment_path && <a href={`/api/documents/${bill.attachment_path}`} target="_blank" rel="noreferrer" className="rounded-lg p-2 text-white/45 hover:bg-white/5 hover:text-white" aria-label="Open original document"><Paperclip className="h-4 w-4" /></a>}
                    {['unpaid', 'partially_paid'].includes(bill.status) && ['owner', 'admin', 'accountant'].includes(activeRole || '') && <button onClick={() => { setSelectedBill(bill); setError(''); }} className="btn-secondary py-1.5 text-xs"><Wallet className="h-3.5 w-3.5" /> Pay</button>}
                  </div></td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        ) : <div className="p-12 text-center"><FileClock className="mx-auto mb-3 h-10 w-10 text-white/20" /><p className="font-medium text-white">No supplier bills found</p><p className="mt-1 text-sm text-white/40">Scan an unpaid invoice to add it here.</p></div>}
      </div>

      {selectedBill && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="pay-bill-title">
        <form onSubmit={handlePay} className="glass-card w-full max-w-md space-y-5 p-6">
          <div className="flex items-start justify-between"><div><h2 id="pay-bill-title" className="text-lg font-bold text-white">Pay supplier bill</h2><p className="mt-1 text-sm text-white/45">{formatCurrency(selectedBill.total - selectedBill.amount_paid, selectedBill.currency)} due</p></div><button type="button" onClick={() => setSelectedBill(null)} aria-label="Close payment dialog" className="p-1 text-white/40 hover:text-white"><X className="h-5 w-5" /></button></div>
          {error && <p className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
          <label className="block space-y-1.5"><span className="text-sm text-white/60">Pay from account</span><select required value={accountId} onChange={event => setAccountId(event.target.value)} className="select-glass"><option value="">Select an account</option>{accounts.filter(account => account.is_active && account.currency === selectedBill.currency).map(account => <option key={account.id} value={account.id}>{account.name} ({formatCurrency(account.balance, account.currency)})</option>)}</select></label>
          <label className="block space-y-1.5"><span className="text-sm text-white/60">Payment date</span><input required type="date" value={paymentDate} onChange={event => setPaymentDate(event.target.value)} className="input-glass" /></label>
          <div className="flex gap-3"><button type="button" onClick={() => setSelectedBill(null)} className="btn-secondary flex-1">Cancel</button><button disabled={saving || !accountId} className="btn-primary flex-1">{saving ? 'Recording…' : 'Confirm payment'}</button></div>
        </form>
      </div>}
    </div>
  );
}
