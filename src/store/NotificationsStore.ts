import { observable, computed, action } from 'mobx';
import BaseStore from './BaseStore';

export type NotificationID = number;

export interface Notification<TType extends 'error' = 'error', TContent = string> {
  id: NotificationID;
  type: TType;
  content: TContent;
  timeout?: number | undefined;
}

export default class NotificationsStore<
  RS extends AnyObject,
  N extends Notification<any, any> = Notification,
> extends BaseStore<RS> {
  @observable
  protected notifications: readonly N[] = [];

  protected readonly defaultNotificationTimeout: number;

  // To avoid mistakes at react rerenders by id use unique id's on all lifecircle.
  private lastNotificationId = 0;

  constructor(rootStore: RS, defaultNotificationTimeout = 0) {
    super(rootStore);
    this.defaultNotificationTimeout = defaultNotificationTimeout;
    this.add = this.add.bind(this);
    this.delete = this.delete.bind(this);
    this.clean = this.clean.bind(this);
  }

  // @computed
  // get notifications(): readonly N[] {
  //   return this.notificationList;
  // }

  get(): readonly N[] {
    return this.notifications;
  }

  @computed
  get hasError(): boolean {
    return this.notifications.some((n) => n.type === 'error');
  }

  @action
  add(notification: Omit<N, 'id'>, prepend = false): N['id'] {
    if (this.lastNotificationId === Number.MAX_SAFE_INTEGER) {
      this.lastNotificationId = 0;
    }
    this.lastNotificationId += 1;
    const newId = this.lastNotificationId;

    this.notifications = prepend
      ? [{ ...notification, id: newId } as N].concat(this.notifications)
      : this.notifications.concat({ ...notification, id: newId } as N);

    const timeout =
      notification.timeout == null ? this.defaultNotificationTimeout : notification.timeout;
    if (timeout) {
      // todo: clean timer on delete notification
      setTimeout(() => this.delete(newId), timeout);
    }

    return newId;
  }

  @action
  delete(id: N['id']): void {
    this.notifications = this.notifications.filter((_) => _.id !== id);
  }

  @action
  deleteAll(type?: N['type']): void {
    this.notifications = type ? this.notifications.filter((_) => _.type !== type) : [];
  }

  @action
  override clean(): void {
    super.clean();
    this.deleteAll();
  }
}
