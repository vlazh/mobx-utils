import { action, observable, computed } from 'mobx';
import { Option, None } from '@jstoolkit/utils/fp/Option';
import { validate } from 'valtors';
import type ValidableModel from './ValidableModel';
import type { ValidationErrors, ValidableEntity, KeysAction } from './ValidableModel';
import StoreModel from './StoreModel';

export type OnlyModelEntity<A extends AnyObject, ExcludeTypes = AnyFunction> = ExcludeKeysOfType<
  Diff<A, ValidableModel<A>>,
  ExcludeTypes
>;

export default class ValidableStoreModel<
    Entity extends AnyObject,
    PickOrOmit extends KeysAction = 'pick',
    Keys extends keyof OnlyModelEntity<Entity> = keyof OnlyModelEntity<Entity>
  >
  extends StoreModel<OnlyModelEntity<Entity>>
  implements ValidableModel<OnlyModelEntity<Entity>, PickOrOmit, Keys>
{
  readonly errors: ValidationErrors<ValidableEntity<OnlyModelEntity<Entity>, PickOrOmit, Keys>>;

  constructor(
    errors: ValidationErrors<ValidableEntity<OnlyModelEntity<Entity>, PickOrOmit, Keys>>
  ) {
    super();
    // Так как пустое значение при инициализации, клонируем объект и следим за ним.
    // Наследники должны принимать объект в конструкторе, чтобы не сбить слежение mobx.
    this.errors = observable.object(errors);
  }

  protected override onFieldChanged<K extends keyof OnlyModelEntity<Entity>>(
    name: K,
    prevValue: OnlyModelEntity<Entity>[K]
  ): void {
    super.onFieldChanged(name, prevValue);
    if (name in this.errors) {
      this.validate(
        name as unknown as keyof ValidableEntity<OnlyModelEntity<Entity>, PickOrOmit, Keys>
      );
    }
  }

  @computed
  get isValid(): boolean {
    return Object.keys(this.errors).every((key) => this.errors[key].error.isEmpty());
  }

  @action
  validate(name?: keyof ValidableEntity<OnlyModelEntity<Entity>, PickOrOmit, Keys>): boolean {
    const result = validate(
      this.target as unknown as ValidableEntity<OnlyModelEntity<Entity>, PickOrOmit, Keys>,
      name
    );

    const safeResult = Object.keys(result).reduce((acc, key) => {
      acc[key] = { error: Option.of(result[key].error) };
      return acc;
    }, {});

    Object.assign(this.errors, safeResult);

    return name ? this.errors[name].error.isEmpty() : this.isValid;
  }

  @action
  cleanErrors(): void {
    Object.getOwnPropertyNames(this.errors).forEach((prop) => {
      this.errors[prop] = { ...this.errors[prop], error: None };
    });
  }
}
