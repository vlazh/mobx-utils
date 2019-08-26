import { observable, computed, action } from 'mobx';
import Notification, { NotificationType } from './Notification';
import LoadableStore from './LoadableStore';
import { JSONModel } from './JSONSerializable';

export default class UIStore<
  RS extends object,
  InitState extends object = {},
  N extends Notification = Notification
> extends LoadableStore<RS, InitState> {
  @observable
  private notificationList: ReadonlyArray<N> = [];

  private readonly defaultNotificationTimeout: number;

  // To avoid mistakes at react rerenders by id use unique id's on all lifecircle.
  private lastNotificationId: number = 0;

  constructor(
    rootStore: RS,
    defaultNotificationTimeout: number = 0,
    initialState?: JSONModel<InitState>
  ) {
    super(rootStore, initialState);

    this.defaultNotificationTimeout = defaultNotificationTimeout;

    this.addNotification = this.addNotification.bind(this);
    this.closeNotification = this.closeNotification.bind(this);
    this.cleanNotifications = this.cleanNotifications.bind(this);
  }

  @computed
  get notifications(): ReadonlyArray<N> {
    return this.notificationList;
  }

  @computed
  get hasError(): boolean {
    return this.notificationList.some(n => n.type === NotificationType.Error);
  }

  @action
  addNotification(notification: Omit<N, 'id'>): N['id'] {
    if (this.lastNotificationId === Number.MAX_SAFE_INTEGER) {
      this.lastNotificationId = 0;
    }
    this.lastNotificationId += 1;
    const newId = this.lastNotificationId;
    this.notificationList = this.notificationList.concat({ ...notification, id: newId } as N);

    const timeout =
      notification.timeout == null ? this.defaultNotificationTimeout : notification.timeout;
    if (timeout) {
      setTimeout(() => this.closeNotification(newId), timeout);
    }

    return newId;
  }

  @action
  closeNotification(id: N['id']): void {
    this.notificationList = this.notificationList.filter(_ => _.id !== id);
  }

  @action
  cleanNotifications(type?: N['type']): void {
    this.notificationList = type ? this.notificationList.filter(_ => _.type !== type) : [];
  }
}
