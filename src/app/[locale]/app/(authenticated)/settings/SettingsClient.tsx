'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useBusiness } from '@/lib/contexts/BusinessContext';
import { getBusinessContext, getTeamMembers, updateBusiness, updateBusinessSettings, inviteTeamMember } from '@/lib/actions/businesses';
import { Building2, Users, FileText, Globe, Save, Mail, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

export default function SettingsClient({ defaultBusinessId, initialContext, initialTeam, user, profile }: any) {
  const t = useTranslations();
  const router = useRouter();
  const { activeBusiness, activeRole } = useBusiness();
  const [context, setContext] = useState(initialContext || null);
  const [team, setTeam] = useState(initialTeam || []);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('business');

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Forms state
  const [bizForm, setBizForm] = useState(initialContext?.business || {});
  const [setForm, setSetForm] = useState(initialContext?.settings || {});
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('staff');

  useEffect(() => {
    if (activeBusiness && activeBusiness.id !== defaultBusinessId) {
      let isMounted = true;
      setLoading(true);
      Promise.all([
        getBusinessContext(activeBusiness.id),
        getTeamMembers(activeBusiness.id)
      ]).then(([newCtx, newTeam]) => {
        if (isMounted) {
          setContext(newCtx);
          setBizForm(newCtx?.business || {});
          setSetForm(newCtx?.settings || {});
          setTeam(newTeam);
          setLoading(false);
        }
      });
      return () => { isMounted = false; };
    }
  }, [activeBusiness, defaultBusinessId]);

  const handleSaveBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBusiness) return;
    setSaving(true);
    setMessage({ type: '', text: '' });
    const res = await updateBusiness(activeBusiness.id, bizForm);
    if (res?.error) setMessage({ type: 'error', text: res.error });
    else setMessage({ type: 'success', text: t('settings.savedSuccess') });
    setSaving(false);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBusiness) return;
    setSaving(true);
    setMessage({ type: '', text: '' });
    const res = await updateBusinessSettings(activeBusiness.id, setForm);
    if (res?.error) setMessage({ type: 'error', text: res.error });
    else setMessage({ type: 'success', text: t('settings.savedSuccess') });
    setSaving(false);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBusiness) return;
    setSaving(true);
    setMessage({ type: '', text: '' });
    const res = await inviteTeamMember(activeBusiness.id, inviteEmail, inviteRole);
    if (res?.error) setMessage({ type: 'error', text: res.error });
    else {
      setMessage({ type: 'success', text: 'Invitation sent' });
      setInviteEmail('');
      const newTeam = await getTeamMembers(activeBusiness.id);
      setTeam(newTeam);
    }
    setSaving(false);
  };

  if (!activeBusiness) return <div className="animate-pulse text-white/50">{t('common.loading')}</div>;

  const tabs = [
    { id: 'business', label: t('settings.business'), icon: Building2 },
    { id: 'invoices', label: t('settings.invoiceSettings'), icon: FileText },
    { id: 'team', label: t('settings.team'), icon: Users },
  ];

  const canEdit = ['owner', 'admin'].includes(activeRole || '');

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">{t('settings.title')}</h1>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <div className="w-full md:w-64 flex-shrink-0">
          <div className="flex md:flex-col gap-1 overflow-x-auto pb-2 md:pb-0">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setMessage({ type: '', text: '' }); }}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors whitespace-nowrap",
                  activeTab === tab.id 
                    ? "bg-zenqar-600/20 text-white border border-zenqar-500/20" 
                    : "text-white/60 hover:text-white hover:bg-white/5"
                )}
              >
                <tab.icon className={cn("w-5 h-5", activeTab === tab.id ? "text-zenqar-400" : "text-white/40")} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          {message.text && (
            <div className={cn(
              "mb-6 px-4 py-3 rounded-xl text-sm border",
              message.type === 'error' ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
            )}>
              {message.text}
            </div>
          )}

          {activeTab === 'business' && (
            <form onSubmit={handleSaveBusiness} className="glass-card p-6 space-y-6">
              <h2 className="text-lg font-semibold text-white">{t('settings.business')}</h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm text-white/60">{t('settings.businessName')}</label>
                  <input type="text" className="input-glass" value={bizForm.name || ''} onChange={e => setBizForm({...bizForm, name: e.target.value})} disabled={!canEdit} required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-white/60">{t('settings.legalName')}</label>
                  <input type="text" className="input-glass" value={bizForm.legal_name || ''} onChange={e => setBizForm({...bizForm, legal_name: e.target.value})} disabled={!canEdit} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-white/60">{t('common.email')}</label>
                  <input type="email" className="input-glass" value={bizForm.email || ''} onChange={e => setBizForm({...bizForm, email: e.target.value})} disabled={!canEdit} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-white/60">{t('common.phone')}</label>
                  <input type="text" className="input-glass" value={bizForm.phone || ''} onChange={e => setBizForm({...bizForm, phone: e.target.value})} disabled={!canEdit} />
                </div>
              </div>

              {canEdit && (
                <div className="flex justify-end pt-4 border-t border-white/5">
                  <button type="submit" disabled={saving} className="btn-primary">
                    <Save className="w-4 h-4" /> {saving ? t('common.loading') : t('common.save')}
                  </button>
                </div>
              )}
            </form>
          )}

          {activeTab === 'invoices' && (
            <form onSubmit={handleSaveSettings} className="glass-card p-6 space-y-6">
              <h2 className="text-lg font-semibold text-white">{t('settings.invoiceSettings')}</h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm text-white/60">{t('settings.taxLabel')}</label>
                  <input type="text" className="input-glass" value={setForm.invoice_tax_label || ''} onChange={e => setSetForm({...setForm, invoice_tax_label: e.target.value})} disabled={!canEdit} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-white/60">{t('settings.taxRate')}</label>
                  <input type="number" step="0.01" className="input-glass" value={setForm.invoice_tax_rate || 0} onChange={e => setSetForm({...setForm, invoice_tax_rate: parseFloat(e.target.value)})} disabled={!canEdit} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-sm text-white/60">{t('settings.footerNote')}</label>
                  <textarea className="textarea-glass min-h-[100px]" value={setForm.invoice_footer_note || ''} onChange={e => setSetForm({...setForm, invoice_footer_note: e.target.value})} disabled={!canEdit} />
                </div>
              </div>

              <h3 className="text-md font-semibold text-white mt-8 mb-4 border-b border-white/5 pb-2">{t('settings.payoutDetails')}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm text-white/60">{t('settings.bankName')}</label>
                  <input type="text" className="input-glass" value={setForm.payout_bank_name || ''} onChange={e => setSetForm({...setForm, payout_bank_name: e.target.value})} disabled={!canEdit} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-white/60">{t('settings.accountName')}</label>
                  <input type="text" className="input-glass" value={setForm.payout_account_name || ''} onChange={e => setSetForm({...setForm, payout_account_name: e.target.value})} disabled={!canEdit} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-white/60">{t('settings.accountNumber')}</label>
                  <input type="text" className="input-glass" value={setForm.payout_account_number || ''} onChange={e => setSetForm({...setForm, payout_account_number: e.target.value})} disabled={!canEdit} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-white/60">{t('settings.iban')}</label>
                  <input type="text" className="input-glass" value={setForm.payout_iban || ''} onChange={e => setSetForm({...setForm, payout_iban: e.target.value})} disabled={!canEdit} />
                </div>
              </div>

              {canEdit && (
                <div className="flex justify-end pt-4 border-t border-white/5">
                  <button type="submit" disabled={saving} className="btn-primary">
                    <Save className="w-4 h-4" /> {saving ? t('common.loading') : t('common.save')}
                  </button>
                </div>
              )}
            </form>
          )}

          {activeTab === 'team' && (
            <div className="space-y-6">
              {canEdit && (
                <form onSubmit={handleInvite} className="glass-card p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">{t('settings.inviteTeamMember')}</h3>
                  <div className="flex flex-col sm:flex-row gap-4 items-end">
                    <div className="space-y-1.5 flex-1">
                      <label className="text-sm text-white/60">{t('settings.inviteEmail')}</label>
                      <input type="email" required className="input-glass" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
                    </div>
                    <div className="space-y-1.5 w-full sm:w-48">
                      <label className="text-sm text-white/60">{t('settings.inviteRole')}</label>
                      <select className="select-glass" value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
                        <option value="admin">{t('settings.roles.admin')}</option>
                        <option value="accountant">{t('settings.roles.accountant')}</option>
                        <option value="staff">{t('settings.roles.staff')}</option>
                        <option value="viewer">{t('settings.roles.viewer')}</option>
                      </select>
                    </div>
                    <button type="submit" disabled={saving} className="btn-primary w-full sm:w-auto h-10">
                      <UserPlus className="w-4 h-4" /> {t('settings.sendInvite')}
                    </button>
                  </div>
                </form>
              )}

              <div className="glass-card">
                <div className="p-5 border-b border-white/5">
                  <h3 className="font-semibold text-white">{t('settings.team')}</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="data-table w-full">
                    <thead>
                      <tr>
                        <th>{t('common.name')}</th>
                        <th>{t('common.email')}</th>
                        <th>{t('settings.inviteRole')}</th>
                        <th>{t('common.status')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {team.map((member: any) => (
                        <tr key={member.id}>
                          <td>
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-medium text-white/80">
                                {member.profile?.full_name?.charAt(0).toUpperCase() || member.email.charAt(0).toUpperCase()}
                              </div>
                              <span className="font-medium text-white">{member.profile?.full_name || '—'}</span>
                            </div>
                          </td>
                          <td className="text-white/70">{member.email}</td>
                          <td>
                            <span className="text-xs px-2 py-1 bg-white/5 rounded-full text-white/70">
                              {t(`settings.roles.${member.role}`)}
                            </span>
                          </td>
                          <td>
                            <span className={cn(
                              "text-xs px-2 py-1 rounded-full",
                              member.status === 'active' ? "bg-emerald-500/10 text-emerald-400" : "bg-yellow-500/10 text-yellow-400"
                            )}>
                              {member.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
