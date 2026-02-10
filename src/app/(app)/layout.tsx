'use client';

import * as React from 'react';
import { TopNavbar } from './top-navbar';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {

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
