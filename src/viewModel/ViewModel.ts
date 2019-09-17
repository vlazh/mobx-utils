import { action } from 'mobx';
import { ViewModel as ViewModelOriginal } from 'mobx-utils';
import Model, { ModelLike, NameValue, InputEventLike } from '../models/Model';

export default class ViewModel<E extends object, T extends ModelLike<E>>
  extends ViewModelOriginal<T>
  implements ModelLike<E> {
  protected storeModel = new Model<E>(this as any);

  constructor(model: T) {
    super(model);
    delete this.changeField; // Remove copied method from `model` in order for override it.
  }

  @action.bound
  changeField<K extends keyof E>(event: NameValue<E, K> | InputEventLike): void {
    this.storeModel.changeField(event);
  }
}
