'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import type { Business, UserRole } from '@/lib/types';
import { useRouter } from 'next/navigation';

interface UserBusiness {
  business: Business;
  role: UserRole;
}

interface BusinessContextType {
  activeBusiness: Business | null;
  activeRole: UserRole | null;
  businesses: UserBusiness[];
  setActiveBusinessId: (id: string) => void;
}

const BusinessContext = createContext<BusinessContextType | undefined>(undefined);

export function BusinessProvider({
  children,
  initialBusinesses,
}: {
  children: ReactNode;
  initialBusinesses: UserBusiness[];
}) {
  const router = useRouter();
  const businesses = initialBusinesses;
  const [activeBusinessId, setActiveBusinessIdState] = useState<string | null>(
    initialBusinesses[0]?.business.id ?? null
  );

  const activeUserBusiness = businesses.find(b => b.business.id === activeBusinessId);
  const activeBusiness = activeUserBusiness?.business ?? null;
  const activeRole = activeUserBusiness?.role ?? null;

  const setActiveBusinessId = (id: string) => {
    if (!businesses.some(item => item.business.id === id) || id === activeBusinessId) return;
    setActiveBusinessIdState(id);
    document.cookie = `zenqar_active_business=${encodeURIComponent(id)}; Path=/; Max-Age=31536000; SameSite=Lax`;
    router.refresh();
  };

  return (
    <BusinessContext.Provider value={{ activeBusiness, activeRole, businesses, setActiveBusinessId }}>
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusiness() {
  const context = useContext(BusinessContext);
  if (context === undefined) {
    throw new Error('useBusiness must be used within a BusinessProvider');
  }
  return context;
}
