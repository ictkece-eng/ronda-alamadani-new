import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RequestForm } from './request-form';

export default function RequestSchedulePage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8">
      <PageHeader
        title="Request Schedule Change"
        description="Submit a request to change your ronda schedule. Requires coordinator approval."
      />
      <div className="max-w-2xl mx-auto">
        <Card>
            <CardHeader>
                <CardTitle>Request Form</CardTitle>
                <CardDescription>Fill out the details below to submit your request.</CardDescription>
            </CardHeader>
            <CardContent>
                <RequestForm />
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
