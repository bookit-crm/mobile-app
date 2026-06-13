import { Injectable, signal, computed, inject } from '@angular/core';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { firstValueFrom } from 'rxjs';
import { ELocalStorageKeys } from '@core/enums/e-local-storage-keys';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

export interface AiMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  isStreaming?: boolean;
  toolCall?: string;
}

export interface AiConversation {
  id: string;
  title: string;
  date: string;
  messages: AiMessage[];
}

const USAGE_KEY = 'ai_usage';

export interface AiUsage {
  date: string; // YYYY-MM-DD
  count: number;
}

@Injectable({ providedIn: 'root' })
export class AiChatService {
  private readonly authService = inject(AuthService);

  public readonly messages = signal<AiMessage[]>([]);
  public readonly isStreaming = signal(false);
  public readonly showHistory = signal(false);
  public readonly conversations = signal<AiConversation[]>([]);

  public readonly usedToday = signal<number>(0);
  /** Daily credit cap from the AI add-on (server-driven). 0 = no access. */
  public readonly dailyLimit = signal<number>(0);

  public readonly usagePercent = computed(() =>
    this.dailyLimit() > 0 ? Math.min(100, (this.usedToday() / this.dailyLimit()) * 100) : 0,
  );
  public readonly isLimitReached = computed(
    () => this.dailyLimit() > 0 && this.usedToday() >= this.dailyLimit(),
  );

  private conversationId: string | null = null;
  /** Active streaming request, so stopStreaming() / a new send can abort it. */
  private activeXhr: XMLHttpRequest | null = null;

  constructor() {
    this.loadHistory();
    this.loadUsage();
    void this.loadUsageFromServer();
  }

  private get aiUrl(): string {
    return environment.be_url.replace('/api', '');
  }

  private getToken(): string {
    return localStorage.getItem(ELocalStorageKeys.AUTH_TOKEN) ?? '';
  }

  private getRefreshToken(): string {
    return localStorage.getItem(ELocalStorageKeys.REFRESH_TOKEN) ?? '';
  }

  async sendMessage(text: string): Promise<void> {
    if (this.isStreaming() || !text.trim()) return;
    if (this.isLimitReached()) return;

    const token = this.getToken();
    if (!token) return;

    this.incrementUsage();

    const userMsg: AiMessage = { id: `user_${Date.now()}`, role: 'user', text: text.trim() };
    this.messages.update((msgs) => [...msgs, userMsg]);

    const assistantId = `assistant_${Date.now()}`;
    const assistantMsg: AiMessage = { id: assistantId, role: 'assistant', text: '', isStreaming: true };
    this.messages.update((msgs) => [...msgs, assistantMsg]);
    this.isStreaming.set(true);

    try {
      const body = JSON.stringify({
        message: text.trim(),
        conversationId: this.conversationId,
        timezoneOffset: -new Date().getTimezoneOffset() / 60,
      });

      // Parse one SSE line ("data: {...}") and apply it to the streaming
      // assistant message. Shared by the initial request and the post-
      // refresh retry.
      const onLine = (line: string): void => {
        if (!line.startsWith('data: ')) return;
        try {
          const data = JSON.parse(line.slice(6));
          // Server-side proxy error event (e.g. core-api can't reach the AI
          // server). The HTTP status is still 200 — the error rides inside
          // the SSE body — so surface it here, otherwise the bubble would
          // just sit empty. Show the reason so prod issues are diagnosable.
          if (data.error) {
            this.messages.update((msgs) =>
              msgs.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      text: `Помилка з'єднання з AI. Спробуй ще раз. (${data.error})`,
                      isStreaming: false,
                      toolCall: undefined,
                    }
                  : m,
              ),
            );
            return;
          }
          if (data.type === 'start') {
            this.conversationId = data.conversationId;
          } else if (data.type === 'text') {
            this.messages.update((msgs) =>
              msgs.map((m) => (m.id === assistantId ? { ...m, text: m.text + data.text } : m)),
            );
          } else if (data.type === 'tool_call') {
            this.messages.update((msgs) =>
              msgs.map((m) => (m.id === assistantId ? { ...m, toolCall: data.tool } : m)),
            );
          } else if (data.type === 'done') {
            this.messages.update((msgs) =>
              msgs.map((m) =>
                m.id === assistantId ? { ...m, isStreaming: false, toolCall: undefined } : m,
              ),
            );
            // Sync real usage (credits) from server after the AI responds.
            void this.loadUsageFromServer();
          }
        } catch {
          // skip invalid JSON
        }
      };

