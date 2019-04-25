import ReactionDisposer from './ReactionDisposer';
import { JSONModel } from './JSONSerializable';

export default abstract class BaseStore<
  RS extends object,
  S extends object = {}
> extends ReactionDisposer {
  protected readonly rootStore: RS;

  // @ts-ignore
  constructor(rootStore: RS, initialState?: JSONModel<S>) {
    super();
    this.rootStore = rootStore;
  }

  /** Call by rootStore after all children stores are created. */
  protected initialize(): void {}

  dispose(): void {
    super.dispose(name => name === 'rootStore');
  }
}
