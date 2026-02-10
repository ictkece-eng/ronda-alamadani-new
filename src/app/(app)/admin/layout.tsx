'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase';
import { Loader2 } from 'lucide-react';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isUserLoading } = useUser();
  const router = useRouter();

  React.useEffect(() => {
    if (isUserLoading) {
      return; // Wait until user status is determined
    }
    if (!user) {
      router.replace('/dashboard'); // Not logged in
    } else if (user.email !== 'tirtopbas@gmail.com') {
      router.replace('/dashboard'); // Not an admin
    }
  }, [user, isUserLoading, router]);

  // While loading or if user is not the authorized admin, show a loading screen
  if (isUserLoading || !user || user.email !== 'tirtopbas@gmail.com') {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-muted/40">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If user is admin, render the admin page content
  return <>{children}</>;
}
