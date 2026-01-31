'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GenerateScheduleForm } from './generate-schedule-form';
import { UserManagement } from './user-management';
import { Activity, Users, FileText, GitPullRequest, Download } from 'lucide-react';
import { ScheduleRequests } from './schedule-requests';
import { ReplacementManagement } from './replacement-management';
import { ExportSchedule } from './export-schedule';

export function AdminTabs() {
    return (
        <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-5 h-auto">
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
            <TabsTrigger value="export">
                <Download className="w-4 h-4 mr-2" />
                Export Schedule
            </TabsTrigger>
        </TabsList>
        
        <TabsContent value="generate-schedule" className="mt-6">
          <Card>
            <CardHeader>
                <CardTitle>Automated Schedule Generation</CardTitle>
                <CardDescription>Generate a one-month ronda schedule automatically using AI, then save it to the database.</CardDescription>
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
           <ScheduleRequests />
        </TabsContent>

        <TabsContent value="replacements" className="mt-6">
           <ReplacementManagement />
        </TabsContent>

        <TabsContent value="export" className="mt-6">
           <Card>
                <CardHeader>
                    <CardTitle>Export Schedule</CardTitle>
                    <CardDescription>Export the monthly ronda schedule to PDF or PNG format.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ExportSchedule />
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    );
}
