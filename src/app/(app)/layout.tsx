'use client';

import * as React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useUser } from '@/firebase';
import { TopNavbar } from './top-navbar';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const pathname = usePathname();

  // Redirect non-admins away from admin page
  React.useEffect(() => {
    if (!isUserLoading && user && pathname.startsWith('/admin')) {
      if (user.email !== 'tirtopbas@gmail.com') {
        router.replace('/dashboard');
      }
    }
  }, [user, isUserLoading, pathname, router]);

  return (
    <div>
        <TopNavbar />
        <main className="pt-16">
            {children}
        </main>
    </div>
  );
}
