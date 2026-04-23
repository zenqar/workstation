'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { Business, UserRole, BusinessMembership } from '@/lib/types';
import { useRouter, usePathname } from 'next/navigation';

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
  const [businesses, setBusinesses] = useState<UserBusiness[]>(initialBusinesses);
  
  // Try to get from localStorage, fallback to first active business
  const getInitialActiveId = () => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('zenqar_active_business');
      if (stored && initialBusinesses.some(b => b.business.id === stored)) {
        return stored;
      }
    }
    return initialBusinesses.length > 0 ? initialBusinesses[0].business.id : null;
  };

  const [activeBusinessId, setActiveBusinessIdState] = useState<string | null>(getInitialActiveId);

  const activeUserBusiness = businesses.find(b => b.business.id === activeBusinessId);
  const activeBusiness = activeUserBusiness?.business ?? null;
  const activeRole = activeUserBusiness?.role ?? null;

  useEffect(() => {
    if (activeBusinessId) {
      localStorage.setItem('zenqar_active_business', activeBusinessId);
    }
  }, [activeBusinessId]);

  const setActiveBusinessId = (id: string) => {
    setActiveBusinessIdState(id);
    // When switching businesses, we might want to refresh the page or data
    // For now, we just update the state. The layout/pages should react to the context change.
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
