import { Omit } from '@vzh/ts-types';
import { observable, computed, action } from 'mobx';
import Notification, { NotificationID, NotificationType } from './Notification';
import LoadableStore from './LoadableStore';
import { JSONModel } from './JSONSerializable';

export default class UIStore<RS extends object, S extends object = {}> extends LoadableStore<
  RS,
  S
> {
  @observable
  private notificationList: ReadonlyArray<Notification> = [];

  private readonly defaultNotificationTimeout: number;

  // To avoid mistakes at react rerenders by id use unique id's on all lifecircle.
  private lastNotificationId: number = 0;

  constructor(rootStore: RS, defaultNotificationTimeout: number = 0, initialState?: JSONModel<S>) {
    super(rootStore, initialState);

    this.defaultNotificationTimeout = defaultNotificationTimeout;

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
    if (this.lastNotificationId === Number.MAX_SAFE_INTEGER) {
      this.lastNotificationId = 0;
    }
    this.lastNotificationId += 1;
    const newId = this.lastNotificationId;
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
