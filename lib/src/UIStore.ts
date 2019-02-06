import { Omit } from '@vzh/ts-types';
import { observable, computed, action } from 'mobx';
import Notification, { NotificationID, NotificationType } from './Notification';
import LoadableStore from './LoadableStore';

export default class UIStore<RS extends object> extends LoadableStore<RS> {
  @observable
  private notificationList: ReadonlyArray<Notification> = [];

  constructor(rootStore: RS, private defaultNotificationTimeout?: number) {
    super(rootStore);

    this.addNotification = this.addNotification.bind(this);
    this.closeNotification = this.closeNotification.bind(this);
    this.cleanNotifications = this.cleanNotifications.bind(this);
  }

  @computed
  get notifications(): ReadonlyArray<Notification> {
    return this.notificationList;
  }

  @computed
  get hasError(): boolean {
    return this.notificationList.some(n => n.type === NotificationType.error);
  }

  @action
  addNotification(notification: Omit<Notification, 'id'>): Notification['id'] {
    const newId = this.notificationList.length + 1;
    this.notificationList = this.notificationList.concat({ ...notification, id: newId });

    const timeout =
      notification.timeout == null ? this.defaultNotificationTimeout : notification.timeout;
    if (timeout) {
      setTimeout(() => this.closeNotification(newId), timeout);
    }

    return newId;
  }

  @action
  closeNotification(id: NotificationID): void {
    this.notificationList = this.notificationList.filter(_ => _.id !== id);
  }

  @action
  cleanNotifications(type?: NotificationType): void {
    this.notificationList = type ? this.notificationList.filter(_ => _.type !== type) : [];
  }
}
