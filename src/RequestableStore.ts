import { Throwable, Try } from '@vzh/ts-types/fp';
import Notification, { NotificationType } from './Notification';
import BaseStore from './BaseStore';
import UIStore from './UIStore';
import Validable from './Validable';
import { JSONModel } from './JSONSerializable';
import getErrorMessage from './getErrorMessage';

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
  disableLoading?: boolean;
  disableNotifications?: boolean;
  clearErrors?: boolean;
  clearNotifications?: boolean;
}

export default class RequestableStore<
  RS extends object,
  UIS extends UIStore<RS>,
  InitState extends object = {}
> extends BaseStore<RS, InitState> {
  readonly uiStore: UIS;

  constructor(rootStore: RS, uiStore: UIS, initialState?: JSONModel<InitState>) {
    super(rootStore, initialState);
    this.uiStore = uiStore;
    this.request = this.request.bind(this) as any;
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
    const { clearErrors, clearNotifications = true, disableLoading } = options;
    if (clearNotifications) {
      this.uiStore.cleanNotifications();
    } else if (clearErrors) {
      this.uiStore.cleanNotifications(NotificationType.Error);
    }
    if (!disableLoading) {
      this.uiStore.loading = true;
    }

    try {
      const result = await doWork(...(doWorkParams || []));
      this.onRequestSuccess(result, options);
      return Try.success(result);
    } catch (ex) {
      this.onRequestError(ex, options);
      return Try.failure(ex);
    } finally {
      if (!disableLoading) {
        this.uiStore.loading = false;
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
      this.uiStore.addNotification({
        type: NotificationType.Error,
        text: this.getErrorMessage(error),
        timeout: notificationTimeout,
      });
    }
  }
}
