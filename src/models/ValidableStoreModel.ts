import { action, observable, computed } from 'mobx';
import { Option, None } from '@vzh/ts-types/fp';
import { Diff, ExcludeKeysOfType } from '@vzh/ts-types';
import { validate } from 'valtors';
import ValidableModel, { ValidationErrors, ValidableEntity } from './ValidableModel';
import StoreModel from './StoreModel';

export type OnlyModelEntity<A extends object> = ExcludeKeysOfType<
  Diff<A, ValidableModel<A>>,
  Function
>;

export default class ValidableStoreModel<
  Entity extends object,
  Keys extends keyof OnlyModelEntity<Entity> = keyof OnlyModelEntity<Entity>
> extends StoreModel<OnlyModelEntity<Entity>>
  implements ValidableModel<OnlyModelEntity<Entity>, Keys> {
  readonly errors: ValidationErrors<ValidableEntity<OnlyModelEntity<Entity>, Keys>>;

  constructor(errors: ValidationErrors<ValidableEntity<OnlyModelEntity<Entity>, Keys>>) {
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
    if (name in this.errors) {
      this.validate((name as unknown) as Keys);
    }
  }

  @computed
  get isValid(): boolean {
    return Object.keys(this.errors).every(key => this.errors[key].error.isEmpty());
  }

  @action
  validate(name?: Keys): boolean {
    const result = validate(this.target, name);

    const safeResult = Object.keys(result).reduce((acc, key) => {
      acc[key] = { error: Option.of(result[key].error) };
      return acc;
    }, {});

    Object.assign(this.errors, safeResult);

    return name ? this.errors[name].error.isEmpty() : this.isValid;
  }

  @action
  cleanErrors(): void {
    Object.getOwnPropertyNames(this.errors).forEach(prop => {
      this.errors[prop] = { ...this.errors[prop], error: None };
    });
  }
}
