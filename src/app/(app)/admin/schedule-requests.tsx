'use client';

import { useState, useMemo } from 'react';
import {
  useCollection,
  useFirestore,
  useMemoFirebase,
  setDocumentNonBlocking,
} from '@/firebase';
import { collection, collectionGroup, doc, query } from 'firebase/firestore';
import type { ScheduleRequest, Warga } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ThumbsDown, ThumbsUp } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

type ScheduleRequestWithUser = ScheduleRequest & { userName?: string };

const ITEMS_PER_PAGE = 10;

export function ScheduleRequests() {
  const firestore = useFirestore();
  const { toast } = useToast();

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

  const [currentPage, setCurrentPage] = useState(1);

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

  const isLoading = isRequestsLoading || isUsersLoading;

  const totalPages = Math.ceil(processedRequests.length / ITEMS_PER_PAGE);
  const paginatedRequests = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return processedRequests.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [processedRequests, currentPage]);


  const handleUpdateStatus = (request: ScheduleRequest, status: 'approved' | 'rejected') => {
    if (!firestore) return;
    const requestRef = doc(firestore, 'users', request.userId, 'scheduleRequests', request.id);
    
    // We keep all original data and just update the status
    const updatedData = { ...request, status };

    setDocumentNonBlocking(requestRef, updatedData, { merge: true });
    
    toast({ title: 'Success', description: `Request status updated to ${status}.` });
  };


  return (
    <Card>
      <CardHeader>
        <CardTitle>Manage Schedule Requests</CardTitle>
        <CardDescription>Approve or reject ronda schedule change requests from warga.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="border rounded-lg overflow-hidden">
            <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Warga</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead className='hidden md:table-cell'>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                            <TableCell colSpan={6}><Skeleton className="h-6 w-full" /></TableCell>
                        </TableRow>
                    ))
                ) : paginatedRequests.length > 0 ? (
                paginatedRequests.map((req) => (
                    <TableRow key={req.id}>
                        <TableCell className="font-medium">{req.userName}</TableCell>
                        <TableCell>{format(new Date(req.currentScheduleDate), 'PPP')}</TableCell>
                        <TableCell>{format(new Date(req.requestedScheduleDate), 'PPP')}</TableCell>
                        <TableCell className='hidden md:table-cell'>{req.reason}</TableCell>
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
                                    onClick={() => handleUpdateStatus(req, 'approved')}
                                    >
                                    <ThumbsUp className="h-4 w-4" />
                                    </Button>
                                    <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleUpdateStatus(req, 'rejected')}
                                    >
                                    <ThumbsDown className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}
                        </TableCell>
                    </TableRow>
                ))
                ) : (
                <TableRow>
                    <TableCell colSpan={6} className="text-center h-24">
                       No schedule requests found.
                    </TableCell>
                </TableRow>
                )}
            </TableBody>
            </Table>
        </div>
      </CardContent>
        {totalPages > 1 && (
            <CardFooter className='justify-between'>
                 <div className="text-xs text-muted-foreground">
                    Showing <strong>{paginatedRequests.length}</strong> of <strong>{processedRequests.length}</strong> requests
                </div>
                <Pagination>
                    <PaginationContent>
                        <PaginationItem>
                            <PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); setCurrentPage(p => Math.max(1, p - 1))}} className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''} />
                        </PaginationItem>
                        
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                             <PaginationItem key={page}>
                                <PaginationLink href="#" onClick={(e) => { e.preventDefault(); setCurrentPage(page)}} isActive={currentPage === page}>
                                    {page}
                                </PaginationLink>
                            </PaginationItem>
                        ))}
                       
                        <PaginationItem>
                            <PaginationNext href="#" onClick={(e) => { e.preventDefault(); setCurrentPage(p => Math.min(totalPages, p + 1))}} className={currentPage === totalPages ? 'pointer-events-none opacity-50' : ''} />
                        </PaginationItem>
                    </PaginationContent>
                </Pagination>
            </CardFooter>
        )}
    </Card>
  );
}
