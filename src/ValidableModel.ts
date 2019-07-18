import { Option } from '@vzh/ts-types/fp';
import Validable from './Validable';
import { ModelLike } from './Model';

export interface ErrorProvider {
  error: Option<string>;
}

export type ValidationErrors<Entity extends object> = Record<keyof Entity, ErrorProvider>;

export default interface ValidableModel<Entity extends object>
  extends ModelLike<Entity>,
    Validable {
  errors: ValidationErrors<Entity>;
  readonly isValid: boolean;
  validate(name: keyof Entity): boolean;
  validate(): boolean;
}
