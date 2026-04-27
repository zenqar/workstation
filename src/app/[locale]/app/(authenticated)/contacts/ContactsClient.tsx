'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useBusiness } from '@/lib/contexts/BusinessContext';
import { getContacts } from '@/lib/actions/contacts';
import { Plus, Users, Search } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function ContactsClient({ defaultBusinessId, initialContacts = [] }: any) {
  const t = useTranslations();
  const { activeBusiness, activeRole } = useBusiness();
  const [contacts, setContacts] = useState(initialContacts || []);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const locale = useLocale();

  useEffect(() => {
    if (activeBusiness && activeBusiness.id !== defaultBusinessId) {
      let isMounted = true;
      setLoading(true);
      getContacts(activeBusiness.id).then((newContacts) => {
        if (isMounted) {
          setContacts(newContacts);
          setLoading(false);
        }
      });
      return () => { isMounted = false; };
    }
  }, [activeBusiness, defaultBusinessId]);

  const filteredContacts = (contacts || []).filter((c: any) => 
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.company_name && c.company_name.toLowerCase().includes(search.toLowerCase())) ||
    (c.email && c.email.toLowerCase().includes(search.toLowerCase()))
  );

  if (!activeBusiness) return <div className="animate-pulse text-white/50">{t('common.loading')}</div>;

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white tracking-tight">{t('contacts.title')}</h1>
        {activeRole && ['owner', 'admin', 'accountant', 'staff'].includes(activeRole) && (
          <Link href={`/${locale}/app/contacts/new`} className="btn-primary">
            <Plus className="w-4 h-4" />
            <span>{t('contacts.newContact')}</span>
          </Link>
        )}
      </div>

      <div className="glass-card p-4 sm:p-6">
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
              filteredContacts.map((contact: any) => (
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
      </div>
    </div>
  );
}
