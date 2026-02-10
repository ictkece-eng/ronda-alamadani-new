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
  
  // This effect handles redirection.
  // It triggers whenever the loading states or the final admin document changes.
  React.useEffect(() => {
    const isFinishedChecking = !isUserLoading && !isAdminRoleLoading;
    // If all checks are done and we find out the user is not logged in or not an admin...
    if (isFinishedChecking && (!user || !adminRoleDoc)) {
      // ...redirect them away.
      router.replace('/dashboard');
    }
  }, [user, adminRoleDoc, isUserLoading, isAdminRoleLoading, router]);

  // Determine if we are still in a loading/verifying state.
  const isVerifying = isUserLoading || isAdminRoleLoading;

  // The parent layout (app/layout.tsx) already provides the navbar and main tag.
  // This loader will appear inside the parent's <main> tag.
  // We calculate the height to fill the space below the 4rem (h-16) navbar.
  if (isVerifying || !adminRoleDoc) {
    return (
      <div className="flex h-[calc(100vh-4rem)] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If we're past the loading checks AND we have an admin document, it's safe to render the admin content.
  // The parent layout will handle the navbar and main container.
  return <>{children}</>;
}
