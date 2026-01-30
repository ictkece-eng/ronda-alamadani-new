import { PageHeader } from '@/components/page-header';
import { GenerateScheduleForm } from './generate-schedule-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminPage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8">
      <PageHeader
        title="Admin Panel"
        description="Manage users and generate ronda schedules."
      />

      <Card>
        <CardHeader>
            <CardTitle>Automated Schedule Generation</CardTitle>
            <CardDescription>Generate a one-month ronda schedule automatically using AI.</CardDescription>
        </CardHeader>
        <CardContent>
            <GenerateScheduleForm />
        </CardContent>
      </Card>
    </div>
  );
}
