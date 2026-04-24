'use client';

import { useState, useEffect } from 'react';
import { 
  X, ChevronRight, ChevronLeft, FileText, Users, Wallet, 
  Receipt, CreditCard, Settings, Lightbulb, CheckCircle2
} from 'lucide-react';

const STORAGE_KEY = 'zenqar_tour_dismissed';

const steps = [
  {
    icon: Lightbulb,
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20',
    title: 'Welcome to Zenqar! 🎉',
    description:
      'Your all-in-one bookkeeping platform for Iraqi & Kurdish businesses. Here\'s a quick tour to get you started. You can skip this anytime.',
    tips: [],
  },
  {
    icon: FileText,
    color: 'text-zenqar-400',
    bg: 'bg-zenqar-500/10',
    border: 'border-zenqar-500/20',
    title: 'Invoices',
    description: 'Create professional invoices in IQD or USD and send them to your clients.',
    tips: [
      'Click "New Invoice" to create your first invoice',
      'Invoices go through statuses: Draft → Issued → Paid',
      'Each issued invoice gets a unique verification QR code',
      'Mark invoices as paid once payment is received',
    ],
  },
  {
    icon: Users,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    title: 'Contacts',
    description: 'Manage your customers and suppliers in one place.',
    tips: [
      'Add customers to attach them to invoices',
      'Add suppliers to track expense vendors',
      'Contacts can be type: Customer, Supplier, or Both',
      'Search and filter your contact list easily',
    ],
  },
  {
    icon: Wallet,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
    title: 'Accounts',
    description: 'Track your cash, bank accounts, and wallets.',
    tips: [
      'Create a "Cash" account to track physical money',
      'Add bank accounts to track transfers and balances',
      'Transfer funds between accounts in one click',
      'Account balances update automatically with every transaction',
    ],
  },
  {
    icon: Receipt,
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    title: 'Expenses',
    description: 'Log business expenses and they\'ll automatically debit the right account.',
    tips: [
      'Select which account the expense comes from',
      'Assign a category for easy reporting',
      'Link expenses to a supplier contact',
      'Attach a receipt URL for record-keeping',
    ],
  },
  {
    icon: CreditCard,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    title: 'Payments',
    description: 'Record payments against invoices to keep your books balanced.',
    tips: [
      'Go to an invoice and click "Record Payment"',
      'Select which account received the payment',
      'Partial payments are supported (Partially Paid status)',
      'All payments appear in the Payments log',
    ],
  },
  {
    icon: Settings,
    color: 'text-white/60',
    bg: 'bg-white/5',
    border: 'border-white/10',
    title: 'Settings',
    description: 'Configure your business profile, invoice settings, and team members.',
    tips: [
      'Set your invoice prefix (e.g. ZQ-001)',
      'Configure tax rate and payment terms',
      'Invite team members with different roles',
      'Set your preferred language (English, Arabic, Kurdish)',
    ],
  },
];

export default function WelcomeTour() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    // Only show if not previously dismissed
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (!dismissed) {
      // Small delay so it doesn't flash immediately on load
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  }

  function next() {
    if (step < steps.length - 1) setStep(step + 1);
    else dismiss();
  }

  function prev() {
    if (step > 0) setStep(step - 1);
  }

  if (!visible) {
    return (
      <button
        onClick={() => { setStep(0); setVisible(true); }}
        className="fixed bottom-6 right-6 z-40 w-10 h-10 rounded-full bg-zenqar-600 hover:bg-zenqar-500 shadow-glow flex items-center justify-center text-white transition-all hover:scale-110"
        title="Show tips & tour"
      >
        <Lightbulb className="w-4 h-4" />
      </button>
    );
  }

  const current = steps[step];
  const Icon = current.icon;
  const isLast = step === steps.length - 1;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={dismiss}
        aria-hidden="true"
      />

      {/* Tour card */}
      <div className="fixed bottom-6 right-6 z-50 w-full max-w-sm animate-in">
        <div className="glass-card p-6 relative overflow-hidden shadow-2xl">
          <div className="mouse-light" />

          {/* Close button */}
          <button
            onClick={dismiss}
            className="absolute top-4 right-4 text-white/30 hover:text-white/80 transition-colors"
            aria-label="Close tour"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Step indicator dots */}
          <div className="flex gap-1.5 mb-5">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? 'bg-zenqar-400 w-4' : 'bg-white/20 w-1.5'
                }`}
                aria-label={`Go to step ${i + 1}`}
              />
            ))}
          </div>

          {/* Icon */}
          <div className={`w-10 h-10 rounded-xl ${current.bg} border ${current.border} flex items-center justify-center mb-4`}>
            <Icon className={`w-5 h-5 ${current.color}`} />
          </div>

          {/* Content */}
          <h3 className="text-base font-semibold text-white mb-2">{current.title}</h3>
          <p className="text-sm text-white/50 mb-4 leading-relaxed">{current.description}</p>

          {/* Tips list */}
          {current.tips.length > 0 && (
            <ul className="space-y-2 mb-5">
              {current.tips.map((tip) => (
                <li key={tip} className="flex items-start gap-2.5 text-xs text-white/60">
                  <CheckCircle2 className="w-3.5 h-3.5 text-zenqar-400 flex-shrink-0 mt-0.5" />
                  {tip}
                </li>
              ))}
            </ul>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={prev}
              disabled={step === 0}
              className="flex items-center gap-1 text-xs text-white/40 hover:text-white/80 disabled:opacity-0 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Previous
            </button>

            <div className="flex items-center gap-3">
              <button
                onClick={dismiss}
                className="text-xs text-white/30 hover:text-white/60 transition-colors"
              >
                Skip tour
              </button>
              <button
                onClick={next}
                className="flex items-center gap-1.5 text-xs font-medium text-zenqar-400 hover:text-zenqar-300 transition-colors"
              >
                {isLast ? 'Done' : 'Next'}
                {!isLast && <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
