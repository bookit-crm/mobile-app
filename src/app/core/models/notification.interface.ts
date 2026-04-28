import { ENotificationCategory } from '@core/enums/e-notification';

export interface INotification {
  _id: string;
  title: string;
  message: string;
  category: ENotificationCategory;
  isRead: boolean;
  department?: string;
  relatedEntityId?: string;
  relatedEntityType?: string;
  createdAt: string;
  updatedAt: string;
}

