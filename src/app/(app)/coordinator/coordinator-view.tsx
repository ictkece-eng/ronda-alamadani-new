'use client';

import { useState } from 'react';
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
import type { UserRequest } from '@/lib/types';
import { userRequests as initialRequests } from '@/lib/data';
import { handleGetCoordinatorSuggestion } from '@/lib/actions';

export function CoordinatorView() {
  const [requests, setRequests] = useState<UserRequest[]>(initialRequests);
  const [selectedRequest, setSelectedRequest] = useState<UserRequest | null>(null);
  const [suggestion, setSuggestion] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleRequestAction = (id: number, status: 'Approved' | 'Rejected') => {
    setRequests(
      requests.map((req) => (req.id === id ? { ...req, status } : req))
    );
    toast({
      title: 'Request Updated',
      description: `Request from ${requests.find(r => r.id === id)?.userName} has been ${status.toLowerCase()}.`,
    });
    if (selectedRequest?.id === id) {
        setSelectedRequest(null);
        setSuggestion('');
    }
  };

  const handleGetSuggestion = async () => {
    if (!selectedRequest) return;
    setIsLoading(true);
    setSuggestion('');
    
    // Mock schedule data for context
    const scheduleData = `Current Assignments:
- 2024-07-02: Agus, Siti
- 2024-07-03: Dewi, Eko
- 2024-07-10: Budi, Joko
- 2024-07-15: Herman, Lina
Shift Preferences:
- Budi prefers weekends.
- Siti can't work on Wednesdays.
- Eko available Mon-Fri.`;

    const requestDetails = `User: ${selectedRequest.userName}
Current Date: ${selectedRequest.currentDate}
Requested Date: ${selectedRequest.requestedDate}
Reason: ${selectedRequest.reason}`;

    const result = await handleGetCoordinatorSuggestion(scheduleData, requestDetails);

    setIsLoading(false);
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
              {requests.map((req) => (
                <TableRow 
                    key={req.id} 
                    onClick={() => { setSelectedRequest(req); setSuggestion(''); }}
                    className="cursor-pointer"
                    data-selected={selectedRequest?.id === req.id}
                >
                  <TableCell className="font-medium">{req.userName}</TableCell>
                  <TableCell>{req.reason}</TableCell>
                  <TableCell>
                    <Badge variant={req.status === 'Pending' ? 'secondary' : req.status === 'Approved' ? 'default' : 'destructive'}
                        className={req.status === 'Approved' ? 'bg-green-600' : ''}
                    >
                      {req.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {req.status === 'Pending' && (
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => { e.stopPropagation(); handleRequestAction(req.id, 'Approved'); }}
                        >
                          <ThumbsUp className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={(e) => { e.stopPropagation(); handleRequestAction(req.id, 'Rejected'); }}
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
                    From: {selectedRequest.currentDate}
                </p>
                 <p className="text-sm text-muted-foreground">
                    To: {selectedRequest.requestedDate}
                </p>
                <p className="text-sm mt-2">"{selectedRequest.reason}"</p>
              </div>
              <Button onClick={handleGetSuggestion} disabled={isLoading || selectedRequest.status !== 'Pending'}>
                {isLoading ? <Loader2 className="animate-spin" /> : <Wand2 />}
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
