import ReactionDisposer from './ReactionDisposer';
import BaseStore from './BaseStore';

/* eslint-disable dot-notation */

export default abstract class BaseRootStore extends ReactionDisposer {
  private initStore(store: BaseStore<any> | BaseRootStore) {
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
  protected initialize() {
    this.initStore(this);
  }
}
