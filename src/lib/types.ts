export type Schedule = {
  date: string;
  participants: string[];
  rounds: string[];
};

export type Backup = {
  originalParticipant: string;
  replacement: string;
  date: string;
  status: 'Pending' | 'Approved' | 'Rejected';
};

export type Coordinator = {
  name: string;
  avatar: string;
  contact: string;
  area: string;
};

export type UserRequest = {
  id: number;
  userName: string;
  currentDate: string;
  requestedDate: string;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
};
