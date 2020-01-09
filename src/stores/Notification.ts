export type NotificationID = number;

export enum NotificationType {
  Info = 'info',
  Success = 'success',
  Error = 'error',
  Warning = 'warning',
}

export default interface Notification<T = string> {
  id: NotificationID;
  type: NotificationType;
  text: T;
  timeout?: number;
}
