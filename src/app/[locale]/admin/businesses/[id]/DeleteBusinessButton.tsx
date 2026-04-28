'use client';

import { useState } from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';
import { deleteBusinessNetwork } from './actions';

export default function DeleteBusinessButton({ businessId, businessName }: { businessId: string, businessName: string }) {
  const [step, setStep] = useState(0); // 0 = idle, 1 = confirm, 2 = deleting

  const handleDelete = async () => {
    setStep(2);
    await deleteBusinessNetwork(businessId);
    // The action will redirect, so no need to change state here unless it errors
  };

  if (step === 0) {
    return (
      <button 
        onClick={() => setStep(1)} 
        className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-sm font-semibold transition-colors"
      >
        <Trash2 className="w-4 h-4" />
        Delete Network
      </button>
    );
  }

  if (step === 1) {
    return (
      <div className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg animate-in fade-in zoom-in-95">
        <AlertTriangle className="w-5 h-5 text-red-400" />
        <span className="text-sm text-red-200 font-medium">Are you absolutely sure? This cannot be undone.</span>
        <button onClick={() => setStep(0)} className="px-3 py-1.5 text-xs text-white/50 hover:text-white transition-colors">Cancel</button>
        <button onClick={handleDelete} className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded shadow-lg shadow-red-500/20">CONFIRM DELETE</button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-300 border border-red-500/30 rounded-lg text-sm font-semibold">
      <span className="w-4 h-4 rounded-full border-2 border-red-400 border-t-transparent animate-spin"></span>
      Deleting...
    </div>
  );
}
