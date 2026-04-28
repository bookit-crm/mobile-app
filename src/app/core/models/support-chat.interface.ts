export enum EChatStatus {
  Open = 'open',
  Closed = 'closed',
}

export enum ESenderType {
  User = 'user',
  Operator = 'operator',
}

export interface ISupportChat {
  _id: string;
  appUserId: string;
  dataBaseId: string;
  status: EChatStatus;
  telegramChatId: number | null;
  telegramTopicMessageId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ISupportMessage {
  _id: string;
  chatId: string;
  senderType: ESenderType;
  text: string;
  telegramMessageId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ISendMessagePayload {
  chatId?: string;
  text: string;
}

export interface ISendMessageResponse {
  chat: ISupportChat;
  message: ISupportMessage;
}

export interface ISupportChatFilters {
  status?: EChatStatus;
  appUserId?: string;
  offset?: string;
  limit?: string;
}

export interface ISupportChatWsMessage {
  _id: string;
  chatId: string;
  senderType: ESenderType;
  text: string;
  createdAt: string;
}

