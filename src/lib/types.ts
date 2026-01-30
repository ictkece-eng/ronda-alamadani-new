
export type Assignment = {
  name: string;
  block: string;
  phone: string;
  substitute?: string;
};

export type RondaDay = {
  day: string;
  date: string;
  assignments: Assignment[];
};

export type BackupRondaPerson = {
  name:string;
  block: string;
  phone: string;
};

export type CoordinatorRonda = {
  name: string;
  block: string;
  phone: string;
};

export type InfoItem = {
  id: number;
  text: string;
};

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
