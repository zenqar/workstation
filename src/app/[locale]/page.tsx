import LandingClient from './LandingClient';

export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  // Locale is handled by the URL and next-intl middleware
  return <LandingClient />;
}
