import { Try } from '@jstoolkit/utils/fp/Try';
import getErrorMessage from '@jstoolkit/utils/getErrorMessage';
import type Validable from '../model/Validable';
import type NotificationsStore from './NotificationsStore';
import type { Notification } from './NotificationsStore';
import type WorkerStore from './WorkerStore';
import type { PendingTasks } from './WorkerStore';
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

export function isErrorResponseLike(error: unknown): error is ErrorResponseLike {
  return (error as ErrorResponseLike).config !== undefined;
}

export interface RequestOptions<TaskKeys extends string> {
  notificationTimeout?: Notification['timeout'];
  pending?: boolean | keyof PendingTasks<TaskKeys>;
  disableNotifications?: boolean;
  deleteErrors?: boolean;
  deleteNotifications?: boolean;
}

export default class RequestableStore<
  RS extends AnyObject,
  NS extends NotificationsStore<RS, Notification<any, any>> = NotificationsStore<RS, Notification>,
  WS extends WorkerStore<RS, any> = WorkerStore<RS, any>
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
    doWorkParams?: unknown[],
    options: RequestOptions<WS extends WorkerStore<any, infer TaskKeys> ? TaskKeys : never> = {}
  ): Promise<Try<R>> {
    const { deleteErrors, deleteNotifications, pending } = options;
    if (deleteNotifications) {
      this.notifications.deleteAll();
    } else if (deleteErrors) {
      this.notifications.deleteAll('error');
    }
    if (pending == null || pending) {
      this.worker.push(pending === true ? undefined : pending || undefined);
    }

    try {
      const result = await doWork(...(doWorkParams || []));
      this.onRequestSuccess(result, options);
      return Try.success(result);
    } catch (ex: unknown) {
      this.onRequestError(ex, options);
      return Try.failure(ex);
    } finally {
      if (pending == null || pending) {
        this.worker.pop(pending === true ? undefined : pending || undefined);
      }
    }
  }

  protected submit<R>(
    model: Validable,
    doWork: AsyncAction<R>,
    doWorkParams?: any[],
    options: RequestOptions<WS extends WorkerStore<any, infer TaskKeys> ? TaskKeys : never> = {}
  ): Promise<Try<R>> {
    if (!model.validate()) {
      return Promise.resolve(Try.failure(new Error('`model` is in invalid state.')));
    }
    return this.request<R>(doWork, doWorkParams, options);
  }

  // eslint-disable-next-line class-methods-use-this
  protected onRequestSuccess<R>(
    _result: R,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _options: RequestOptions<WS extends WorkerStore<any, infer TaskKeys> ? TaskKeys : never> = {}
    // eslint-disable-next-line @typescript-eslint/no-empty-function
  ): void {}

  // eslint-disable-next-line class-methods-use-this
  protected getResponseErrorMessage(response: ResponseLike): string {
    return ((response.data != null && String(response.data)) || response.statusText) ?? '';
  }

  // eslint-disable-next-line class-methods-use-this
  protected getThrowableMessage(error: unknown): string {
    return getErrorMessage(error);
  }

  protected getErrorMessage(error: unknown): string {
    return isErrorResponseLike(error) && error.response
      ? this.getResponseErrorMessage(error.response)
      : this.getThrowableMessage(error);
  }

  protected onRequestError(
    error: unknown,
    {
      disableNotifications,
      notificationTimeout,
    }: RequestOptions<WS extends WorkerStore<any, infer TaskKeys> ? TaskKeys : never> = {}
  ): void {
    console.error(error);

    if (!disableNotifications) {
      this.notifications.add({
        type: 'error',
        content: this.getErrorMessage(error),
        timeout: notificationTimeout,
      });
    }
  }
}
