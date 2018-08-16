import { action, observable, computed } from 'mobx';
import { Option } from 'funfix-core';
import { validate } from 'valtors';
import ValidableModel, { ValidationErrors } from './ValidableModel';
import StoreModel from './StoreModel';

export default class ValidableStoreModel<Entity> extends StoreModel<Entity>
  implements ValidableModel<Entity> {
  // Пустое значение (undefined) при инициализации, поэтому mobx не следит за присвоенными значениями в конструкторе.
  // validationErrors: E;

  constructor(public readonly errors: ValidationErrors<Entity>) {
    super();
    // Так как пустое значение при инициализации, клонируем объект и следим за ним.
    // Наследники должны принимать объект в конструкторе, чтобы не сбить слежение mobx.
    this.errors = observable.object(errors);
  }

  protected onModelChanged(name: keyof Entity) {
    super.onModelChanged(name);
    this.validate(name);
  }

  @computed
  get isValid() {
    return Object.keys(this.errors).every(key => this.errors[key].error.isEmpty());
  }

  @action
  validate(name?: keyof Entity): boolean {
    const result = validate(this, name);

    const safeResult = Object.keys(result).reduce((acc, key) => {
      acc[key] = { error: Option.of(result[key].error) };
      return acc;
    }, {});

    Object.assign(this.errors, safeResult);

    return name ? this.errors[name].error.isEmpty() : this.isValid;
  }
}
