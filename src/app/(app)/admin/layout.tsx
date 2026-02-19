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

  // The specific email for the admin user
  const ADMIN_EMAIL = 'tirtopbas@gmail.com';

  const isVerifying = isUserLoading;

  // Determine if the user is the designated admin
  const isAuthorized = !isVerifying && user?.email === ADMIN_EMAIL;

  React.useEffect(() => {
    // Wait until the initial user loading is complete
    if (isVerifying) {
      return; 
    }

    // If, after loading, the user is not the authorized admin, redirect them.
    if (!isAuthorized) {
      router.replace('/dashboard');
    }
  }, [isAuthorized, isVerifying, router]);

  // While verifying, or if the user is not authorized, show a loader.
  // The useEffect above will handle the redirection, preventing a flash of content.
  if (!isAuthorized) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Only when verification is complete and the user is confirmed as an admin, render the admin dashboard.
  return <>{children}</>;
}
