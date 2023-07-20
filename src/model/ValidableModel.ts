import type { Option } from '@jstoolkit/utils/fp/Option';
import type Validable from './Validable';
import type { ModelLike } from './Model';

export interface ErrorProvider {
  error: Option<string>;
}

export type ValidationErrors<Entity extends AnyObject> = Record<keyof Entity, ErrorProvider>;

export type KeysAction = 'pick' | 'omit';

export type ValidableEntity<
  Entity extends AnyObject,
  PickOrOmit extends KeysAction = 'pick',
  Keys extends keyof Entity = PickOrOmit extends 'pick' ? keyof Entity : never,
> = Keys extends never
  ? Entity
  : PickOrOmit extends 'pick'
  ? Pick<Entity, Keys>
  : Omit<Entity, Keys>;

export default interface ValidableModel<
  Entity extends AnyObject,
  PickOrOmit extends KeysAction = 'pick',
  Keys extends keyof Entity = PickOrOmit extends 'pick' ? keyof Entity : never,
> extends ModelLike<Entity>,
    Validable {
  errors: ValidationErrors<ValidableEntity<Entity, PickOrOmit, Keys>>;
  readonly isValid: boolean;
  validate(name: keyof ValidableEntity<Entity, PickOrOmit, Keys>): boolean;
  validate(): boolean;
}
