export interface IDepartment {
  _id: string;
  name: string;
  phone?: string;
  status?: 'active' | 'inactive';
  location?: { formattedAddress?: string };
}

export interface IDepartmentList {
  results: IDepartment[];
  count: number;
}

