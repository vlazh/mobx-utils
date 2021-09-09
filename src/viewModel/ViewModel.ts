import { action } from 'mobx';
import { ViewModel as ViewModelOriginal } from 'mobx-utils';
import Model, { ModelLike, NameValue, InputEventLike } from '../model/Model';

export default class ViewModel<E extends AnyObject, T extends ModelLike<E>>
  extends ViewModelOriginal<T>
  implements ModelLike<E>
{
  protected storeModel = new Model<E>(this as any);

  constructor(model: T) {
    super(model);
    delete (this as Partial<ModelLike<E>>).changeField; // Remove copied method from `model` in order for override it.
  }

  @action.bound
  changeField<K extends keyof E>(event: InputEventLike | NameValue<E, K>): void {
    this.storeModel.changeField(event);
  }
}
