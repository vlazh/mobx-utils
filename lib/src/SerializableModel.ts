import { isArrayLike } from 'mobx';
import ValidableStoreModel from './ValidableStoreModel';

export type JSONPrimitives = string | number | boolean | null | undefined;

export interface JSONObject extends Record<PropertyKey, JSONPrimitives | JSONObject | JSONArray> {}

export interface JSONArray extends ReadonlyArray<JSONPrimitives | JSONObject | JSONArray> {}

export type JSONTypes = JSONPrimitives | JSONObject | JSONArray;

type OnlyEntity<Entity> = Pick<
  Entity,
  Exclude<keyof Entity, keyof ValidableStoreModel<any> | keyof SerializableModel<any>>
>;

// export type JSONModel<Entity> = Partial<Record<keyof OnlyEntity<Entity>, JSONTypes>>;

export type JSONModel<Entity> = {
  [P in keyof OnlyEntity<Entity>]?: OnlyEntity<Entity>[P] extends SerializableModel<any>
    ? JSONModel<OnlyEntity<Entity>[P]>
    // : Entity[P]
    : JSONTypes
};

export default interface SerializableModel<Entity> {
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
