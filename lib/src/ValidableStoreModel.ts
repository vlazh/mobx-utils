import { action, observable, computed } from 'mobx';
import { Option } from '@vzh/ts-types/fp';
import { Diff } from '@vzh/ts-types';
import { validate } from 'valtors';
import ValidableModel, { ValidationErrors } from './ValidableModel';
import StoreModel from './StoreModel';

type OnlyEntity<A extends object> = Diff<A, ValidableModel<A> & StoreModel<A>>;

export default class ValidableStoreModel<Entity extends object>
  extends StoreModel<OnlyEntity<Entity>>
  implements ValidableModel<OnlyEntity<Entity>> {
  readonly errors: ValidationErrors<OnlyEntity<Entity>>;

  constructor(errors: ValidationErrors<OnlyEntity<Entity>>) {
    super();
    // Так как пустое значение при инициализации, клонируем объект и следим за ним.
    // Наследники должны принимать объект в конструкторе, чтобы не сбить слежение mobx.
    this.errors = observable.object(errors);
  }

  protected onModelChanged<K extends keyof OnlyEntity<Entity>>(
    name: K,
    prevValue: OnlyEntity<Entity>[K]
  ): void {
    super.onModelChanged(name, prevValue);
    this.validate(name);
  }

  @computed
  get isValid(): boolean {
    return Object.keys(this.errors).every(key => this.errors[key].error.isEmpty());
  }

  @action
  validate(name?: keyof OnlyEntity<Entity>): boolean {
    const result = validate(this, name);

    const safeResult = Object.keys(result).reduce((acc, key) => {
      acc[key] = { error: Option.of(result[key].error) };
      return acc;
    }, {});

    Object.assign(this.errors, safeResult);

    return name ? this.errors[name].error.isEmpty() : this.isValid;
  }
}
