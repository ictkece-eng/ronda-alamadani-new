'use client';

import * as React from 'react';
import { TopNavbar } from './top-navbar';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {

  return (
    <div>
        <TopNavbar />
        <main className="pt-16">
            {children}
        </main>
    </div>
  );
}
