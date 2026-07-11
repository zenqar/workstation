import { createAdminClient, debugAdminConfig } from '@/lib/supabase/admin';
import { Activity, Bot, Database, FileCheck2, MessageSquare, ShieldCheck, Users } from 'lucide-react';

export default async function AdminAuditPage() {
  const admin = await createAdminClient();
  const [config, usersResult, businesses, invoices, messages, pendingConnections, unreadSupport, auditLogs] = await Promise.all([
    debugAdminConfig(),
    admin.from('profiles').select('id', { count: 'exact', head: true }),
    admin.from('businesses').select('id', { count: 'exact', head: true }),
    admin.from('invoices').select('id', { count: 'exact', head: true }),
    admin.from('messages').select('id', { count: 'exact', head: true }),
    admin.from('contact_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    admin.from('support_messages').select('id', { count: 'exact', head: true }).eq('is_read', false),
    admin.from('audit_logs').select('id,action,entity_type,entity_id,business_id,created_at,details').order('created_at', { ascending: false }).limit(100),
  ]);

  const metrics = [
    { label: 'Registered users', value: usersResult.count || 0, icon: Users, tone: 'text-blue-400' },
    { label: 'Businesses', value: businesses.count || 0, icon: Database, tone: 'text-purple-400' },
    { label: 'Invoices', value: invoices.count || 0, icon: FileCheck2, tone: 'text-emerald-400' },
    { label: 'Private messages delivered', value: messages.count || 0, icon: MessageSquare, tone: 'text-zenqar-400' },
    { label: 'Pending connections', value: pendingConnections.count || 0, icon: Activity, tone: 'text-amber-400' },
    { label: 'Unread support requests', value: unreadSupport.count || 0, icon: Bot, tone: 'text-red-400' },
  ];

  return (
    <div className="space-y-8">
      <div><h1 className="flex items-center gap-3 text-2xl font-bold text-white"><ShieldCheck className="h-6 w-6 text-zenqar-400" /> Operations & audit</h1><p className="mt-1 text-sm text-white/45">Platform health, workload, and immutable business activity. Private B2B message content is not exposed here.</p></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{metrics.map(metric => <div className="glass-card p-5" key={metric.label}><div className="flex items-center justify-between"><p className="text-xs uppercase tracking-wide text-white/40">{metric.label}</p><metric.icon className={`h-5 w-5 ${metric.tone}`} /></div><p className="mt-4 text-3xl font-bold tabular-nums text-white">{metric.value.toLocaleString()}</p></div>)}</div>
      <div className="glass-card p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-white">Runtime configuration</h2><p className="mt-1 text-xs text-white/40">Presence checks only—secret values are never displayed.</p></div><div className="flex gap-2"><span className={`rounded-full px-3 py-1 text-xs ${config.hasUrl ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'}`}>Supabase URL</span><span className={`rounded-full px-3 py-1 text-xs ${config.hasServiceKey ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'}`}>Service role</span></div></div></div>
      <div className="glass-card overflow-hidden"><div className="border-b border-white/5 p-5"><h2 className="font-semibold text-white">Recent business audit events</h2><p className="mt-1 text-xs text-white/40">Latest 100 recorded changes across tenant businesses.</p></div>{auditLogs.data?.length ? <div className="divide-y divide-white/5">{auditLogs.data.map(log => <div key={log.id} className="grid gap-2 p-4 text-sm md:grid-cols-[180px_160px_1fr_auto]"><span className="font-medium text-white">{log.action.replaceAll('_', ' ')}</span><span className="text-white/45">{log.entity_type}</span><span className="truncate font-mono text-xs text-white/30">{log.entity_id || log.business_id || 'platform'}</span><time className="text-xs text-white/35">{new Date(log.created_at).toLocaleString()}</time></div>)}</div> : <p className="p-8 text-center text-sm text-white/35">No audit events have been recorded yet.</p>}</div>
    </div>
  );
}
