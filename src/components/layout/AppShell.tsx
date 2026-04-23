'use client';

import { ReactNode } from 'react';
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
      <div className="flex h-screen overflow-hidden bg-dark-bg text-foreground">
        {/* Desktop Sidebar */}
        <div className="hidden md:block w-64 flex-shrink-0 border-r border-border bg-dark-surface/50 backdrop-blur-md">
          <Sidebar profile={profile} />
        </div>

        <div className="flex flex-col flex-1 overflow-hidden relative">
          <TopBar user={user} profile={profile} />
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
            <div className="max-w-6xl mx-auto w-full h-full">
              {children}
            </div>
          </main>
        </div>
      </div>
    </BusinessProvider>
  );
}
