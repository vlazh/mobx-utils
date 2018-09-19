import DisposableStore, { disposeMobxReactions } from './DisposableStore';

export default abstract class BaseStore<RS extends object> extends DisposableStore {
  constructor(protected readonly rootStore: RS) {
    super();
  }

  dispose() {
    super.dispose((name, value) => {
      if (name !== 'rootStore' && value instanceof DisposableStore) {
        value.dispose();
      } else {
        disposeMobxReactions(value);
      }
    });
  }
}
