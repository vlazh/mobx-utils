/* eslint-disable dot-notation */
import ReactionDisposer from './ReactionDisposer';
import BaseStore from './BaseStore';
import { JSONModel } from './JSONSerializable';

export default abstract class BaseRootStore<S extends object = {}> extends ReactionDisposer {
  // @ts-ignore
  constructor(initialState?: JSONModel<S>) {
    super();
  }

  private initStore(store: BaseStore<any> | BaseRootStore): void {
    Object.values(store).forEach(value => {
      if (value === store) return; // Skip self referencies. For example, `jsonModel` in `SerializableModel`.
      if (value instanceof BaseStore) this.initStore(value);
    });
    if (store !== this && store instanceof BaseStore && typeof store['initialize'] === 'function') {
      try {
        store['initialize']();
      } catch (ex) {
        console.error(ex);
      }
    }
  }

  /** Initialize all child stores recursively. */
  protected initialize(): void {
    this.initStore(this);
  }
}
