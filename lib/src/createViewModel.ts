import { action } from 'mobx';
import { ViewModel as ViewModelOriginal, IViewModel } from 'mobx-utils';
import { Omit } from 'typelevel-ts';
import Model, { ModelLike, NameValue, InputEventLike } from './Model';

export interface ViewModelLike<T extends ModelLike> extends ModelLike, IViewModel<T> {}

export class ViewModel<T extends ModelLike> extends ViewModelOriginal<T>
  implements ViewModelLike<T> {
  protected storeModel = new Model<T>(this);

  constructor(model: T) {
    super(model);
    delete this.changeField; // remove copied method from `model`
  }

  @action.bound
  changeField(event: NameValue | InputEventLike): void {
    this.storeModel.changeField(event);
  }
}

export default function createViewModel<T extends ModelLike>(
  model: T
): Omit<T, keyof ModelLike> & ViewModelLike<T> {
  return new ViewModel(model) as any;
}
