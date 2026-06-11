export interface IClient {
  _id: string;
  fullName: string;
  phone: string;
  email?: string;
  dateOfBirth?: string;
  city?: string;
  description?: string;
  lastVisitDate?: string;
  lastVisitEmployee?: { firstName: string; lastName: string };
  lastVisitDepartment?: { _id: string; name?: string } | null;
  created?: string;
}

export interface IClientList {
  results: IClient[];
  count: number;
}

export interface ICreateClientPayload {
  fullName: string;
  phone: string;
  email?: string;
  dateOfBirth?: string;
  city?: string;
  description?: string;
}
