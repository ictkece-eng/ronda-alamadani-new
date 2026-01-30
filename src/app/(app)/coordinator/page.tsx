import { PageHeader } from '@/components/page-header';
import { CoordinatorView } from './coordinator-view';

export default function CoordinatorPage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8">
      <PageHeader
        title="Coordinator Tools"
        description="Approve/reject schedule requests and get AI-powered suggestions."
      />
      <CoordinatorView />
    </div>
  );
}
