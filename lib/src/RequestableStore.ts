import { action } from 'mobx';
import { Throwable, Try } from 'funfix-core';
import { NotificationType } from './Notification';
import ValidableModel from './ValidableModel';
import LocalUIStore from './LocalUIStore';
import BaseStore from './BaseStore';

export interface ResponseLike {
  data?: any;
  status?: number;
  statusText?: string;
}

export interface ResponseErrorLike {
  config: any;
  response: any;
}

export interface AsyncAction<T> {
  (): Promise<T>;
}

export function isResponseError(error: ResponseErrorLike | Throwable): error is ResponseErrorLike {
  return (error as ResponseErrorLike).config !== undefined;
}

export default class RequestableStore<RS, UIS extends LocalUIStore<RS>> extends BaseStore<RS> {
  constructor(rootStore: RS, public uiStore: UIS) {
    super(rootStore);
    this.request = this.request.bind(this);
    this.onRequestSuccess = this.onRequestSuccess.bind(this);
    this.onRequestError = this.onRequestError.bind(this);
  }

  @action
  protected async doRequest<R>(doWork: AsyncAction<R>): Promise<Try<R>> {
    this.uiStore.cleanNotifications(NotificationType.error);
    this.uiStore.loading = true;

    try {
      const result = await doWork();
      return Try.of(() => this.onRequestSuccess(result));
    } catch (ex) {
      this.onRequestError(ex);
      return Try.failure(ex);
    }
  }

  @action
  request<R>(doWork: AsyncAction<R>): Promise<Try<R>> {
    return this.doRequest(doWork);
  }

  @action
  submit<E, R>(model: ValidableModel<E>, doWork: AsyncAction<R>): Promise<Try<R>> {
    if (!model.validate()) {
      return Promise.resolve(Try.failure(new Error('`model` is in invalid state.')));
    }
    return this.doRequest(doWork);
  }

  @action
  protected onRequestSuccess<R>(result: R): R {
    this.uiStore.loading = false;
    this.uiStore.cleanNotifications(NotificationType.error);
    return result;
  }

  protected getResponseErrorMessage(response: ResponseLike): string {
    return response.data || response.statusText;
  }

  protected getErrorMessage(error: ResponseErrorLike | Throwable): string {
    return isResponseError(error) && error.response
      ? this.getResponseErrorMessage(error.response)
      : error.toString();
  }

  @action
  protected onRequestError(error: ResponseErrorLike | Throwable) {
    this.uiStore.loading = false;
    console.error(error);

    this.uiStore.cleanNotifications(NotificationType.error);
    this.uiStore.addNotification({
      type: NotificationType.error,
      text: this.getErrorMessage(error),
    });
  }
}
