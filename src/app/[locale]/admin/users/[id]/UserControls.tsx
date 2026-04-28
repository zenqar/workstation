'use client';

import { useState } from 'react';
import { Key, ShieldCheck, Trash2, AlertCircle } from 'lucide-react';
import { toggleAdminStatus, deleteUserAccount } from '../actions';
import { cn } from '@/lib/utils';

interface UserControlsProps {
  userId: string;
  email: string;
  isAdmin: boolean;
  locale: string;
}

export default function UserControls({ userId, email, isAdmin, locale }: UserControlsProps) {
  const [deleteStep, setDeleteStep] = useState(0);
  const [loading, setLoading] = useState<string | null>(null);

  const handleToggleAdmin = async () => {
    setLoading('admin');
    await toggleAdminStatus(userId, isAdmin);
    setLoading(null);
  };

  const handleDelete = async () => {
    setLoading('delete');
    await deleteUserAccount(userId);
    // Redirect happens in action
  };

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-black text-white/40 uppercase tracking-widest mb-2 px-1">Platform Controls</h2>
      
      {/* Reset Password */}
      <form action={async () => {
        const { createClient } = await import('@/lib/supabase/client');
        const supabase = createClient();
        await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/${locale}/auth/callback?next=/${locale}/reset-password`,
        });
        alert('Password reset link sent to ' + email);
      }}>
        <button type="submit" className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all text-xs font-bold text-white group">
          Send Reset Link <Key className="w-4 h-4 text-white/20 group-hover:text-zenqar-400" />
        </button>
      </form>

      {/* Toggle Admin */}
      <button 
        onClick={handleToggleAdmin}
        disabled={!!loading}
        className={cn(
          "w-full flex items-center justify-between p-3 rounded-xl border transition-all text-xs font-bold group",
          isAdmin 
            ? "bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20" 
            : "bg-white/5 border-white/5 text-white hover:bg-white/10"
        )}
      >
        <div className="flex flex-col items-start">
          <span>{isAdmin ? 'Revoke Admin' : 'Grant Admin'}</span>
          <span className="text-[9px] opacity-50 font-medium">{isAdmin ? 'Currently Platform Admin' : 'Regular User'}</span>
        </div>
        <ShieldCheck className={cn("w-4 h-4", isAdmin ? "text-blue-400" : "text-white/20 group-hover:text-blue-400")} />
      </button>

      {/* Terminate Access (2-step) */}
      <div className="pt-4 mt-4 border-t border-white/5">
        {deleteStep === 0 ? (
          <button 
            onClick={() => setDeleteStep(1)}
            className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl border border-red-500/20 transition-all"
          >
            Terminate Access
          </button>
        ) : (
          <div className="space-y-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl animate-in zoom-in-95">
            <div className="flex items-center gap-2 text-red-400 mb-1">
              <AlertCircle className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase">Confirm Destruction</span>
            </div>
            <p className="text-[10px] text-red-200/70 leading-tight mb-3">
              This will permanently delete the user and all their personal data.
            </p>
            <div className="flex gap-2">
              <button 
                onClick={() => setDeleteStep(0)}
                className="flex-1 py-2 text-[10px] font-bold text-white/50 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleDelete}
                disabled={loading === 'delete'}
                className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white text-[10px] font-black uppercase tracking-widest rounded shadow-lg shadow-red-500/20"
              >
                {loading === 'delete' ? '...' : 'DESTROY'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
