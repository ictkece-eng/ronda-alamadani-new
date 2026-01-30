'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ClipboardList,
  LayoutDashboard,
  PenSquare,
  ShieldCheck,
  Shield,
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

function DesktopSidebar() {
    const pathname = usePathname();
    return (
        <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
            <div className="flex flex-col flex-grow border-r border-border bg-card overflow-y-auto">
                <div className="flex items-center h-16 px-4 shrink-0">
                    <Shield className="h-8 w-8 text-primary" />
                    <span className="text-lg font-semibold ml-2 text-primary">Ronda Planner</span>
                </div>
                <nav className="flex-1 flex flex-col px-2 pb-4">
                    {navItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                            'flex items-center px-4 py-2 mt-2 text-sm font-medium rounded-md',
                            pathname.startsWith(item.href)
                                ? 'bg-accent text-accent-foreground'
                                : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground/80'
                            )}
                        >
                            <item.icon className="h-5 w-5 mr-3" />
                            {item.label}
                        </Link>
                    ))}
                </nav>
            </div>
        </div>
    );
}

function BottomNavbar() {
    const pathname = usePathname();
    return (
        <nav className="fixed bottom-0 left-0 right-0 z-20 border-t bg-card shadow-t-lg md:hidden">
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
        <DesktopSidebar />
        <main className="md:pl-64 pb-16 md:pb-0">
            {children}
        </main>
        <BottomNavbar />
    </div>
  );
}
