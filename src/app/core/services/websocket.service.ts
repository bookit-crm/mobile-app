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
      reconnectionAttempts: 2,
    });

    this.socket.on('connected', (data) => {
      console.log(data);
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
}
