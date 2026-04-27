'use client';

import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { getIncomingContactRequests } from '@/lib/actions/connections';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useLocale } from 'next-intl';

export default function NotificationBell() {
  const [count, setCount] = useState(0);
  const locale = useLocale();

  useEffect(() => {
    const fetchCount = async () => {
      const requests = await getIncomingContactRequests();
      setCount(requests.length);
    };
    fetchCount();
    
    // Set up a polling interval for notifications
    const interval = setInterval(fetchCount, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  return (
    <Link href={`/${locale}/app/dashboard`} className="relative p-2 rounded-xl hover:bg-white/5 text-white/60 hover:text-white transition-all group">
      <Bell className="w-5 h-5 group-hover:scale-110 transition-transform" />
      {count > 0 && (
        <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-zenqar-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-dark-bg animate-pulse">
          {count}
        </span>
      )}
    </Link>
  );
}
