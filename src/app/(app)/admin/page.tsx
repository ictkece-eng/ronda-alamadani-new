import { PageHeader } from '@/components/page-header';
import { GenerateScheduleForm } from './generate-schedule-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AdminPage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8">
      <PageHeader
        title="Admin Panel"
        description="Manage schedules, users, and requests from here."
      />

      <Tabs defaultValue="generate-schedule" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto">
          <TabsTrigger value="generate-schedule">Generate Schedule</TabsTrigger>
          <TabsTrigger value="users">Users/Warga</TabsTrigger>
          <TabsTrigger value="requests">Schedule Requests</TabsTrigger>
          <TabsTrigger value="replacements">Replacements</TabsTrigger>
        </TabsList>
        
        <TabsContent value="generate-schedule" className="mt-4">
          <Card>
            <CardHeader>
                <CardTitle>Automated Schedule Generation</CardTitle>
                <CardDescription>Generate a one-month ronda schedule automatically using AI.</CardDescription>
            </CardHeader>
            <CardContent>
                <GenerateScheduleForm />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Manage Users / Warga</CardTitle>
              <CardDescription>View, add, edit, or remove users from the system.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">User management interface will be available here soon.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests" className="mt-4">
           <Card>
            <CardHeader>
              <CardTitle>Manage Schedule Requests</CardTitle>
              <CardDescription>Approve or reject ronda schedule change requests.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Schedule request management interface will be available here soon.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="replacements" className="mt-4">
           <Card>
            <CardHeader>
              <CardTitle>Manage Replacements</CardTitle>
              <CardDescription>Manage user replacements for ronda duties.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Replacement management interface will be available here soon.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
