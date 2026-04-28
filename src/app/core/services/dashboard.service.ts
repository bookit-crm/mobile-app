import { Injectable } from '@angular/core';
import { HttpHelper } from '@core/helpers/http-helper';
import { IBaseQueries } from '@core/models/application.interface';
import {
  IBusiestHoursResponse,
  IClientAnalyticsResponse,
  IClientTrendResponse,
  IDashboardKpis,
  IEmployeeHeatmapResponse,
  IEmployeePerformanceResponse,
  IExpensesOverviewResponse,
  IExpensesTrendResponse,
  IInventoryAnalyticsResponse,
  IProfitResponse,
  IPromoCodeAnalyticsResponse,
  IRevenueBreakdownResponse,
  IRevenueByDepartmentResponse,
  IRevenueByEmployeeResponse,
  IRevenueByServiceResponse,
  IRevenueTrendResponse,
  IScheduleOccupancyResponse,
  ITopClientsResponse,
  ITopProductsResponse,
  ITopServicesResponse,
} from '@core/models/dashboard.interface';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class DashboardService extends HttpHelper {
  public getKpis(filters?: IBaseQueries): Observable<IDashboardKpis> {
    return this.httpGetRequest<IDashboardKpis>('api/dashboard/kpis/', filters);
  }

  public getRevenueTrend(
    filters?: IBaseQueries & { granularity?: 'daily' | 'monthly' },
  ): Observable<IRevenueTrendResponse> {
    return this.httpGetRequest<IRevenueTrendResponse>(
      'api/dashboard/revenue-trend/',
      filters,
    );
  }

  public getRevenueByService(
    filters?: IBaseQueries,
  ): Observable<IRevenueByServiceResponse> {
    return this.httpGetRequest<IRevenueByServiceResponse>(
      'api/dashboard/revenue-by-service/',
      filters,
    );
  }

  public getRevenueByEmployee(
    filters?: IBaseQueries,
  ): Observable<IRevenueByEmployeeResponse> {
    return this.httpGetRequest<IRevenueByEmployeeResponse>(
      'api/dashboard/revenue-by-employee/',
      filters,
    );
  }

  public getRevenueByDepartment(
    filters?: IBaseQueries,
  ): Observable<IRevenueByDepartmentResponse> {
    return this.httpGetRequest<IRevenueByDepartmentResponse>(
      'api/dashboard/revenue-by-department/',
      filters,
    );
  }

  public getRevenueBreakdown(
    filters?: IBaseQueries,
  ): Observable<IRevenueBreakdownResponse> {
    return this.httpGetRequest<IRevenueBreakdownResponse>(
      'api/dashboard/revenue-breakdown/',
      filters,
    );
  }

  public getClientAnalytics(
    filters?: IBaseQueries,
  ): Observable<IClientAnalyticsResponse> {
    return this.httpGetRequest<IClientAnalyticsResponse>(
      'api/dashboard/client-analytics/',
      filters,
    );
  }

  public getClientTrend(
    filters?: IBaseQueries & { granularity?: 'daily' | 'monthly' },
  ): Observable<IClientTrendResponse> {
    return this.httpGetRequest<IClientTrendResponse>(
      'api/dashboard/client-trend/',
      filters,
    );
  }

  public getTopClients(
    filters?: IBaseQueries,
  ): Observable<ITopClientsResponse> {
    return this.httpGetRequest<ITopClientsResponse>(
      'api/dashboard/top-clients/',
      filters,
    );
  }

  public getEmployeePerformance(
    filters?: IBaseQueries,
  ): Observable<IEmployeePerformanceResponse> {
    return this.httpGetRequest<IEmployeePerformanceResponse>(
      'api/dashboard/employee-performance/',
      filters,
    );
  }

  public getEmployeeHeatmap(
    filters?: IBaseQueries,
  ): Observable<IEmployeeHeatmapResponse> {
    return this.httpGetRequest<IEmployeeHeatmapResponse>(
      'api/dashboard/employee-heatmap/',
      filters,
    );
  }

  public getScheduleOccupancy(
    filters?: IBaseQueries,
  ): Observable<IScheduleOccupancyResponse> {
    return this.httpGetRequest<IScheduleOccupancyResponse>(
      'api/dashboard/schedule-occupancy/',
      filters,
    );
  }

  public getBusiestHours(
    filters?: IBaseQueries,
  ): Observable<IBusiestHoursResponse> {
    return this.httpGetRequest<IBusiestHoursResponse>(
      'api/dashboard/busiest-hours/',
      filters,
    );
  }

  public getTopServices(
    filters?: IBaseQueries,
  ): Observable<ITopServicesResponse> {
    return this.httpGetRequest<ITopServicesResponse>(
      'api/dashboard/top-services/',
      filters,
    );
  }

  public getTopProducts(
    filters?: IBaseQueries,
  ): Observable<ITopProductsResponse> {
    return this.httpGetRequest<ITopProductsResponse>(
      'api/dashboard/top-products/',
      filters,
    );
  }

  public getInventoryAnalytics(
    filters?: IBaseQueries,
  ): Observable<IInventoryAnalyticsResponse> {
    return this.httpGetRequest<IInventoryAnalyticsResponse>(
      'api/dashboard/inventory-analytics/',
      filters,
    );
  }

  public getExpensesOverview(
    filters?: IBaseQueries,
  ): Observable<IExpensesOverviewResponse> {
    return this.httpGetRequest<IExpensesOverviewResponse>(
      'api/dashboard/expenses-overview/',
      filters,
    );
  }

  public getProfit(filters?: IBaseQueries): Observable<IProfitResponse> {
    return this.httpGetRequest<IProfitResponse>(
      'api/dashboard/profit/',
      filters,
    );
  }

  public getExpensesTrend(
    filters?: IBaseQueries & { granularity?: 'daily' | 'monthly' },
  ): Observable<IExpensesTrendResponse> {
    return this.httpGetRequest<IExpensesTrendResponse>(
      'api/dashboard/expenses-trend/',
      filters,
    );
  }

  public getPromoCodeAnalytics(
    filters?: IBaseQueries,
  ): Observable<IPromoCodeAnalyticsResponse> {
    return this.httpGetRequest<IPromoCodeAnalyticsResponse>(
      'api/dashboard/promo-code-analytics/',
      filters,
    );
  }
}

