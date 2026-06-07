import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpHelper } from '@core/helpers/http-helper';

export interface IAiUsageSummary {
  totalRequests: number;
  totalCostUSD: number;
  avgCostUSD: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  avgRounds: number;
}

export interface IAiDailyStats {
  _id: string; // YYYY-MM-DD
  requests: number;
  costUSD: number;
  inputTokens: number;
  outputTokens: number;
}

export interface IAiToolStat {
  _id: string; // tool name
  count: number;
  totalCostUSD: number;
  avgCostUSD: number;
}

export interface IAiExpensiveRequest {
  requestSummary: string;
  toolsUsed: string[];
  rounds: number;
  inputTokens: number;
  outputTokens: number;
  costUSD: number;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class AiAnalyticsService extends HttpHelper {
  getSummary(days = 30): Observable<IAiUsageSummary> {
    return this.httpGetRequest<IAiUsageSummary>('api/ai/usage/summary', { days });
  }

  getDaily(days = 30): Observable<IAiDailyStats[]> {
    return this.httpGetRequest<IAiDailyStats[]>('api/ai/usage/daily', { days });
  }

  getTools(days = 30): Observable<IAiToolStat[]> {
    return this.httpGetRequest<IAiToolStat[]>('api/ai/usage/tools', { days });
  }

  getExpensive(days = 30): Observable<IAiExpensiveRequest[]> {
    return this.httpGetRequest<IAiExpensiveRequest[]>('api/ai/usage/expensive', {
      days,
    });
  }
}
