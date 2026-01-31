'use client';

import { useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, ThumbsDown, ThumbsUp, Wand2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { ScheduleRequest, Warga } from '@/lib/types';
import { handleGetCoordinatorSuggestion } from '@/lib/actions';
import { useCollection, useFirestore, useMemoFirebase, setDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, collectionGroup, doc, query } from 'firebase/firestore';
import { format } from 'date-fns';

type ScheduleRequestWithUser = ScheduleRequest & { userName?: string };

export function CoordinatorView() {
  const [selectedRequest, setSelectedRequest] = useState<ScheduleRequestWithUser | null>(null);
  const [suggestion, setSuggestion] = useState<string>('');
  const [isLoadingSuggestion, setIsLoadingSuggestion] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();

  const requestsQuery = useMemoFirebase(
    () => (firestore ? query(collectionGroup(firestore, 'scheduleRequests')) : null),
    [firestore]
  );
  const { data: requests, isLoading: isRequestsLoading } = useCollection<ScheduleRequest>(requestsQuery);

  const usersQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'users') : null),
    [firestore]
  );
  const { data: users, isLoading: isUsersLoading } = useCollection<Warga>(usersQuery);

  const usersMap = useMemo(() => {
    if (!users) return new Map<string, string>();
    return new Map(users.map(user => [user.id, user.name]));
  }, [users]);

  const processedRequests = useMemo(() => {
    if (!requests) return [];
    return requests.map(req => ({
      ...req,
      userName: usersMap.get(req.userId) || 'Unknown User',
    })).sort((a, b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime());
  }, [requests, usersMap]);


  const handleRequestAction = (request: ScheduleRequest, status: 'approved' | 'rejected') => {
    if (!firestore) return;

    const requestRef = doc(firestore, 'users', request.userId, 'scheduleRequests', request.id);
    updateDocumentNonBlocking(requestRef, { status });
    
    toast({
      title: 'Request Updated',
      description: `Request from ${usersMap.get(request.userId)} has been ${status}.`,
    });

    if (selectedRequest?.id === request.id) {
        setSelectedRequest(null);
        setSuggestion('');
    }
  };

  const handleGetSuggestion = async () => {
    if (!selectedRequest) return;
    setIsLoadingSuggestion(true);
    setSuggestion('');
    
    const scheduleData = `Current Assignments: (Mock Data)
- 2024-07-02: Agus, Siti
- 2024-07-03: Dewi, Eko
- 2024-07-10: Budi, Joko
- 2024-07-15: Herman, Lina`;

    const requestDetails = `User: ${selectedRequest.userName}
Requested Date: ${format(new Date(selectedRequest.requestedScheduleDate), 'PPP')}
Reason: ${selectedRequest.reason}`;

    const result = await handleGetCoordinatorSuggestion(scheduleData, requestDetails);

    setIsLoadingSuggestion(false);
    if (result.error) {
      toast({
        title: 'Error',
        description: result.error,
        variant: 'destructive',
      });
    } else if (result.suggestion) {
      setSuggestion(result.suggestion);
    }
  };

  const isLoading = isRequestsLoading || isUsersLoading;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Schedule Change Requests</CardTitle>
          <CardDescription>
            Review and act on pending requests from residents.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center h-24">
                    <Loader2 className="mx-auto animate-spin" />
                  </TableCell>
                </TableRow>
              ) : processedRequests.map((req) => (
                <TableRow 
                    key={req.id} 
                    onClick={() => { setSelectedRequest(req); setSuggestion(''); }}
                    className="cursor-pointer"
                    data-selected={selectedRequest?.id === req.id}
                >
                  <TableCell className="font-medium">{req.userName}</TableCell>
                  <TableCell>{req.reason}</TableCell>
                  <TableCell>
                    <Badge variant={req.status === 'pending' ? 'secondary' : req.status === 'approved' ? 'default' : 'destructive'}
                        className={req.status === 'approved' ? 'bg-green-600' : ''}
                    >
                      {req.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {req.status === 'pending' && (
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => { e.stopPropagation(); handleRequestAction(req, 'approved'); }}
                        >
                          <ThumbsUp className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={(e) => { e.stopPropagation(); handleRequestAction(req, 'rejected'); }}
                        >
                          <ThumbsDown className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI Assistant</CardTitle>
          <CardDescription>
            Get intelligent suggestions for the selected request.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {selectedRequest ? (
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold">{selectedRequest.userName}'s Request</h4>
                <p className="text-sm text-muted-foreground">
                    Requested Date: {format(new Date(selectedRequest.requestedScheduleDate), 'PPP')}
                </p>
                <p className="text-sm mt-2">"{selectedRequest.reason}"</p>
              </div>
              <Button onClick={handleGetSuggestion} disabled={isLoadingSuggestion || selectedRequest.status !== 'pending'}>
                {isLoadingSuggestion ? <Loader2 className="animate-spin" /> : <Wand2 />}
                Get AI Suggestion
              </Button>

              {suggestion && (
                <Alert>
                  <Wand2 className="h-4 w-4" />
                  <AlertTitle>AI Recommendation</AlertTitle>
                  <AlertDescription className="whitespace-pre-wrap">{suggestion}</AlertDescription>
                </Alert>
              )}
            </div>
          ) : (
            <Alert>
              <AlertTitle>No Request Selected</AlertTitle>
              <AlertDescription>
                Click on a pending request from the table to see details and get
                AI suggestions.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
