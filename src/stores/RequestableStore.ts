/* eslint-disable @typescript-eslint/unbound-method */
import { Throwable, Try } from '@vzh/ts-types/fp';
import Notification, { NotificationType } from './Notification';
import Validable from '../models/Validable';
import getErrorMessage from './getErrorMessage';
import NotificationsStore from './NotificationsStore';
import WorkerStore from './WorkerStore';
import BaseStore from './BaseStore';

export interface ResponseLike {
  data?: any;
  status?: number;
  statusText?: string;
}

export interface ErrorResponseLike {
  config: any;
  response: ResponseLike;
}

export interface AsyncAction<T> {
  (...params: any[]): Promise<T>;
}

export function isErrorResponseLike(
  error: ErrorResponseLike | Throwable
): error is ErrorResponseLike {
  return (error as ErrorResponseLike).config !== undefined;
}

export interface RequestOptions {
  notificationTimeout?: Notification['timeout'];
  disablePending?: boolean;
  disableNotifications?: boolean;
  deleteErrors?: boolean;
  deleteNotifications?: boolean;
}

export default class RequestableStore<
  RS extends object,
  NS extends NotificationsStore<RS, Notification<any>> = NotificationsStore<
    RS,
    Notification<string>
  >,
  WS extends WorkerStore<RS, never> = WorkerStore<RS, never>
> extends BaseStore<RS> {
  readonly worker: WS;

  readonly notifications: NS;

  constructor(rootStore: RS, notifications: NS, tasks: WS) {
    super(rootStore);
    this.notifications = notifications;
    this.worker = tasks;
    this.request = this.request.bind(this);
    this.onRequestSuccess = this.onRequestSuccess.bind(this);
    this.onRequestError = this.onRequestError.bind(this);
  }

  // Used Try for always return successed promise but keep error if has.
  // If just use promise with error and not use catch in client code then warning in console.
  protected async request<R>(
    doWork: AsyncAction<R>,
    doWorkParams?: any[],
    options: RequestOptions = {}
  ): Promise<Try<R>> {
    const { deleteErrors, deleteNotifications, disablePending } = options;
    if (deleteNotifications) {
      this.notifications.deleteAll();
    } else if (deleteErrors) {
      this.notifications.deleteAll(NotificationType.Error);
    }
    if (!disablePending) {
      this.worker.push();
    }

    try {
      const result = await doWork(...(doWorkParams || []));
      this.onRequestSuccess(result, options);
      return Try.success(result);
    } catch (ex) {
      this.onRequestError(ex, options);
      return Try.failure(ex);
    } finally {
      if (!disablePending) {
        this.worker.pop();
      }
    }
  }

  protected submit<R>(
    model: Validable,
    doWork: AsyncAction<R>,
    doWorkParams?: any[],
    options: RequestOptions = {}
  ): Promise<Try<R>> {
    if (!model.validate()) {
      return Promise.resolve(Try.failure(new Error('`model` is in invalid state.')));
    }
    return this.request<R>(doWork, doWorkParams, options);
  }

  // eslint-disable-next-line class-methods-use-this, @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function
  protected onRequestSuccess<R>(_result: R, _options: RequestOptions = {}): void {}

  // eslint-disable-next-line class-methods-use-this
  protected getResponseErrorMessage(response: ResponseLike): string {
    return response.data || response.statusText;
  }

  // eslint-disable-next-line class-methods-use-this
  protected getThrowableMessage(error: Throwable): string {
    return getErrorMessage(error);
  }

  protected getErrorMessage(error: ErrorResponseLike | Throwable): string {
    return isErrorResponseLike(error) && error.response
      ? this.getResponseErrorMessage(error.response)
      : this.getThrowableMessage(error);
  }

  protected onRequestError(
    error: ErrorResponseLike | Throwable,
    { disableNotifications, notificationTimeout }: RequestOptions = {}
  ): void {
    console.error(error);

    if (!disableNotifications) {
      this.notifications.add({
        type: NotificationType.Error,
        text: this.getErrorMessage(error),
        timeout: notificationTimeout,
      });
    }
  }
}
