'use client';

import { useState } from 'react';
import { handleContactRequest } from '@/lib/actions/connections';
import { Check, X, UserPlus, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ContactRequests({ requests }: { requests: any[] }) {
  const [loading, setLoading] = useState<string | null>(null);
  const router = useRouter();

  if (!requests || requests.length === 0) return null;

  const onAction = async (id: string, action: 'accept' | 'reject') => {
    setLoading(id);
    const res = await handleContactRequest(id, action);
    if (res?.error) alert(res.error);
    else router.refresh();
    setLoading(null);
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
      {requests.map((req) => (
        <div key={req.id} className="glass-card p-4 border-zenqar-500/30 bg-zenqar-500/5 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-zenqar-500/20 border border-zenqar-500/30 flex items-center justify-center">
              <UserPlus className="w-6 h-6 text-zenqar-400" />
            </div>
            <div>
              <h4 className="font-bold text-white flex items-center gap-2">
                Connection Request
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-zenqar-500/20 text-zenqar-400 border border-zenqar-500/20 uppercase tracking-widest">Action Required</span>
              </h4>
              <p className="text-sm text-white/60">
                <span className="text-white font-semibold">{req.sender_business?.name}</span> wants to connect with your business for automated invoicing and payments.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button 
              onClick={() => onAction(req.id, 'reject')}
              disabled={!!loading}
              className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-sm font-medium text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all border border-white/5 hover:border-red-500/20"
            >
              <span className="flex items-center justify-center gap-2">
                <X className="w-4 h-4" /> Ignore
              </span>
            </button>
            <button 
              onClick={() => onAction(req.id, 'accept')}
              disabled={!!loading}
              className="flex-1 sm:flex-none px-6 py-2 rounded-xl text-sm font-bold text-white bg-zenqar-600 hover:bg-zenqar-500 transition-all shadow-glow-sm flex items-center justify-center gap-2"
            >
              {loading === req.id ? (
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" /> Accept & Connect
                </>
              )}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
