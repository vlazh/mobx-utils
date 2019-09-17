/* eslint-disable class-methods-use-this, @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function */
import CleanerDisposer from './CleanerDisposer';
import { JSONModel } from '../serialization/JSONSerializable';

export default abstract class BaseStore<
  RS extends object,
  InitState extends object = {}
> extends CleanerDisposer {
  protected readonly rootStore: RS;

  constructor(rootStore: RS, _initialState?: JSONModel<InitState>) {
    super();
    this.rootStore = rootStore;
  }

  /** Call by rootStore after all children stores are created. */
  protected initialize(): void {}

  dispose(): void {
    super.dispose(name => name === 'rootStore');
  }

  clean(): void {
    super.clean(name => name === 'rootStore');
  }
}