      try {
        await this.runChat(this.getToken(), body, onLine);
      } catch (err: any) {
        // 401 — token expired: refresh once and retry the stream.
        if (err?.message === 'UNAUTHORIZED') {
          const refreshToken = this.getRefreshToken();
          if (!refreshToken) throw new Error('SESSION_EXPIRED');
          let tokens;
          try {
            tokens = await firstValueFrom(this.authService.refreshToken(refreshToken));
          } catch {
            throw new Error('SESSION_EXPIRED');
          }
          localStorage.setItem(ELocalStorageKeys.AUTH_TOKEN, tokens.auth_token);
          localStorage.setItem(ELocalStorageKeys.REFRESH_TOKEN, tokens.refresh_token);
          await this.runChat(tokens.auth_token, body, onLine);
        } else {
          throw err;
        }
      }

      // Stream completed without throwing but produced nothing — e.g. a
      // 200 with an empty / non-SSE body (a reverse proxy that swallowed
      // the stream, or CapacitorHttp returning no data). Don't leave the
      // bubble spinning silently; surface a diagnostic.
      const finalMsg = this.messages().find((m) => m.id === assistantId);
      if (finalMsg && finalMsg.isStreaming && !finalMsg.text.trim()) {
        this.messages.update((msgs) =>
          msgs.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  text: "Помилка з'єднання з AI. Спробуй ще раз. (порожня відповідь)",
                  isStreaming: false,
                  toolCall: undefined,
                }
              : m,
          ),
        );
      }
    } catch (err: any) {
      const isAborted = err?.name === 'AbortError';
      const isExpired = err?.message === 'SESSION_EXPIRED';
      this.messages.update((msgs) =>
        msgs.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                text: isAborted
                  ? ''
                  : isExpired
                    ? '⛔ Сесія закінчилась. Будь ласка, перезайдіть в систему.'
                    : `Помилка з'єднання з AI. Спробуй ще раз.${this.errorHint(err)}`,
                isStreaming: false,
                toolCall: undefined,
              }
            : m,
        ),
      );
      // Full reason to the console for Safari Web Inspector / Xcode during
      // the prod-vs-dev investigation — the on-screen hint is the short form.
      if (!isAborted) console.error('[AiChat] stream failed:', err);
    } finally {
      this.isStreaming.set(false);
      this.activeXhr = null;
    }
  }

  /**
   * Dispatch the chat request to the transport that works on the current
   * platform:
   *  - Native (iOS/Android): `CapacitorHttp` — a native URLSession/OkHttp
   *    request that bypasses the WebView entirely. The WebView's fetch/XHR
   *    failed against the SSE endpoint on device with a bare network error
   *    ("(мережа)") — most likely the streaming `text/event-stream`
   *    response or its CORS handling not surviving WKWebView — even though
   *    ordinary API calls to the same host work. The native client has no
   *    CORS and reads the full response, so it's reliable; the trade-off is
   *    the answer arrives once at the end instead of token-by-token.
   *  - Web (browser / `ionic serve`): the XHR stream below, for live typing.
   */
  private runChat(
    token: string,
    body: string,
    onLine: (line: string) => void,
  ): Promise<void> {
    return Capacitor.isNativePlatform()
      ? this.nativeChat(token, body, onLine)
      : this.streamChat(token, body, onLine);
  }

  /**
   * Native (Capacitor) chat request. Sends the message over the platform's
   * native HTTP stack and parses the buffered SSE body once it completes.
   * No live streaming, but it actually reaches the server on device.
   */
  private async nativeChat(
    token: string,
    body: string,
    onLine: (line: string) => void,
  ): Promise<void> {
    const res = await CapacitorHttp.post({
      url: `${this.aiUrl}/api/ai/chat`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      data: JSON.parse(body),
      responseType: 'text',
      readTimeout: 120000,
      connectTimeout: 30000,
    });

    if (res.status === 401) throw new Error('UNAUTHORIZED');
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`HTTP_${res.status}`);
    }

    const text =
      typeof res.data === 'string' ? res.data : JSON.stringify(res.data ?? '');
    for (const line of text.split('\n')) onLine(line);
  }

  /**
   * Streams the SSE chat response over XMLHttpRequest instead of fetch().
   *
   * Why XHR: on iOS the WKWebView's `fetch()` does not reliably expose a
   * readable `response.body` stream — on device `response.body` came back
   * null, so the old code threw "No response body" and surfaced the
   * "Помилка з'єднання з AI" error, even though the very same code worked
   * in the browser/emulator. XHR's progressive `responseText` + onprogress
   * is supported in WKWebView and desktop browsers alike, so the stream
   * behaves identically on device and in dev.
   *
   * Resolves when the response completes. Rejects with:
   *  - Error('UNAUTHORIZED') on HTTP 401 (caller refreshes + retries),
   *  - an AbortError-named error when aborted (stop / new message),
   *  - Error('NETWORK' | 'HTTP_xxx') otherwise.
   */
  private streamChat(
    token: string,
    body: string,
    onLine: (line: string) => void,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      this.activeXhr = xhr;

      let processed = 0; // chars of responseText already parsed
      let buffer = ''; // carries the trailing partial line between events
      let ok = false;
      let statusChecked = false;

      const checkStatus = (): boolean => {
        if (statusChecked) return ok;
        if (xhr.readyState < XMLHttpRequest.HEADERS_RECEIVED) return false;
        statusChecked = true;
        ok = xhr.status >= 200 && xhr.status < 300;
        if (xhr.status === 401) {
          reject(new Error('UNAUTHORIZED'));
          xhr.abort();
        }
        return ok;
      };

      const drain = (): void => {
        if (!checkStatus() || !ok) return;
        const full = xhr.responseText;
        if (full.length <= processed) return;
        buffer += full.slice(processed);
        processed = full.length;
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? ''; // last item may be an incomplete line
        for (const line of lines) onLine(line);
      };

      xhr.onreadystatechange = () => {
        if (xhr.readyState >= XMLHttpRequest.HEADERS_RECEIVED) checkStatus();
      };
      xhr.onprogress = drain;
      xhr.onload = () => {
        if (xhr.status === 401) return; // already rejected in checkStatus
        if (xhr.status >= 200 && xhr.status < 300) {
          ok = true;
          drain();
          if (buffer.trim()) onLine(buffer);
          resolve();
        } else {
          reject(new Error(`HTTP_${xhr.status}`));
        }
      };
      xhr.onerror = () => reject(new Error('NETWORK'));
      xhr.onabort = () =>
        reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));

      xhr.open('POST', `${this.aiUrl}/api/ai/chat`, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.send(body);
    });
  }

  /**
   * Short, user-visible reason code appended to the connection-error
   * message. Lets a tester tell us the failure mode (network vs HTTP
   * status) from a screenshot without needing console access. Kept terse
   * and parenthesised so it reads as a diagnostic, not a scary dump.
   */
  private errorHint(err: any): string {
    const msg: string = err?.message ?? '';
    if (msg === 'NETWORK') return ' (мережа)';
    if (msg.startsWith('HTTP_')) return ` (${msg.replace('HTTP_', 'код ')})`;
    // Unknown error — e.g. a native CapacitorHttp rejection. Surface a
    // short raw form so a tester's screenshot tells us what actually
    // threw (native errors carry their reason in message / error / name).
    const raw = (msg || err?.error || err?.name || '')
      .toString()
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80);
    return raw ? ` (${raw})` : '';
  }

  stopStreaming(): void {
    this.activeXhr?.abort();
    this.activeXhr = null;
    this.isStreaming.set(false);
  }

  /**
   * GET JSON from the AI gateway, native-aware. The non-streaming AI calls
   * (history, usage) hit the same host that the chat does, so they need the
   * same native transport on device — see {@link runChat}. Returns null on
   * any non-2xx / failure; callers degrade gracefully.
   */
  private async apiGetJson<T>(path: string): Promise<T | null> {
    const token = this.getToken();
    if (!token) return null;
    const url = `${this.aiUrl}${path}`;
    const headers = { Authorization: `Bearer ${token}` };
    try {
      if (Capacitor.isNativePlatform()) {
        const res = await CapacitorHttp.get({ url, headers, responseType: 'json' });
        if (res.status < 200 || res.status >= 300) return null;
        return (res.data ?? null) as T;
      }
      const res = await fetch(url, { headers });
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch {
      return null;
    }
  }

  /** DELETE on the AI gateway, native-aware. Swallows failures. */
  private async apiDelete(path: string): Promise<void> {
    const token = this.getToken();
    if (!token) return;
    const url = `${this.aiUrl}${path}`;
    const headers = { Authorization: `Bearer ${token}` };
    try {
      if (Capacitor.isNativePlatform()) {
        await CapacitorHttp.delete({ url, headers });
        return;
      }
      await fetch(url, { method: 'DELETE', headers });
    } catch {}
  }

  clearConversation(): void {
    this.messages.set([]);
    this.conversationId = null;
  }

  loadConversation(conv: AiConversation): void {
    this.messages.set([...conv.messages]);
    this.conversationId = conv.id;
    this.showHistory.set(false);
  }

  toggleHistory(): void {
    const willOpen = !this.showHistory();
    this.showHistory.set(willOpen);
    if (willOpen) void this.loadHistory();
  }

  async deleteConversation(id: string): Promise<void> {
    await this.apiDelete(`/api/ai/history/${id}`);
    this.conversations.update((list) => list.filter((c) => c.id !== id));
    if (this.conversationId === id) {
      this.messages.set([]);
      this.conversationId = null;
    }
  }

  private incrementUsage(): void {
    this.usedToday.update((v) => v + 1);
    const usage: AiUsage = { date: new Date().toISOString().slice(0, 10), count: this.usedToday() };
    try {
      localStorage.setItem(USAGE_KEY, JSON.stringify(usage));
    } catch {}
  }

  private loadUsage(): void {
    try {
      const raw = localStorage.getItem(USAGE_KEY);
      if (!raw) return;
      const usage: AiUsage = JSON.parse(raw);
      const today = new Date().toISOString().slice(0, 10);
      if (usage.date === today) {
        this.usedToday.set(usage.count);
      } else {
        localStorage.removeItem(USAGE_KEY);
      }
    } catch {}
  }

  /** Authoritative usage + daily cap from the AI add-on subscription. */
  async loadUsageFromServer(): Promise<void> {
    const data = await this.apiGetJson<{ used: number; limit: number }>(
      '/api/ai/usage',
    );
    if (!data) return;
    this.usedToday.set(data.used ?? 0);
    this.dailyLimit.set(data.limit === -1 ? 999999 : data.limit ?? 0);
  }

  async loadHistory(): Promise<void> {
    const data = await this.apiGetJson<any[]>('/api/ai/history');
    if (!data) return;
    try {
      const seen = new Set<string>();
      const convs: AiConversation[] = data
        .filter((c) => {
          if (c._id === this.conversationId) return false;
          if (seen.has(c._id)) return false;
          seen.add(c._id);
          return true;
        })
        .map((c) => ({
          id: c._id,
          title: c.title,
          date: c.updatedAt || c.createdAt,
          messages: (c.messages || []).map((m: any, i: number) => ({
            id: `${c._id}_${i}`,
            role: m.role,
            text: m.text,
          })),
        }));
      this.conversations.set(convs);
    } catch {}
  }
}
