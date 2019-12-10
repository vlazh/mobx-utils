import { Option } from '@vzh/ts-types/fp';
import Validable from './Validable';
import { ModelLike } from './Model';

export interface ErrorProvider {
  error: Option<string>;
}

export type ValidationErrors<Entity extends object> = Record<keyof Entity, ErrorProvider>;

export type KeysAction = 'pick' | 'omit';

export type ValidableEntity<
  Entity extends object,
  PickOrOmit extends KeysAction = 'pick',
  Keys extends keyof Entity = PickOrOmit extends 'pick' ? keyof Entity : never
> = PickOrOmit extends 'pick' ? Pick<Entity, Keys> : Omit<Entity, Keys>;

export default interface ValidableModel<
  Entity extends object,
  PickOrOmit extends KeysAction = 'pick',
  Keys extends keyof Entity = PickOrOmit extends 'pick' ? keyof Entity : never
> extends ModelLike<Entity>, Validable {
  errors: ValidationErrors<ValidableEntity<Entity, PickOrOmit, Keys>>;
  readonly isValid: boolean;
  validate(name: keyof ValidableEntity<Entity, PickOrOmit, Keys>): boolean;
  validate(): boolean;
}
