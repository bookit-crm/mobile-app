export interface IEmployee {
  _id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  position: string;
  department: { _id: string; name: string } | null;
  avatar?: { url: string } | null;
}
