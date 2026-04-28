'use client';

import { useState } from 'react';
import { ThumbsUp, Wallet, CheckCircle2 } from 'lucide-react';
import { acceptInvoicePublic, claimPaymentPublic } from '@/lib/actions/invoices';
import { useRouter } from 'next/navigation';

export default function VerifyActions({ token, status, locale }: { token: string, status: string, locale: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleAccept = async () => {
    if (!confirm('Are you sure you want to accept this invoice?')) return;
    setLoading(true);
    const res = await acceptInvoicePublic(token);
    if (res?.error) alert(res.error);
    setLoading(false);
    router.refresh();
  };

  const handleClaimPaid = async () => {
    if (!confirm('Are you sure you want to mark this invoice as paid?')) return;
    setLoading(true);
    const res = await claimPaymentPublic(token);
    if (res?.error) alert(res.error);
    setLoading(false);
    router.refresh();
  };

  if (status === 'paid' || status === 'cancelled') return null;

  return (
    <div className="flex flex-col sm:flex-row gap-4 mt-8 pt-8 border-t border-white/10">
      {status === 'sent' && (
        <button 
          onClick={handleAccept}
          disabled={loading}
          className="flex-1 py-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-zenqar-400 text-white font-bold transition-all flex items-center justify-center gap-2 group"
        >
          <ThumbsUp className="w-5 h-5 text-zenqar-400 group-hover:scale-110 transition-transform" />
          Accept Invoice
        </button>
      )}

      {(status === 'sent' || status === 'accepted') && (
        <button 
          onClick={handleClaimPaid}
          disabled={loading}
          className="flex-1 py-4 rounded-2xl bg-zenqar-500 hover:bg-zenqar-400 text-white font-extrabold shadow-lg shadow-zenqar-500/20 transition-all flex items-center justify-center gap-2 group"
        >
          <Wallet className="w-5 h-5 group-hover:rotate-12 transition-transform" />
          I've Paid This Invoice
        </button>
      )}

      {status === 'payment_claimed' && (
        <div className="flex-1 py-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center gap-2">
          <CheckCircle2 className="w-5 h-5" />
          Payment Claimed (Pending Confirmation)
        </div>
      )}
      
      {status === 'accepted' && (
        <div className="w-full text-center py-2 text-[10px] uppercase font-black text-emerald-400/60 tracking-widest">
           You accepted this invoice. Please proceed with payment.
        </div>
      )}
    </div>
  );
}
