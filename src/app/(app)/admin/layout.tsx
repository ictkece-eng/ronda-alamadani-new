'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const firestore = useFirestore();

  const adminRoleRef = useMemoFirebase(
    () => (user && firestore ? doc(firestore, 'roles_admin', user.uid) : null),
    [user, firestore]
  );

  const { data: adminRoleDoc, isLoading: isAdminRoleLoading } = useDoc(adminRoleRef);
  
  const isVerifying = isUserLoading || isAdminRoleLoading;

  React.useEffect(() => {
    // Wait until the loading process is complete before making a decision.
    if (isVerifying) {
      return; 
    }

    // After loading, if the user is not logged in or doesn't have the admin role doc, redirect them.
    if (!user || !adminRoleDoc) {
      router.replace('/dashboard');
    }
  }, [user, adminRoleDoc, isVerifying, router]);

  // While verifying, or if the checks determine the user is not an admin, show a full-screen loader.
  // The useEffect will handle the eventual redirection.
  if (isVerifying || !adminRoleDoc) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Only when verification is complete and the user is confirmed as an admin, render the admin dashboard.
  return <>{children}</>;
}
