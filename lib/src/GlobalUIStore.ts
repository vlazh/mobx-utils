import { observable } from 'mobx';
import Notification from './Notification';
import UIBaseStore from './UIBaseStore';

export interface GlobalNotifications {
  [P: string]: Notification[];
}

export default class GlobalUIStore<RS> extends UIBaseStore<RS, GlobalNotifications> {
  @observable
  notifications: GlobalNotifications = { default: [] };

  cleanNotifications(name?: string) {
    if (name) {
      this.notifications[name] = [];
      return;
    }

    this.notifications = { default: [] };
  }
}
