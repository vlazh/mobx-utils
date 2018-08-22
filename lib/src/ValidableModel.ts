import { Option } from 'funfix-core';

export interface ErrorProvider {
  error: Option<string>;
}

export type ValidationErrors<Entity> = Record<keyof Entity, ErrorProvider>;
// export type ValidationErrors<Entity> = Record<keyof Required<Entity>, ErrorProvider>;

export default interface ValidableModel<Entity = { [key: string]: any }> {
  errors: ValidationErrors<Entity>;
  validate: (name?: keyof Entity) => boolean;
  readonly isValid: boolean;
}
