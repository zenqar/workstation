import { PRIVATE_ROUTE_METADATA } from '@/lib/seo/private';

export const metadata = PRIVATE_ROUTE_METADATA;

export default function VerifyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
