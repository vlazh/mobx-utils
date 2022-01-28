import type { IViewModel } from 'mobx-utils';
import type Model from '../model/Model';
import type { ModelLike } from '../model/Model';
import ViewModel from './ViewModel';

export type ViewModelLike<T> = T extends ModelLike<infer E>
  ? E & ModelLike<E> & IViewModel<T>
  : never;

export default function createViewModel<E extends AnyObject, T extends Model<E>>(
  model: T
): ViewModelLike<T> {
  return new ViewModel<E, T>(model) as unknown as ViewModelLike<T>;
}
