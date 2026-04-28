export interface IClient {
  _id: string;
  fullName: string;
  phone: string;
  email?: string;
  dateOfBirth?: string;
  city?: string;
  description?: string;
  lastVisitDate?: string;
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
