/* eslint-disable @typescript-eslint/unbound-method */
import { observable, computed, action } from 'mobx';
import BaseStore from './BaseStore';

export default abstract class LoadableStore<
  RS extends object,
  InitState extends object = {}
> extends BaseStore<RS, InitState> {
  @observable
  protected pendingRequestCount = 0; // For multiple requests

  constructor(rootStore: RS) {
    super(rootStore);
    this.setLoading = this.setLoading.bind(this);
  }

  /** true - while has at least 1 running request. */
  @computed
  get loading(): boolean {
    return this.pendingRequestCount > 0;
  }

  // /**
  //  * Increment or decrement running requests number.
  //  * In some cases (in async code?) get error: [mobx] The setter of computed value is trying to update itself...
  //  * https://github.com/mobxjs/mobx/blob/master/src/core/computedvalue.ts#L171
  //  */
  // set loading(value: boolean) {
  //   if (this.pendingRequestCount === 0 && !value) {
  //     return;
  //   }
  //   this.pendingRequestCount += value ? 1 : -1;
  // }

  /** Increment or decrement running requests number. */
  @action
  setLoading(value: boolean): void {
    console.log(this);
    if (this.pendingRequestCount === 0 && !value) {
      return;
    }
    this.pendingRequestCount += value ? 1 : -1;
  }
}
