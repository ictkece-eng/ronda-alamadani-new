'use client';

import { PageHeader } from '@/components/page-header';
import { AdminTabs } from './admin-tabs';


export default function AdminPage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <PageHeader
        title="Admin Panel"
        description="Manage schedules, users, and requests from here."
      />
      <AdminTabs />
    </div>
  );
}
