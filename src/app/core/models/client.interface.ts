export interface IClient {
  _id: string;
  fullName: string;
  phone: string;
  email?: string;
}

export interface IClientList {
  results: IClient[];
  count: number;
}

