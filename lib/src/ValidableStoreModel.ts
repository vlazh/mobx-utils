import { action, observable, computed } from 'mobx';
import { Option } from 'funfix-core';
import { validate } from 'valtors';
import ValidableModel, { ValidationErrors } from './ValidableModel';
import StoreModel from './StoreModel';
import { NameValue } from './Model';

export default class ValidableStoreModel<Entity extends object> extends StoreModel<Entity>
  implements ValidableModel<Entity> {
  constructor(public readonly errors: ValidationErrors<Entity>) {
    super();
    // Так как пустое значение при инициализации, клонируем объект и следим за ним.
    // Наследники должны принимать объект в конструкторе, чтобы не сбить слежение mobx.
    this.errors = observable.object(errors);
  }

  protected onModelChanged<K extends keyof Entity>(
    name: NameValue<Entity, K>['name'],
    prevValue: NameValue<Entity, K>['value']
  ) {
    super.onModelChanged(name, prevValue);
    this.validate(name);
  }

  @computed
  get isValid() {
    return Object.keys(this.errors).every(key => this.errors[key].error.isEmpty());
  }

  @action
  validate<K extends keyof Entity>(name?: NameValue<Entity, K>['name']): boolean {
    const result = validate(this, name);

    const safeResult = Object.keys(result).reduce((acc, key) => {
      acc[key] = { error: Option.of(result[key].error) };
      return acc;
    }, {});

    Object.assign(this.errors, safeResult);

    return name ? this.errors[name as PropertyKey].error.isEmpty() : this.isValid;
  }
}
