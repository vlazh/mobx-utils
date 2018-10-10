import { Option } from 'funfix-core';
import { NameValue } from './Model';

export interface ErrorProvider {
  error: Option<string>;
}

export type ValidationErrors<Entity extends object> = Record<keyof Entity, ErrorProvider>;

export default interface ValidableModel<Entity extends object = Record<string, any>> {
  errors: ValidationErrors<Entity>;
  validate: <K extends keyof Entity>(name?: NameValue<Entity, K>['name']) => boolean;
  readonly isValid: boolean;
}
