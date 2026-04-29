import { Injectable, signal, WritableSignal } from '@angular/core';
import { HttpHelper } from '@core/helpers/http-helper';
import { PaginatedResponseModel } from '@models/paginated-response.model';
import {
  ISendMessagePayload,
  ISendMessageResponse,
  ISupportChat,
  ISupportChatFilters,
  ISupportMessage,
} from '@models/support-chat.interface';
import { Observable, tap } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class SupportChatService extends HttpHelper {
  public activeChatSignal: WritableSignal<ISupportChat | null> = signal(null);
  public messagesSignal: WritableSignal<ISupportMessage[]> = signal([]);
  public hasMoreMessagesSignal: WritableSignal<boolean> = signal(false);
  public totalMessagesSignal: WritableSignal<number> = signal(0);

  /**
   * Send a message. If chatId is omitted, the backend creates a new chat.
   */
  public sendMessage(payload: ISendMessagePayload): Observable<ISendMessageResponse> {
    return this.httpPostRequest<ISendMessagePayload, ISendMessageResponse>(
      'api/support-chat/message/',
      payload,
    ).pipe(
      tap((res) => {
        this.activeChatSignal.set(res.chat);
        this.messagesSignal.update((msgs) => [...msgs, res.message]);
      }),
    );
  }

  /**
   * Get chats with optional filters.
   */
  public getChats(filters: ISupportChatFilters = {}): Observable<PaginatedResponseModel<ISupportChat>> {
    return this.httpGetRequest<PaginatedResponseModel<ISupportChat>>(
      'api/support-chat/chats/',
      filters as Record<string, string>,
    );
  }

  /**
   * Get a single chat by ID.
   */
  public getChatById(chatId: string): Observable<ISupportChat> {
    return this.httpGetRequest<ISupportChat>(`api/support-chat/chats/${chatId}/`);
  }

  /**
   * Load chat messages with pagination.
   */
  public getMessages(
    chatId: string,
    offset = 0,
    limit = 50,
  ): Observable<PaginatedResponseModel<ISupportMessage>> {
    return this.httpGetRequest<PaginatedResponseModel<ISupportMessage>>(
      `api/support-chat/chats/${chatId}/messages/`,
      { offset: offset.toString(), limit: limit.toString() },
    ).pipe(
      tap((res) => {
        if (offset === 0) {
          this.messagesSignal.set(res.results);
        } else {
          this.messagesSignal.update((msgs) => [...res.results, ...msgs]);
        }
        this.totalMessagesSignal.set(res.count);
        this.hasMoreMessagesSignal.set(!!res.count && offset + limit < res.count);
      }),
    );
  }

  /**
   * Close the current chat.
   */
  public closeChat(chatId: string): Observable<ISupportChat> {
    return this.httpPatchRequest<ISupportChat>(
      `api/support-chat/chats/${chatId}/close/`,
      {},
    ).pipe(
      tap(() => {
        this.activeChatSignal.set(null);
        this.messagesSignal.set([]);
      }),
    );
  }

  /**
   * Append a message received via WebSocket.
   */
  public appendWsMessage(message: ISupportMessage): void {
    const activeChat = this.activeChatSignal();
    if (activeChat && message.chatId === activeChat._id) {
      this.messagesSignal.update((msgs) => {
        const exists = msgs.some((m) => m._id === message._id);
        return exists ? msgs : [...msgs, message];
      });
    }
  }

  /**
   * Reset all state (e.g. on logout).
   */
  public reset(): void {
    this.activeChatSignal.set(null);
    this.messagesSignal.set([]);
    this.hasMoreMessagesSignal.set(false);
    this.totalMessagesSignal.set(0);
  }
}

