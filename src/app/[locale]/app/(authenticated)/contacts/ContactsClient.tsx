'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useBusiness } from '@/lib/contexts/BusinessContext';
import { getContacts } from '@/lib/actions/contacts';
import { Plus, Users, Search, Clock, Check, X, UserPlus, Mail } from 'lucide-react';
import Link from 'next/link';
import { getIncomingContactRequests, handleContactRequest, quickConnectContact } from '@/lib/actions/connections';
import { cn } from '@/lib/utils';
import type { Contact } from '@/lib/types';

type ContactRequest = { id: string; sender_business?: { name?: string; phone?: string; city?: string } | null };

export default function ContactsClient({ defaultBusinessId, initialContacts = [], initialIncoming = [] }: { defaultBusinessId: string; initialContacts?: Contact[]; initialIncoming?: ContactRequest[] }) {
  const t = useTranslations();
  const { activeBusiness, activeRole } = useBusiness();
  const [contacts, setContacts] = useState(initialContacts || []);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const locale = useLocale();
  const [incoming, setIncoming] = useState<ContactRequest[]>(initialIncoming || []);
  const [activeTab, setActiveTab] = useState('all'); // 'all' or 'pending'
  const [quickOpen, setQuickOpen] = useState(false);
  const [connectEmail, setConnectEmail] = useState('');
  const [connectError, setConnectError] = useState('');
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (activeBusiness && activeBusiness.id !== defaultBusinessId) {
      let isMounted = true;
      Promise.all([
        getContacts(activeBusiness.id),
        getIncomingContactRequests()
      ]).then(([newContacts, newIncoming]) => {
        if (isMounted) {
          setContacts(newContacts);
          setIncoming(newIncoming);
          setLoading(false);
        }
      });
      return () => { isMounted = false; };
    }
  }, [activeBusiness, defaultBusinessId]);

  const onHandleRequest = async (id: string, action: 'accept' | 'reject') => {
    if (!activeBusiness) return;
    const res = await handleContactRequest(id, action);
    if (res?.error) alert(res.error);
    else {
      // Refresh local state
      const [newContacts, newIncoming] = await Promise.all([
        getContacts(activeBusiness.id),
        getIncomingContactRequests()
      ]);
      setContacts(newContacts);
      setIncoming(newIncoming);
    }
  };

  const onQuickConnect = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeBusiness) return;
    setConnecting(true);
    setConnectError('');
    const result = await quickConnectContact(activeBusiness.id, connectEmail);
    if (result.error) setConnectError(result.error);
    else {
      setConnectEmail('');
      setQuickOpen(false);
      setActiveTab(result.data?.status === 'connected' ? 'all' : 'pending');
      setContacts(await getContacts(activeBusiness.id));
    }
    setConnecting(false);
  };

  const filteredContacts = (contacts || []).filter(contact =>
    contact.name.toLowerCase().includes(search.toLowerCase()) ||
    (contact.company_name && contact.company_name.toLowerCase().includes(search.toLowerCase())) ||
    (contact.email && contact.email.toLowerCase().includes(search.toLowerCase()))
  );

  if (!activeBusiness) return <div className="animate-pulse text-white/50">{t('common.loading')}</div>;

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white tracking-tight">{t('contacts.title')}</h1>
        {activeRole && ['owner', 'admin', 'accountant', 'staff'].includes(activeRole) && (
          <div className="flex flex-wrap gap-2"><button onClick={() => setQuickOpen(true)} className="btn-primary"><UserPlus className="w-4 h-4" /><span>Connect by email</span></button><Link href={`/${locale}/app/contacts/new`} className="btn-secondary">
            <Plus className="w-4 h-4" />
            <span>Add manually</span>
          </Link></div>
        )}
      </div>

      {quickOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"><form onSubmit={onQuickConnect} className="glass-card w-full max-w-md p-6"><div className="flex items-start justify-between"><div><h2 className="text-xl font-bold text-white">Connect with a Zenqar user</h2><p className="mt-1 text-sm text-white/45">Enter their account email. They approve once, then both companies get a synced contact and private chat.</p></div><button type="button" onClick={() => setQuickOpen(false)} className="rounded-lg p-2 text-white/40 hover:bg-white/5 hover:text-white"><X className="h-5 w-5" /></button></div><label className="mt-6 block space-y-2 text-sm text-white/60">Zenqar account email<div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3"><Mail className="h-4 w-4 text-white/30" /><input autoFocus required type="email" value={connectEmail} onChange={event => setConnectEmail(event.target.value)} placeholder="friend@company.com" className="w-full bg-transparent py-3 text-white outline-none placeholder:text-white/25" /></div></label>{connectError && <p role="alert" className="mt-3 text-sm text-red-300">{connectError}</p>}<div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setQuickOpen(false)} className="btn-secondary">Cancel</button><button disabled={connecting} className="btn-primary">{connecting ? 'Sending…' : 'Send request'}</button></div></form></div>}

      <div className="flex gap-4 border-b border-white/5 mb-6">
        <button 
          onClick={() => setActiveTab('all')}
          className={cn(
            "pb-3 text-sm font-medium transition-colors relative",
            activeTab === 'all' ? "text-zenqar-400" : "text-white/40 hover:text-white/60"
          )}
        >
          {t('contacts.title')}
          {activeTab === 'all' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-zenqar-500 shadow-glow-sm" />}
        </button>
        <button 
          onClick={() => setActiveTab('pending')}
          className={cn(
            "pb-3 text-sm font-medium transition-colors relative flex items-center gap-2",
            activeTab === 'pending' ? "text-zenqar-400" : "text-white/40 hover:text-white/60"
          )}
        >
          {t('common.pending')}
          {(incoming.length > 0 || contacts.some(contact => contact.connection_status === 'pending')) && (
            <span className="w-4 h-4 rounded-full bg-zenqar-500 text-white text-[10px] flex items-center justify-center">
              {incoming.length + contacts.filter(contact => contact.connection_status === 'pending').length}
            </span>
          )}
          {activeTab === 'pending' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-zenqar-500 shadow-glow-sm" />}
        </button>
      </div>

      <div className="glass-card p-4 sm:p-6">
        {activeTab === 'all' && (
          <>
            <div className="mb-6 flex items-center bg-white/5 border border-white/10 rounded-xl px-3 py-2 w-full max-w-md focus-within:border-zenqar-500/50 focus-within:ring-1 focus-within:ring-zenqar-500/50 transition-all">
              <Search className="w-5 h-5 text-white/40 mr-2" />
              <input 
                type="text" 
                placeholder={t('common.search')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent border-none outline-none text-white text-sm w-full placeholder:text-white/30"
              />
            </div>

            {loading ? (
              <div className="h-32 flex items-center justify-center text-white/40">{t('common.loading')}</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredContacts.length > 0 ? (
                  filteredContacts.map(contact => (
                    <Link key={contact.id} href={`/${locale}/app/contacts/${contact.id}`}>
                      <div className="glass-card p-5 hover:border-zenqar-500/50 transition-colors group">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-lg font-medium text-white/80 group-hover:bg-zenqar-500/20 group-hover:text-zenqar-400 transition-colors">
                            {contact.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h3 className="font-semibold text-white truncate">{contact.name}</h3>
                            {contact.company_name && (
                              <p className="text-xs text-white/50 truncate">{contact.company_name}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
                          <span className="text-xs text-white/40">{t(`contacts.${contact.type}`)}</span>
                          {contact.email && <span className="text-xs text-white/40 truncate max-w-[120px]">{contact.email}</span>}
                        </div>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="col-span-full p-12 flex flex-col items-center justify-center text-center">
                    <Users className="w-12 h-12 text-white/20 mb-4" />
                    <h3 className="text-lg font-medium text-white mb-2">{t('common.noData')}</h3>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {activeTab === 'pending' && (
          <div className="space-y-6">
            {incoming.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-white/40 uppercase tracking-wider px-1">Received Requests</h3>
                {incoming.map(req => (
                  <div key={req.id} className="glass-card p-4 flex items-center justify-between gap-4 border-zenqar-500/20 bg-zenqar-500/5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-zenqar-500/20 flex items-center justify-center">
                        <Users className="w-5 h-5 text-zenqar-400" />
                      </div>
                      <div>
                        <p className="font-semibold text-white">{req.sender_business?.name}</p>
                        <p className="text-xs text-white/40 mb-1">Wants to connect with you</p>
                        <div className="flex gap-2 text-[10px] text-white/30">
                           {req.sender_business?.phone && <span>{req.sender_business.phone}</span>}
                           {req.sender_business?.city && <span>{req.sender_business.city}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => onHandleRequest(req.id, 'reject')} className="p-2 rounded-lg hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                      <button onClick={() => onHandleRequest(req.id, 'accept')} className="p-2 rounded-lg bg-zenqar-500/20 hover:bg-zenqar-500/40 text-zenqar-400 transition-colors">
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {contacts.filter(contact => contact.connection_status === 'pending').length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-white/40 uppercase tracking-wider px-1">Sent Requests</h3>
                {contacts.filter(contact => contact.connection_status === 'pending').map(contact => (
                  <div key={contact.id} className="glass-card p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-lg font-medium text-white/40">
                        {contact.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-white">{contact.name}</p>
                        <p className="text-xs text-white/40">{contact.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-white/30 italic">
                      <Clock className="w-3 h-3" /> Waiting for response...
                    </div>
                  </div>
                ))}
              </div>
            )}

            {incoming.length === 0 && contacts.filter(contact => contact.connection_status === 'pending').length === 0 && (
              <div className="p-12 flex flex-col items-center justify-center text-center">
                <Clock className="w-12 h-12 text-white/10 mb-4" />
                <p className="text-sm text-white/40">No pending connection requests</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
