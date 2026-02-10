'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { TopNavbar } from './top-navbar';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAdminPage = pathname.startsWith('/admin');

  // If we are on an admin page, render the children directly without the TopNavbar
  // The admin layout will handle its own UI, creating a distinct experience.
  if (isAdminPage) {
    return <>{children}</>;
  }

  // For all other pages, render the standard layout with the TopNavbar
  return (
    <div>
        <TopNavbar />
        <main className="pt-16">
            {children}
        </main>
    </div>
  );
}
