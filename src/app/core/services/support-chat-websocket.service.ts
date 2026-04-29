import { inject, Injectable, NgZone, signal, WritableSignal } from '@angular/core';
import { ELocalStorageKeys } from '@core/enums/e-local-storage-keys';
import {
  ISupportChatWsMessage,
  ISupportMessage,
} from '@models/support-chat.interface';
import { Socket, io } from 'socket.io-client';

import { environment } from '@environments/environment';

export enum ESupportChatConnectionStatus {
  Disconnected = 'disconnected',
  Connecting = 'connecting',
  Connected = 'connected',
}

@Injectable({
  providedIn: 'root',
})
export class SupportChatWebsocketService {
  private readonly ngZone = inject(NgZone);
  private socket: Socket | null = null;
  private readonly baseUrl: string;

  /** Current connection status */
  public connectionStatus: WritableSignal<ESupportChatConnectionStatus> =
    signal(ESupportChatConnectionStatus.Disconnected);

  /** Fires when a new operator message arrives */
  public incomingMessage: WritableSignal<ISupportMessage | null> = signal(null);

  /** Fires when a chat is closed by the operator */
  public chatClosed: WritableSignal<string | null> = signal(null);

  /** Unread message counter (for badge) */
  public unreadCount: WritableSignal<number> = signal(0);

  constructor() {
    // Derive base URL: "http://localhost:3000/api" -> "http://localhost:3000"
    this.baseUrl = environment.be_url.replace(/\/api\/?$/, '');
  }

  /**
   * Connect to the support-chat WebSocket namespace.
   */
  public connect(): void {
    if (this.socket?.connected) {
      return;
    }

    const token = localStorage.getItem(ELocalStorageKeys.AUTH_TOKEN) || '';
    if (!token) {
      return;
    }

    this.connectionStatus.set(ESupportChatConnectionStatus.Connecting);

    // Run socket.io outside Angular zone for performance,
    // then re-enter zone when emitting signals.
    this.ngZone.runOutsideAngular(() => {
      this.socket = io(`${this.baseUrl}/api/support-chat`, {
        transports: ['websocket'],
        auth: { token },
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
      });

      this.socket.on('connected', () => {
        this.ngZone.run(() => {
          this.connectionStatus.set(ESupportChatConnectionStatus.Connected);
        });
      });

      this.socket.on('connect', () => {
        this.ngZone.run(() => {
          this.connectionStatus.set(ESupportChatConnectionStatus.Connected);
        });
      });

      this.socket.on('disconnect', () => {
        this.ngZone.run(() => {
          this.connectionStatus.set(ESupportChatConnectionStatus.Disconnected);
        });
      });

      this.socket.on('connect_error', () => {
        this.ngZone.run(() => {
          this.connectionStatus.set(ESupportChatConnectionStatus.Disconnected);
        });
      });

      // Operator sent a message
      this.socket.on('support:message', (data: ISupportChatWsMessage) => {
        this.ngZone.run(() => {
          const msg: ISupportMessage = {
            _id: data._id,
            chatId: data.chatId,
            senderType: data.senderType,
            text: data.text,
            telegramMessageId: null,
            createdAt: data.createdAt,
            updatedAt: data.createdAt,
          };
          this.incomingMessage.set(msg);
          this.unreadCount.update((c) => c + 1);
        });
      });

      // Chat closed by operator
      this.socket.on('support:closed', (data: { chatId: string }) => {
        this.ngZone.run(() => {
          this.chatClosed.set(data.chatId);
        });
      });

      this.socket.on('error', () => {
        // noop: handled by reconnect logic
      });
    });
  }

  /**
   * Join a specific chat room to receive real-time updates.
   */
  public joinChat(chatId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('support:join', { chatId });
    }
  }

  /**
   * Reset the unread badge counter.
   */
  public resetUnreadCount(): void {
    this.unreadCount.set(0);
  }

  /**
   * Disconnect the WebSocket.
   */
  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.connectionStatus.set(ESupportChatConnectionStatus.Disconnected);
  }
}


