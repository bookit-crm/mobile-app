import { Injectable, signal } from '@angular/core';
import { ELocalStorageKeys } from '@core/enums/e-local-storage-keys';
import { IAppointment } from '@core/models/appointment.interface';
import { INotification } from '@core/models/notification.interface';
import { WebsocketEnums } from '@core/models/web-socket.interface';
import { Socket, io } from 'socket.io-client';

import { environment } from '../../../environments/environment';

export interface IDashboardUpdatePayload {
  timestamp: string;
}

@Injectable({ providedIn: 'root' })
export class WebsocketService {
  private socket: Socket | null = null;
  private serverUrl: string = environment.be_socket_url;

  public newAppointmentSignal = signal<IAppointment | null>(null);
  public newNotificationSignal = signal<INotification | null>(null);
  public dashboardUpdateSignal = signal<IDashboardUpdatePayload | null>(null);

  public connectSocket(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
    }

    this.socket = io(this.serverUrl, {
      transports: ['websocket'],
      auth: {
        token: localStorage.getItem(ELocalStorageKeys.AUTH_TOKEN) || '',
      },
      autoConnect: true,
      reconnection: true,
      // На мобильных WebSocket рвётся при сворачивании / смене сети,
      // поэтому даём «бесконечный» reconnect с экспоненциальной задержкой.
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 20000,
    });

    this.socket.on('connect', () => {
      console.log('[WS] connected', this.socket?.id);
    });

    this.socket.on('connected', (data) => {
      console.log('[WS] handshake', data);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[WS] disconnected:', reason);
    });

    this.socket.on('connect_error', (err) => {
      console.warn('[WS] connect_error:', err?.message ?? err);
    });

    this.socket.io.on('reconnect_attempt', (attempt) => {
      // Каждый раз перед попыткой обновляем токен — он мог быть обновлён
      // через refresh-token интерсептор пока сокет был отключён.
      if (this.socket) {
        this.socket.auth = {
          token: localStorage.getItem(ELocalStorageKeys.AUTH_TOKEN) || '',
        };
      }
      console.log('[WS] reconnect_attempt', attempt);
    });

    this.socket.on(WebsocketEnums.NewAppointment, (data: IAppointment) => {
      this.newAppointmentSignal.set(data);
    });

    this.socket.on(WebsocketEnums.NewNotification, (data: INotification) => {
      this.newNotificationSignal.set(data);
    });

    this.socket.on(
      WebsocketEnums.DashboardUpdate,
      (data: IDashboardUpdatePayload) => {
        this.dashboardUpdateSignal.set(data);
      },
    );
  }

  public disconnectSocket(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * Если сокет был отключён (например, ОС убила соединение во время фона),
   * пере-инициализируем его. Если активен — ничего не делаем.
   */
  public reconnectIfNeeded(): void {
    if (!this.socket || this.socket.disconnected) {
      this.connectSocket();
    }
  }

  public get isConnected(): boolean {
    return !!this.socket?.connected;
  }
}
