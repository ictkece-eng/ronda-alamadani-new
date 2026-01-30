'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ClipboardList,
  LayoutDashboard,
  PenSquare,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  {
    href: '/dashboard',
    icon: LayoutDashboard,
    label: 'Dashboard',
  },
  {
    href: '/admin',
    icon: ShieldCheck,
    label: 'Admin',
  },
  {
    href: '/coordinator',
    icon: ClipboardList,
    label: 'Coordinator',
  },
  {
    href: '/schedule/request',
    icon: PenSquare,
    label: 'Request',
  },
];

function BottomNavbar() {
    const pathname = usePathname();
    return (
        <nav className="fixed bottom-0 left-0 right-0 z-20 border-t bg-card shadow-t-lg">
        <div className="flex h-16 items-center justify-around">
            {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
                <Link
                key={item.href}
                href={item.href}
                className={cn(
                    'flex flex-col items-center justify-center gap-1 text-xs w-full h-full',
                    isActive ? 'text-primary' : 'text-muted-foreground'
                )}
                >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
                </Link>
            );
            })}
        </div>
        </nav>
    );
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
        <main className="pb-16">
            {children}
        </main>
        <BottomNavbar />
    </div>
  );
}
