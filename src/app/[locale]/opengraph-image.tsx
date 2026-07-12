import { ImageResponse } from 'next/og';

export const alt = 'Zenqar free invoicing and bookkeeping workspace';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpenGraphImage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', overflow: 'hidden', padding: '72px 78px', flexDirection: 'column', justifyContent: 'space-between', color: '#f8f7ff', background: 'linear-gradient(135deg, #080914 0%, #171027 55%, #0c1020 100%)', fontFamily: 'sans-serif' }}>
      <div style={{ position: 'absolute', width: 520, height: 520, borderRadius: 999, top: -260, right: -90, background: 'radial-gradient(circle, rgba(151,91,255,.52), rgba(151,91,255,0) 68%)' }} />
      <div style={{ position: 'absolute', width: 480, height: 480, borderRadius: 999, bottom: -300, left: 130, background: 'radial-gradient(circle, rgba(255,81,204,.35), rgba(255,81,204,0) 68%)' }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ display: 'flex', width: 56, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 17, background: 'linear-gradient(145deg, #7968ff, #d85bd5)', fontSize: 29, fontWeight: 800 }}>Z</div>
          <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: 4 }}>ZENQAR</div>
        </div>
        <div style={{ display: 'flex', padding: '9px 15px', borderRadius: 999, border: '1px solid rgba(255,255,255,.18)', background: 'rgba(255,255,255,.07)', fontSize: 16, fontWeight: 700 }}>{locale.toUpperCase()}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22, position: 'relative', maxWidth: 920 }}>
        <div style={{ fontSize: 72, lineHeight: 1.04, fontWeight: 850, letterSpacing: -3 }}>Free invoicing and bookkeeping, built for modern business.</div>
        <div style={{ display: 'flex', fontSize: 25, lineHeight: 1.4, color: '#c9c5dc' }}>Invoices, cash flow, AI document scanning, private voice messages, and one-to-one calls in one focused workspace.</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', fontSize: 20, color: '#b9b5ca' }}>
        <div style={{ display: 'flex', gap: 12 }}>
          {['Free plan', 'AI scanning', 'Private voice'].map(item => <div key={item} style={{ display: 'flex', padding: '9px 14px', borderRadius: 999, background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.11)' }}>{item}</div>)}
        </div>
        <div style={{ fontWeight: 700, color: '#ffffff' }}>zenqar.com</div>
      </div>
    </div>,
    size,
  );
}
