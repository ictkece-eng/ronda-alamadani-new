'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

export function RequestForm() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);

    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      toast({
        title: 'Request Submitted',
        description: 'Your schedule change request has been sent for approval.',
      });
      // In a real app, you would clear the form here
      (event.target as HTMLFormElement).reset();
    }, 1500);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Your Name</Label>
        <Input id="name" name="name" required />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="current-date">Current Schedule Date</Label>
          <Input id="current-date" name="current-date" type="date" required />
        </div>
        <div>
          <Label htmlFor="requested-date">Requested Date</Label>
          <Input id="requested-date" name="requested-date" type="date" required />
        </div>
      </div>
      <div>
        <Label htmlFor="reason">Reason for Change</Label>
        <Textarea id="reason" name="reason" required />
      </div>
      <Button type="submit" disabled={isLoading}>
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Submit Request
      </Button>
    </form>
  );
}
