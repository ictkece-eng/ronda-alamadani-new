import { PageHeader } from '@/components/page-header';
import { GenerateScheduleForm } from './generate-schedule-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserManagement } from './user-management';
import { Activity, Users, FileText, GitPullRequest } from 'lucide-react';

export default function AdminPage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <PageHeader
        title="Admin Panel"
        description="Manage schedules, users, and requests from here."
      />

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto">
          <TabsTrigger value="generate-schedule">
            <Activity className="w-4 h-4 mr-2" />
            Generate Schedule
          </TabsTrigger>
          <TabsTrigger value="users">
            <Users className="w-4 h-4 mr-2" />
            Users/Warga
            </TabsTrigger>
          <TabsTrigger value="requests">
            <FileText className="w-4 h-4 mr-2" />
            Schedule Requests
            </TabsTrigger>
          <TabsTrigger value="replacements">
            <GitPullRequest className="w-4 h-4 mr-2" />
            Replacements
            </TabsTrigger>
        </TabsList>
        
        <TabsContent value="generate-schedule" className="mt-6">
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

        <TabsContent value="users" className="mt-6">
            <UserManagement />
        </TabsContent>

        <TabsContent value="requests" className="mt-6">
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

        <TabsContent value="replacements" className="mt-6">
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
