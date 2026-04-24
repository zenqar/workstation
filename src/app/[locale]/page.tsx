import Link from 'next/link';
import { FileText, Shield, Globe, TrendingUp, ArrowRight, CheckCircle2, Search } from 'lucide-react';
import VerifySearch from './VerifySearch';

export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  return (
    <main className="min-h-screen flex flex-col">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-zenqar-gradient flex items-center justify-center">
            <span className="text-white font-bold text-sm">Z</span>
          </div>
          <span className="font-bold text-lg text-white tracking-tight">Zenqar</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/${locale}/login`} className="btn-secondary text-sm px-4 py-2">Sign In</Link>
          <Link href={`/${locale}/signup`} className="btn-primary text-sm px-4 py-2">Get Started</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-24">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-zenqar-500/30 bg-zenqar-500/10 text-zenqar-300 text-sm mb-8 animate-in">
          <CheckCircle2 className="w-4 h-4" />
          Built for Iraqi & Kurdish businesses
        </div>

        <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tight leading-tight max-w-4xl animate-in">
          Smart Invoicing &<br />
          <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #8293f8 0%, #6470f3 50%, #4f52e8 100%)' }}>
            Bookkeeping
          </span>
        </h1>

        <p className="mt-6 text-lg text-white/50 max-w-xl leading-relaxed animate-in">
          Manage invoices, track payments, and monitor your cash flow — in IQD and USD.
          Multilingual support with English, Arabic, and Kurdish.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 mt-10 animate-in">
          <Link href={`/${locale}/signup`} className="btn-primary px-8 py-3 text-base">
            Start Free
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href={`/${locale}/login`} className="btn-secondary px-8 py-3 text-base">
            Sign In
          </Link>
        </div>
      </section>

      {/* Verify Invoice Section */}
      <section className="py-12 px-6 max-w-3xl mx-auto w-full text-center relative z-10">
        <div className="glass-card-elevated p-8 border-zenqar-500/20 bg-zenqar-900/10 backdrop-blur-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-zenqar-500/10 rounded-full blur-[80px] -mr-32 -mt-32 pointer-events-none"></div>
          
          <div className="w-12 h-12 rounded-2xl bg-zenqar-500/20 flex items-center justify-center mx-auto mb-4 border border-zenqar-500/30">
            <Search className="w-6 h-6 text-zenqar-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Verify an Invoice</h2>
          <p className="text-white/60 text-sm mb-6 max-w-md mx-auto">
            Received an invoice from a Zenqar merchant? Enter the unique verification code below to instantly confirm its validity and see secure payment details.
          </p>
          
          <VerifySearch locale={locale} />
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 max-w-6xl mx-auto w-full">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: FileText, title: 'Smart Invoicing', desc: 'Create, issue, and verify invoices with QR codes' },
            { icon: TrendingUp, title: 'Cash Flow Tracking', desc: 'Track IQD & USD balances across all accounts' },
            { icon: Shield, title: 'QR Verification', desc: 'Customers can verify invoices instantly by scanning' },
            { icon: Globe, title: 'Multilingual', desc: 'Full support for English, Arabic, and Kurdish (RTL)' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="glass-card p-6 flex flex-col gap-3">
              <div className="w-10 h-10 rounded-xl bg-zenqar-600/20 border border-zenqar-500/20 flex items-center justify-center">
                <Icon className="w-5 h-5 text-zenqar-400" />
              </div>
              <h3 className="font-semibold text-white">{title}</h3>
              <p className="text-sm text-white/50 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 text-center text-white/30 text-sm border-t border-white/6">
        © 2026 Zenqar. Built for the future of Iraqi business.
      </footer>
    </main>
  );
}
