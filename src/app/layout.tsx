import type {Metadata} from 'next';
import 'bootstrap/dist/css/bootstrap.min.css';
import './globals.css';
import './bootstrap-theme.css';
import { Toaster } from "@/components/ui/toaster"
import { BootstrapClient } from '@/components/bootstrap-client';
import { FirebaseClientProvider } from '@/firebase/client-provider';

export const metadata: Metadata = {
  title: 'Ronda Planner',
  description: 'Ronda Planner dengan tampilan Bootstrap modern dan integrasi database yang siap dikembangkan.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased bg-body-tertiary">
        <BootstrapClient />
        <FirebaseClientProvider>
          {children}
        </FirebaseClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
