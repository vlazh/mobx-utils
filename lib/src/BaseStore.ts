import ReactionDisposer from './ReactionDisposer';
import { JSONModel } from './JSONSerializable';

export default abstract class BaseStore<
  RS extends object,
  InitState extends object = {}
> extends ReactionDisposer {
  protected readonly rootStore: RS;

  // @ts-ignore
  constructor(rootStore: RS, initialState?: JSONModel<InitState>) {
    super();
    this.rootStore = rootStore;
  }

  /** Call by rootStore after all children stores are created. */
  protected initialize(): void {}

  dispose(): void {
    super.dispose(name => name === 'rootStore');
  }
}
