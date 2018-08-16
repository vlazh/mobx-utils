import { observable, computed } from 'mobx';
import { Omit } from './types';
import Notification, { NotificationID, NotificationType } from './Notification';
import UIBaseStore from './UIBaseStore';

export default class LocalUIStore<RS> extends UIBaseStore<RS, ReadonlyArray<Notification>> {
  // @observable notifications: Notification[] = [];
  @observable
  private notificationList: Notification[] = [];

  constructor(rootStore: RS) {
    super(rootStore);

    this.addNotification = this.addNotification.bind(this);
    this.closeNotification = this.closeNotification.bind(this);
    this.cleanNotifications = this.cleanNotifications.bind(this);
  }

  // @computed
  get notifications(): ReadonlyArray<Notification> {
    return this.notificationList;
  }

  @computed
  get hasError() {
    return this.notificationList.some(n => n.type === NotificationType.error);
  }

  addNotification(notification: Omit<Notification, 'id'>) {
    const newId = this.notificationList.length + 1;
    this.notificationList.push({ id: newId, ...notification });

    if (notification.timeout) {
      setTimeout(() => this.closeNotification(newId), notification.timeout);
    }
  }

  closeNotification(id: NotificationID) {
    this.notificationList = this.notificationList.filter(_ => _.id !== id);
  }

  cleanNotifications(type?: NotificationType) {
    this.notificationList = type ? this.notificationList.filter(_ => _.type !== type) : [];
  }
}
