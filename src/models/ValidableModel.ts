import { Option } from '@vzh/ts-types/fp';
import Validable from './Validable';
import { ModelLike } from './Model';

export interface ErrorProvider {
  error: Option<string>;
}

export type ValidationErrors<Entity extends object> = Record<keyof Entity, ErrorProvider>;

export type ValidableEntity<Entity extends object, Keys extends keyof Entity = keyof Entity> = Pick<
  Entity,
  Keys
>;

export default interface ValidableModel<
  Entity extends object,
  Keys extends keyof Entity = keyof Entity
> extends ModelLike<Entity>, Validable {
  errors: ValidationErrors<ValidableEntity<Entity, Keys>>;
  readonly isValid: boolean;
  validate(name: Keys): boolean;
  validate(): boolean;
}
