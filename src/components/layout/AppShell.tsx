'use client';

import { ReactNode, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Profile, UserRole, Business } from '@/lib/types';
import { BusinessProvider } from '@/lib/contexts/BusinessContext';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

interface AppShellProps {
  user: User;
  profile: Profile | null;
  businesses: { business: Business; role: UserRole }[];
  children: ReactNode;
}

export default function AppShell({ user, profile, businesses, children }: AppShellProps) {
  return (
    <BusinessProvider initialBusinesses={businesses}>
      <div className="flex h-screen overflow-hidden bg-dark-bg text-foreground selection:bg-zenqar-500/30">
        {/* Background Visuals */}
        <div className="ambient">
          <div className="ambient-orb orb-1" />
          <div className="ambient-orb orb-2" />
          <div className="ambient-orb orb-3" />
        </div>

        {/* Desktop Sidebar */}
        <div className="hidden md:block w-64 flex-shrink-0 border-r border-white/5 bg-transparent relative z-20">
          <Sidebar profile={profile} />
        </div>

        <div className="flex flex-col flex-1 overflow-hidden relative z-10">
          <TopBar user={user} profile={profile} />
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
            <div className="max-w-6xl mx-auto w-full h-full animate-in">
              {children}
            </div>
          </main>
        </div>
      </div>
    </BusinessProvider>
  );
}
