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

  // If it's an admin page, we want a fully custom layout without the top navbar.
  // The admin-specific layout file will handle the entire page structure.
  if (isAdminPage) {
    return <>{children}</>;
  }

  // For all other pages, render the standard layout with the TopNavbar
  return (
    <div>
        <TopNavbar />
        <main className="pt-16 bg-muted/40 min-h-screen">
            {children}
        </main>
    </div>
  );
}
