import DisposableStore from './DisposableStore';
import { isInitializable } from './Initializable';
import BaseStore from './BaseStore';

export default abstract class BaseRootStore extends DisposableStore {
  private initStore(store: BaseStore<any> | BaseRootStore) {
    Object.values(store).forEach(value => {
      if (value instanceof BaseStore) this.initStore(value);
    });
    if (isInitializable(store)) {
      try {
        store.init();
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
