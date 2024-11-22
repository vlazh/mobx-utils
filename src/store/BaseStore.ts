import CleanerDisposer from './CleanerDisposer';

export default abstract class BaseStore<RS extends AnyObject>
  extends CleanerDisposer
  implements Disposable
{
  protected readonly rootStore: RS;

  constructor(rootStore: RS) {
    super();
    this.rootStore = rootStore;
  }

  /** Call by rootStore after all children stores are created. */
  // eslint-disable-next-line class-methods-use-this, @typescript-eslint/no-empty-function
  protected initialize(): void {}

  override clean(): void {
    super.clean((name) => name === 'rootStore');
  }

  override dispose(): void {
    super.dispose((name) => name === 'rootStore');
  }

  [Symbol.dispose](): void {
    return this.dispose();
  }
}
