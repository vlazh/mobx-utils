import { KeysOfType } from 'typelevel-ts';
import { isArrayLike } from 'mobx';
import ValidableStoreModel from './ValidableStoreModel';

export type JSONPrimitives = string | number | boolean | null | undefined;

export interface JSONObject extends Record<PropertyKey, JSONPrimitives | JSONObject | JSONArray> {}

export interface JSONArray extends ReadonlyArray<JSONPrimitives | JSONObject | JSONArray> {}

export type JSONTypes = JSONPrimitives | JSONObject | JSONArray;

// type ExcludeFunctions<T> = Pick<T, { [K in keyof T]: T[K] extends Function ? never : K }[keyof T]>;
export type ExcludeFunctions<T extends object> = Pick<T, Exclude<keyof T, KeysOfType<T, Function>>>;

type OnlyEntity<Entity extends object> = ExcludeFunctions<
  Pick<Entity, Exclude<keyof Entity, keyof ValidableStoreModel<any> | keyof SerializableModel<any>>>
>;

export type JSONModel<Entity extends object> = {
  [P in keyof OnlyEntity<Entity>]: OnlyEntity<Entity>[P] extends SerializableModel<any>
    ? JSONModel<OnlyEntity<Entity>[P]> // : Entity[P]
    : JSONTypes
};

export default interface SerializableModel<Entity extends object> {
  toJSON(): JSONModel<Entity>;
}

export function serialize(v: any): JSONTypes {
  if (v == null) {
    return v;
  }
  if (Array.isArray(v) || isArrayLike(v)) {
    return v.map(serialize);
  }
  if (typeof v === 'object') {
    return Object.entries(v).reduce((acc, _) => ({ ...acc, [_[0]]: serialize(_[1]) }), {});
  }
  return v;
}
