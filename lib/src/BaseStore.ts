import ReactionDisposer from './ReactionDisposer';

export default abstract class BaseStore<RS extends object> extends ReactionDisposer {
  protected readonly rootStore: RS;

  constructor(rootStore: RS) {
    super();
    this.rootStore = rootStore;
  }

  /** Call by rootStore after all children stores are created. */
  protected initialize(): void {}

  dispose(): void {
    super.dispose(name => name === 'rootStore');
  }
}
