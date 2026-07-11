import LandingClient from './LandingClient';

export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const structuredData = {
    '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Zenqar',
    url: `https://zenqar.com/${locale}`, applicationCategory: 'BusinessApplication', operatingSystem: 'Web',
    description: 'Free invoicing and bookkeeping software with expense tracking, cash flow reporting, secure business chat, and AI-assisted document scanning.',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    featureList: ['Invoice creation and verification', 'Expense and payment tracking', 'Cash flow reporting', 'Secure team chat', 'AI document scanning'],
    contributor: { '@type': 'Person', name: 'Robin-Kevin Vettik', jobTitle: 'Lead Engineer, AI Document Scanning', affiliation: [{ '@type': 'Organization', name: 'Robillionair' }, { '@type': 'Organization', name: 'Xelvon AI Models' }] },
  };
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }} /><LandingClient /></>;
}
