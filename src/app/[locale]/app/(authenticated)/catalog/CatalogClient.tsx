'use client';

import { useEffect, useMemo, useState } from 'react';
import { Archive, Box, Plus, Search, Sparkles, Wrench, X } from 'lucide-react';
import { useBusiness } from '@/lib/contexts/BusinessContext';
import { archiveCatalogItem, getCatalogItems, saveCatalogItem } from '@/lib/actions/catalog';
import { formatCurrency } from '@/lib/utils';
import type { CatalogItem, CurrencyCode } from '@/lib/types';

type CatalogForm = { item_type: 'product' | 'service'; name: string; description: string; sku: string; unit: string; sales_price: number; purchase_cost: number; currency: CurrencyCode; tax_rate: number };
const emptyForm: CatalogForm = { item_type: 'service', name: '', description: '', sku: '', unit: 'unit', sales_price: 0, purchase_cost: 0, currency: 'IQD', tax_rate: 0 };

export default function CatalogClient({ defaultBusinessId, initialItems }: { defaultBusinessId: string; initialItems: CatalogItem[] }) {
  const { activeBusiness, activeRole } = useBusiness();
  const [items, setItems] = useState(initialItems);
  const [query, setQuery] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [form, setForm] = useState<CatalogForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (activeBusiness && activeBusiness.id !== defaultBusinessId) void getCatalogItems(activeBusiness.id).then(setItems);
  }, [activeBusiness, defaultBusinessId]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term ? items.filter(item => [item.name, item.description, item.sku].some(value => value?.toLowerCase().includes(term))) : items;
  }, [items, query]);

  const openEditor = (item?: CatalogItem) => {
    setError('');
    setEditing(item || null);
    setForm(item ? { item_type: item.item_type, name: item.name, description: item.description || '', sku: item.sku || '', unit: item.unit, sales_price: Number(item.sales_price), purchase_cost: Number(item.purchase_cost), currency: item.currency, tax_rate: Number(item.tax_rate) } : emptyForm);
    setEditorOpen(true);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeBusiness) return;
    setSaving(true);
    setError('');
    const result = await saveCatalogItem(activeBusiness.id, form, editing?.id);
    if (result.error || !result.data) setError(result.error || 'Could not save this item');
    else {
      setItems(previous => editing ? previous.map(item => item.id === result.data?.id ? result.data : item) : [...previous, result.data!].sort((a, b) => a.name.localeCompare(b.name)));
      setEditorOpen(false);
    }
    setSaving(false);
  };

  const archive = async (item: CatalogItem) => {
    if (!activeBusiness || !confirm(`Archive “${item.name}”? Existing invoices will not change.`)) return;
    const result = await archiveCatalogItem(activeBusiness.id, item.id);
    if (result.error) setError(result.error); else setItems(previous => previous.filter(entry => entry.id !== item.id));
  };

  if (!activeBusiness) return <div className="animate-pulse text-white/50">Loading…</div>;
  const canWrite = Boolean(activeRole && ['owner', 'admin', 'accountant', 'staff'].includes(activeRole));

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-2xl font-bold text-white">Products & services</h1><p className="mt-1 text-sm text-white/45">Save what your company sells once, then add it to invoices in one click.</p></div>{canWrite && <button className="btn-primary" onClick={() => openEditor()}><Plus className="h-4 w-4" /> Add item</button>}</div>
      {error && <div role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}
      <div className="glass-card p-4"><div className="flex max-w-lg items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3"><Search className="h-4 w-4 text-white/30" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search name, SKU, or description" className="w-full bg-transparent py-2.5 text-sm text-white outline-none placeholder:text-white/25" /></div></div>
      {filtered.length === 0 ? <div className="glass-card flex min-h-64 flex-col items-center justify-center p-8 text-center"><Sparkles className="mb-4 h-10 w-10 text-zenqar-400/60" /><h2 className="font-semibold text-white">Build your reusable catalog</h2><p className="mt-2 max-w-md text-sm text-white/40">Add services, products, prices, units, costs, and tax rates. Invoice creation becomes faster and more consistent.</p></div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.map(item => <article key={item.id} className="glass-card p-5"><div className="flex items-start justify-between gap-3"><div className="flex gap-3"><div className="rounded-xl bg-zenqar-500/10 p-2.5 text-zenqar-400">{item.item_type === 'service' ? <Wrench className="h-5 w-5" /> : <Box className="h-5 w-5" />}</div><div><h2 className="font-semibold text-white">{item.name}</h2><p className="text-xs capitalize text-white/35">{item.item_type} · per {item.unit}</p></div></div><span className="rounded-full bg-white/5 px-2 py-1 text-[10px] uppercase tracking-wide text-white/35">{item.sku || 'No SKU'}</span></div><p className="mt-4 min-h-10 text-sm text-white/50">{item.description || 'No description'}</p><div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-black/15 p-3 text-xs"><div><p className="text-white/30">Sale price</p><p className="mt-1 font-semibold text-white">{formatCurrency(item.sales_price, item.currency)}</p></div><div><p className="text-white/30">Cost</p><p className="mt-1 font-semibold text-white/70">{formatCurrency(item.purchase_cost, item.currency)}</p></div></div>{canWrite && <div className="mt-4 flex justify-end gap-2"><button onClick={() => openEditor(item)} className="btn-secondary px-3 py-1.5 text-xs">Edit</button>{activeRole !== 'staff' && <button onClick={() => void archive(item)} aria-label={`Archive ${item.name}`} className="rounded-lg p-2 text-white/30 hover:bg-red-500/10 hover:text-red-300"><Archive className="h-4 w-4" /></button>}</div>}</article>)}</div>}

      {editorOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"><form onSubmit={submit} className="glass-card max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6"><div className="mb-6 flex items-center justify-between"><div><h2 className="text-xl font-bold text-white">{editing ? 'Edit catalog item' : 'Add product or service'}</h2><p className="text-xs text-white/40">Values remain editable when you add the item to an invoice.</p></div><button type="button" onClick={() => setEditorOpen(false)} className="rounded-lg p-2 text-white/40 hover:bg-white/5 hover:text-white"><X className="h-5 w-5" /></button></div><div className="grid gap-4 sm:grid-cols-2"><label className="space-y-1.5 text-sm text-white/60">Type<select className="select-glass" value={form.item_type} onChange={event => setForm({ ...form, item_type: event.target.value as 'product' | 'service' })}><option value="service">Service</option><option value="product">Product</option></select></label><label className="space-y-1.5 text-sm text-white/60">Name<input required maxLength={160} className="input-glass" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label><label className="space-y-1.5 text-sm text-white/60 sm:col-span-2">Description<textarea className="textarea-glass min-h-20" value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} /></label><label className="space-y-1.5 text-sm text-white/60">SKU / code<input className="input-glass" value={form.sku} onChange={event => setForm({ ...form, sku: event.target.value })} /></label><label className="space-y-1.5 text-sm text-white/60">Unit<input required className="input-glass" placeholder="hour, item, month…" value={form.unit} onChange={event => setForm({ ...form, unit: event.target.value })} /></label><label className="space-y-1.5 text-sm text-white/60">Currency<select className="select-glass" value={form.currency} onChange={event => setForm({ ...form, currency: event.target.value as CurrencyCode })}><option value="IQD">IQD</option><option value="USD">USD</option></select></label><label className="space-y-1.5 text-sm text-white/60">Sales price<input type="number" min="0" step="0.01" className="input-glass" value={form.sales_price || ''} onChange={event => setForm({ ...form, sales_price: Number(event.target.value) || 0 })} /></label><label className="space-y-1.5 text-sm text-white/60">Purchase cost<input type="number" min="0" step="0.01" className="input-glass" value={form.purchase_cost || ''} onChange={event => setForm({ ...form, purchase_cost: Number(event.target.value) || 0 })} /></label><label className="space-y-1.5 text-sm text-white/60">Default tax rate %<input type="number" min="0" max="100" step="0.01" className="input-glass" value={form.tax_rate || ''} onChange={event => setForm({ ...form, tax_rate: Number(event.target.value) || 0 })} /></label></div>{error && <p className="mt-4 text-sm text-red-300">{error}</p>}<div className="mt-6 flex justify-end gap-3"><button type="button" className="btn-secondary" onClick={() => setEditorOpen(false)}>Cancel</button><button disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save item'}</button></div></form></div>}
    </div>
  );
}
