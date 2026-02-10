'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GenerateScheduleForm } from './generate-schedule-form';
import { UserManagement } from './user-management';
import { Activity, Users, FileText, GitPullRequest, Download, History } from 'lucide-react';
import { ScheduleRequests } from './schedule-requests';
import { ReplacementManagement } from './replacement-management';
import { ExportSchedule } from './export-schedule';
import { ScheduleHistory } from './schedule-history';

export function AdminTabs() {
    return (
        <Tabs defaultValue="users" className="grid grid-cols-1 md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr] gap-6">
            <TabsList className="flex flex-col h-auto items-stretch justify-start p-0 space-y-1 bg-transparent md:border-r">
                <TabsTrigger value="generate-schedule" className="justify-start p-3 font-normal rounded-lg data-[state=active]:bg-muted data-[state=active]:font-semibold data-[state=active]:text-primary">
                    <Activity className="w-4 h-4 mr-3" />
                    Generate Schedule
                </TabsTrigger>
                <TabsTrigger value="users" className="justify-start p-3 font-normal rounded-lg data-[state=active]:bg-muted data-[state=active]:font-semibold data-[state=active]:text-primary">
                    <Users className="w-4 h-4 mr-3" />
                    Users/Warga
                </TabsTrigger>
                <TabsTrigger value="requests" className="justify-start p-3 font-normal rounded-lg data-[state=active]:bg-muted data-[state=active]:font-semibold data-[state=active]:text-primary">
                    <FileText className="w-4 h-4 mr-3" />
                    Schedule Requests
                </TabsTrigger>
                <TabsTrigger value="replacements" className="justify-start p-3 font-normal rounded-lg data-[state=active]:bg-muted data-[state=active]:font-semibold data-[state=active]:text-primary">
                    <GitPullRequest className="w-4 h-4 mr-3" />
                    Replacements
                </TabsTrigger>
                <TabsTrigger value="export" className="justify-start p-3 font-normal rounded-lg data-[state=active]:bg-muted data-[state=active]:font-semibold data-[state=active]:text-primary">
                    <Download className="w-4 h-4 mr-3" />
                    Export Schedule
                </TabsTrigger>
                <TabsTrigger value="history" className="justify-start p-3 font-normal rounded-lg data-[state=active]:bg-muted data-[state=active]:font-semibold data-[state=active]:text-primary">
                    <History className="w-4 h-4 mr-3" />
                    Schedule History
                </TabsTrigger>
            </TabsList>
            
            <div>
                <TabsContent value="generate-schedule" className="mt-0">
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

                <TabsContent value="users" className="mt-0">
                    <UserManagement />
                </TabsContent>

                <TabsContent value="requests" className="mt-0">
                   <ScheduleRequests />
                </TabsContent>

                <TabsContent value="replacements" className="mt-0">
                   <ReplacementManagement />
                </TabsContent>

                <TabsContent value="export" className="mt-0">
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

                <TabsContent value="history" className="mt-0">
                    <ScheduleHistory />
                </TabsContent>
            </div>
      </Tabs>
    );
}
