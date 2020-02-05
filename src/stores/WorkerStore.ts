/* eslint-disable @typescript-eslint/unbound-method */
import { observable, action } from 'mobx';
import { computedFn } from 'mobx-utils';
import BaseStore from './BaseStore';

export type PendingTasks<TaskKeys extends string> = { default: number } & {
  [P in TaskKeys]?: number;
};

export default class WorkerStore<
  RS extends object,
  TaskKeys extends string = never
> extends BaseStore<RS> {
  @observable
  protected readonly pendingTasks: PendingTasks<TaskKeys> = { default: 0 };

  constructor(rootStore: RS) {
    super(rootStore);
    this.push = this.push.bind(this);
    this.pop = this.pop.bind(this);
  }

  /** true - while has at least 1 running task. */
  isPending = (() => {
    // Trick to get around inconsistent length of function arguments
    // because default parameters not present in arguments
    // https://github.com/mobxjs/mobx-utils/blob/master/src/deepMap.ts#L84
    const memoized = computedFn(function isPending(
      this: WorkerStore<RS, TaskKeys>,
      key: keyof PendingTasks<TaskKeys>
    ): boolean {
      // console.log('calc pending', key, this.pendingTasks[key]);
      return (this.pendingTasks[key] ?? 0) > 0;
    });
    return (key: keyof PendingTasks<TaskKeys> = 'default') => memoized.call(this, key);
  })();

  @action
  push(key: keyof PendingTasks<TaskKeys> = 'default'): void {
    // console.log('push', key);
    this.pendingTasks[key] = ((this.pendingTasks[key] ?? 0) + 1) as PendingTasks<
      TaskKeys
    >[typeof key];
  }

  @action
  pop(key: keyof PendingTasks<TaskKeys> = 'default'): void {
    // console.log('pop', key);
    const value = this.pendingTasks[key] as number;
    if (value == null || value === 0) return;
    this.pendingTasks[key] = (value - 1) as PendingTasks<TaskKeys>[typeof key];
  }

  @action
  clean(): void {
    super.clean();
    Object.getOwnPropertyNames(this.pendingTasks).forEach(key => {
      delete this.pendingTasks[key];
    });
    this.pendingTasks.default = 0;
  }
}
