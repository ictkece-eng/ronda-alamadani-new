'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ClipboardList,
  LayoutDashboard,
  PenSquare,
  ShieldCheck,
  Users,
} from 'lucide-react';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';

const navItems = [
  {
    href: '/dashboard',
    icon: LayoutDashboard,
    label: 'Dashboard',
  },
  {
    href: '/admin',
    icon: ShieldCheck,
    label: 'Admin Panel',
  },
  {
    href: '/coordinator',
    icon: ClipboardList,
    label: 'Coordinator Tools',
  },
  {
    href: '/schedule/request',
    icon: PenSquare,
    label: 'Request Schedule',
  },
];

export function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMobile = useIsMobile();
  
  // The sidebar is always collapsible on mobile (offcanvas)
  // and collapsible to icon on desktop.
  const collapsible = isMobile ? "offcanvas" : "icon";

  return (
    <SidebarProvider>
      <Sidebar collapsible={collapsible} variant="sidebar" side="left">
        <SidebarHeader className="h-16 flex items-center justify-between p-4">
          <div className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
            <Button variant="ghost" size="icon" className="shrink-0">
              <Users className="text-primary" />
            </Button>
            <h1 className="text-lg font-semibold text-primary">Ronda Planner</h1>
          </div>
          <SidebarTrigger />
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === item.href}
                  tooltip={{
                    children: item.label,
                    side: 'right',
                  }}
                >
                  <Link href={item.href}>
                    <item.icon />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
