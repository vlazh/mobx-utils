import ReactionDisposer from './ReactionDisposer';

export default abstract class BaseStore<RS extends object> extends ReactionDisposer {
  constructor(protected readonly rootStore: RS) {
    super();
  }

  /** Call by rootStore after all children stores are created. */
  protected initialize(): void {}

  dispose(): void {
    super.dispose(name => name === 'rootStore');
  }
}
