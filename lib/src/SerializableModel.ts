import { Omit, ExcludeKeysOfType, Copy } from '@vzh/ts-types';
import { Option } from '@vzh/ts-types/fp';
import ValidableStoreModel from './ValidableStoreModel';

export type JSONPrimitives = string | number | boolean | null | undefined;

export type JSONTypes = JSONPrimitives | JSONObject | JSONArray;

export interface JSONObject extends Record<string, JSONTypes> {}

export interface JSONArray extends ReadonlyArray<JSONTypes> {}

type ExcludeFunctions<T extends object> = ExcludeKeysOfType<T, Function>;

type OnlyValues<Entity extends object> = ExcludeFunctions<
  Omit<Entity, keyof ValidableStoreModel<any> & keyof SerializableModel<any>>
>;

// Like Moment object
interface ValueContainer<T> {
  valueOf: () => T;
}

type UnknownType = string;
type JSONArrayValue<A> = Array<A extends object ? JSONObjectValue<A> : UnknownType>;

type JSONObjectValue<A extends object> = keyof OnlyValues<A> extends never
  ? (A extends ValueContainer<infer R> ? R : {})
  : { [P in keyof OnlyValues<A>]: JSONValue<A[P]> };

type ArrayOrObject<A> = A extends ReadonlyArray<infer T>
  ? JSONArrayValue<T>
  : (A extends object ? JSONObjectValue<A> : UnknownType);

type JSONDefinedValue<A> = A extends JSONTypes
  ? A
  : /* Object type. Also undefined? */ (A extends SerializableModel<infer T>
      ? JSONObjectValue<T>
      : (undefined extends A
          ? ArrayOrObject<Exclude<A, undefined>> | undefined
          : ArrayOrObject<A>));

export type JSONValue<A> = A extends Option<infer T>
  ? JSONDefinedValue<T> | undefined
  : JSONDefinedValue<A>;

// type A = { a?: Function; b: {}; valueOf: (a?: string) => object; toJSON(): any; jsonModel0: any };
// type B = undefined extends A['a'] ? string : number;
// type B = A['b'] extends JSONTypes ? string : number;
// type B = A['b'] extends object | undefined ? string : number;
// type B = Exclude<A['a'], undefined>;
// type B = keyof SerializableModel<any>;
// type B = keyof SerializableModel<any> extends Extract<keyof A, keyof SerializableModel<any>>
//   ? string
//   : number;
// const b: B = {};

export type JSONModel<Entity extends object> = Copy<JSONValue<Entity>>;

export interface Serializable<A extends object> {
  toJSON(): JSONModel<A>;
}

export default interface SerializableModel<Entity extends object> extends Serializable<Entity> {
  /**
   * Just for correct infering: https://github.com/Microsoft/TypeScript/issues/26688
   * It's required to define in implementation for correct typing with `JSONModel`.
   * Might be just equal `this`.
   */
  readonly jsonModel: Entity;
}

export function serialize<Entity>(v: Entity): JSONValue<Entity> {
  if (v == null) {
    return v;
  }
  if (Array.isArray(v)) {
    return v.map(serialize) as JSONValue<Entity>;
  }

  if (v instanceof Option) {
    return v.map(serialize).orUndefined();
  }

  if (typeof v === 'object') {
    const obj = Object.entries(v).reduce((acc, [key, value]) => {
      // Skip functions and symbols
      if (typeof value === 'function' || typeof value === 'symbol') return acc;
      return { ...acc, [key]: serialize(value) };
    }, {}) as JSONValue<Entity>;

    if (
      !Object.getOwnPropertyNames(obj).length &&
      typeof (v as ValueContainer<any>).valueOf === 'function'
    ) {
      return (v as ValueContainer<any>).valueOf() as JSONValue<Entity>;
    }

    return obj;
  }

  if (typeof v === 'boolean' || typeof v === 'number' || typeof v === 'string') {
    return v as JSONValue<Entity>;
  }

  return String(v) as JSONValue<Entity>;
}

// const a = serialize({ a: 1 });
// const a = serialize(undefined);
// const a = serialize(null);
// const a = serialize([1]);
// const a = serialize(Option.of(1));
// a;
// type B = JSONModel<Option<number>>;
// type B = JSONModel<number[]>;
// type B = JSONModel<{ a: 1; b: { q: string; w: string[] }[] }>;
// const b: B = {};
// type J = JSONObject;
// const j: J = { a: 0, 1: 7, z: new Date() };
