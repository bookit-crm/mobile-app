import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpHelper } from '@core/helpers/http-helper';

/**
 * AI usage analytics. No money is ever returned to tenants — cost stays in the
 * AI server DB for the platform owner only. Filtering is driven by the
 * dashboard period + branch filters (from / to / branchIds).
 */
export interface IAiUsageQuery {
  from?: string;
  to?: string;
  branchIds?: string; // comma-separated department ids
  days?: number; // fallback only
}

export interface IAiUsageSummary {
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalToolCalls: number;
  avgRounds: number;
}

export interface IAiDailyStats {
  _id: string; // YYYY-MM-DD
  requests: number;
  inputTokens: number;
  outputTokens: number;
}

export interface IAiToolStat {
  _id: string; // tool name
  count: number;
}

export interface IAiBranchStat {
  _id: string;
  name: string;
  requests: number;
  toolCalls: number;
  avgRounds: number;
}

export interface IAiComplexRequest {
  requestSummary: string;
  toolsUsed: string[];
  rounds: number;
  inputTokens: number;
  outputTokens: number;
  departmentId: string;
  departmentName: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class AiAnalyticsService extends HttpHelper {
  private toParams(q: IAiUsageQuery): Record<string, string> {
    const params: Record<string, string> = {};
    if (q.from) params['from'] = q.from;
    if (q.to) params['to'] = q.to;
    if (q.branchIds) params['branchIds'] = q.branchIds;
    if (!q.from && !q.to && q.days) params['days'] = String(q.days);
    return params;
  }

  getSummary(q: IAiUsageQuery = {}): Observable<IAiUsageSummary> {
    return this.httpGetRequest<IAiUsageSummary>('api/ai/usage/summary', this.toParams(q));
  }

  getDaily(q: IAiUsageQuery = {}): Observable<IAiDailyStats[]> {
    return this.httpGetRequest<IAiDailyStats[]>('api/ai/usage/daily', this.toParams(q));
  }

  getTools(q: IAiUsageQuery = {}): Observable<IAiToolStat[]> {
    return this.httpGetRequest<IAiToolStat[]>('api/ai/usage/tools', this.toParams(q));
  }

  getBranches(q: IAiUsageQuery = {}): Observable<IAiBranchStat[]> {
    return this.httpGetRequest<IAiBranchStat[]>('api/ai/usage/branches', this.toParams(q));
  }

  getComplex(
    q: IAiUsageQuery = {},
    offset = 0,
    limit = 15,
  ): Observable<{ count: number; results: IAiComplexRequest[] }> {
    return this.httpGetRequest<{ count: number; results: IAiComplexRequest[] }>(
      'api/ai/usage/expensive',
      { ...this.toParams(q), offset: String(offset), limit: String(limit) },
    );
  }
}
