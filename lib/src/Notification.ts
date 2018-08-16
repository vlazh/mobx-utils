export type NotificationID = string | number;

export enum NotificationType {
  error = 'error',
  warn = 'warn',
  info = 'info',
  success = 'success',
}

export default interface Notification {
  id: NotificationID;
  type: NotificationType | keyof typeof NotificationType;
  text: string;
  timeout?: number;
}
