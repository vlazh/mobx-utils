export type NotificationID = number;

export enum NotificationType {
  Info = 'info',
  Success = 'success',
  Error = 'error',
  Warning = 'warning',
}

export default interface Notification {
  id: NotificationID;
  type: NotificationType;
  text: string;
  timeout?: number;
}
