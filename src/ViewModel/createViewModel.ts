import { IViewModel } from 'mobx-utils';
import Model, { ModelLike } from '../Model';
import ViewModel from './ViewModel';

export type ViewModelLike<T> = T extends ModelLike<infer E>
  ? (E & ModelLike<E> & IViewModel<T>)
  : never;

export default function createViewModel<E extends object, T extends Model<E>>(
  model: T
): ViewModelLike<T> {
  return new ViewModel<E, T>(model) as ViewModelLike<T>;
}
