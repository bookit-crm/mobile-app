import {
  EExpenseCategory,
  EExpenseRecurrence,
  EExpenseStatus,
} from '@core/enums/e-expense';
import { EExpenseSource } from '@core/enums/e-payroll';
import { IDepartment } from '@core/models/department.interface';
import { IEmployee } from '@core/models/employee.interface';
import { IFileDTO } from '@core/models/file.interface';
import { IProduct } from '@core/models/product.interface';

export interface IExpense {
  _id: string;
  title: string;
  amount: number;
  category: EExpenseCategory;
  status: EExpenseStatus;
  recurrence: EExpenseRecurrence;
  date: string;
  description: string | null;
  department: IDepartment;
  employee: IEmployee | null;
  product: IProduct | null;
  createdBy: { _id: string; name: string; email: string; role: string };
  receipt: IFileDTO | null;
  source: EExpenseSource;
  payrollPeriodId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IExpenseSummary {
  totalAmount: number;
  averageAmount: number;
  count: number;
  byCategory: { category: string; total: number }[];
  byMonth: { month: string; total: number }[];
  topCategory: string | null;
}

