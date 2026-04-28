export interface IDashboardKpis {
  totalRevenue: number;
  avgTicketValue: number;
  completedAppointments: number;
  newClients: number;
  returningClients: number;
  utilizationRate: number;
}

export interface IRevenueTrendPoint {
  label: string;
  value: number;
}

export interface IRevenueTrendResponse {
  current: IRevenueTrendPoint[];
  previous: IRevenueTrendPoint[];
}

export interface IRevenueByServiceItem {
  name: string;
  revenue: number;
}

export interface IRevenueByServiceResponse {
  byService: IRevenueByServiceItem[];
  byCategory: IRevenueByServiceItem[];
}

export interface IRevenueByEmployeeItem {
  name: string;
  revenue: number;
}

export interface IRevenueByEmployeeResponse {
  byEmployee: IRevenueByEmployeeItem[];
}

export interface IRevenueByDepartmentItem {
  name: string;
  revenue: number;
}

export interface IRevenueByDepartmentResponse {
  byDepartment: IRevenueByDepartmentItem[];
}

export interface IRevenueBreakdownItem {
  name: string;
  revenue: number;
}

export interface IRevenueBreakdownResponse {
  serviceRevenue: number;
  productRevenue: number;
  byProduct: IRevenueBreakdownItem[];
}

export interface IClientAnalyticsResponse {
  retentionRate: number;
  rebookingRate: number;
  avgVisitFrequency: number;
  newClients: number;
  avgLifetimeValue: number;
  dormantClients: number;
}

export interface IClientTrendPoint {
  label: string;
  newClients: number;
  returningClients: number;
}

export interface IClientTrendResponse {
  data: IClientTrendPoint[];
}

export interface ITopClientItem {
  name: string;
  phone: string;
  visits: number;
  revenue: number;
  lastVisit: string | null;
}

export interface ITopClientsResponse {
  byRevenue: ITopClientItem[];
  byVisits: ITopClientItem[];
}

export interface IEmployeePerformanceItem {
  employeeId: string;
  name: string;
  department: string;
  revenue: number;
  appointments: number;
  avgTicketValue: number;
  utilizationRate: number;
}

export interface IEmployeePerformanceResponse {
  employees: IEmployeePerformanceItem[];
}

export interface IHeatmapCell {
  day: number;
  hour: number;
  value: number;
}

export interface IEmployeeHeatmapResponse {
  data: IHeatmapCell[];
}

export interface IScheduleOccupancyResponse {
  totalAppointments: number;
  completedAppointments: number;
  canceledAppointments: number;
  noShowAppointments: number;
  bookingPercentage: number;
  cancellationRate: number;
  noShowRate: number;
  freeSlots: number;
  bookedSlots: number;
  totalSlots: number;
}

export interface IBusiestHoursResponse {
  data: IHeatmapCell[];
}

export interface ITopServiceItem {
  name: string;
  category: string;
  revenue: number;
  bookings: number;
}

export interface ITopServicesResponse {
  byRevenue: ITopServiceItem[];
  byBookings: ITopServiceItem[];
}

export interface ITopProductItem {
  name: string;
  sku: string;
  quantitySold: number;
  revenue: number;
  currentStock: number;
  minStock: number | null;
  lowStockWarning: boolean;
}

export interface ITopProductsResponse {
  products: ITopProductItem[];
}

export interface IMaterialUsage {
  productName: string;
  totalQuantity: number;
}

export interface IServiceMaterialUsage {
  serviceName: string;
  materials: IMaterialUsage[];
}

export interface IInventoryAnalyticsResponse {
  inventoryTurnover: number;
  totalProductRevenue: number;
  totalCostOfGoods: number;
  materialUsageByService: IServiceMaterialUsage[];
}

export interface IExpensesOverviewResponse {
  totalExpenses: number;
  byCategory: { category: string; total: number }[];
}

export interface IProfitResponse {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
}

export interface IExpensesTrendPoint {
  label: string;
  value: number;
}

export interface IExpensesTrendResponse {
  data: IExpensesTrendPoint[];
}

export interface IPromoCodeAnalyticsResponse {
  totalDiscountGiven: number;
  appointmentsWithPromo: number;
  totalAppointments: number;
  promoUsageRate: number;
  avgDiscountPerAppointment: number;
  topPromoCodes: {
    name: string;
    usageCount: number;
    totalDiscount: number;
  }[];
  discountByService: { name: string; revenue: number }[];
}

