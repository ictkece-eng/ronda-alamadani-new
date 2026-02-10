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

  // Create a memoized reference to the admin role document
  const adminRoleRef = useMemoFirebase(
    () => (user && firestore ? doc(firestore, 'roles_admin', user.uid) : null),
    [user, firestore]
  );

  // Use useDoc to check for the admin role
  const { data: adminRoleDoc, isLoading: isAdminRoleLoading } = useDoc(adminRoleRef);
  
  const isCheckingAuth = isUserLoading || (!!user && isAdminRoleLoading);
  const isAdmin = !!adminRoleDoc;

  React.useEffect(() => {
    if (isCheckingAuth) {
      return; // Wait until all loading is finished
    }
    if (!user || !isAdmin) {
      router.replace('/dashboard'); // Not logged in or not an admin
    }
  }, [user, isAdmin, isCheckingAuth, router]);

  // While loading or if user is not an admin, show a loading screen
  if (isCheckingAuth || !isAdmin) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-muted/40">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If user is admin, render the admin page content
  return <>{children}</>;
}
