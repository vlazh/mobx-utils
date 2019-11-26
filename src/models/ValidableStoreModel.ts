import { action, observable, computed } from 'mobx';
import { Option } from '@vzh/ts-types/fp';
import { Diff, ExcludeKeysOfType } from '@vzh/ts-types';
import { validate } from 'valtors';
import ValidableModel, { ValidationErrors } from './ValidableModel';
import StoreModel from './StoreModel';

export type OnlyModelEntity<A extends object> = ExcludeKeysOfType<
  Diff<A, ValidableModel<A>>,
  Function
>;

export default class ValidableStoreModel<Entity extends object>
  extends StoreModel<OnlyModelEntity<Entity>>
  implements ValidableModel<OnlyModelEntity<Entity>> {
  readonly errors: ValidationErrors<OnlyModelEntity<Entity>>;

  constructor(errors: ValidationErrors<OnlyModelEntity<Entity>>) {
    super();
    // Так как пустое значение при инициализации, клонируем объект и следим за ним.
    // Наследники должны принимать объект в конструкторе, чтобы не сбить слежение mobx.
    this.errors = observable.object(errors);
  }

  protected onModelChanged<K extends keyof OnlyModelEntity<Entity>>(
    name: K,
    prevValue: OnlyModelEntity<Entity>[K]
  ): void {
    super.onModelChanged(name, prevValue);
    this.validate(name);
  }

  @computed
  get isValid(): boolean {
    return Object.keys(this.errors).every(key => this.errors[key].error.isEmpty());
  }

  @action
  validate(name?: keyof OnlyModelEntity<Entity>): boolean {
    const result = validate(this.target, name);

    const safeResult = Object.keys(result).reduce((acc, key) => {
      acc[key] = { error: Option.of(result[key].error) };
      return acc;
    }, {});

    Object.assign(this.errors, safeResult);

    return name ? this.errors[name].error.isEmpty() : this.isValid;
  }
}
