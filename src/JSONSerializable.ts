import { ExcludeKeysOfType, Diff } from '@vzh/ts-types';
import { Option } from '@vzh/ts-types/fp';
import ValidableStoreModel from './ValidableStoreModel';

export type JSONPrimitives = string | number | boolean | null | undefined;

export type JSONTypes = JSONPrimitives | JSONObject | JSONArray;

export interface JSONObject extends Record<string, JSONTypes> {}

export interface JSONArray extends ReadonlyArray<JSONTypes> {}

type ExcludeFunctions<A extends object> = ExcludeKeysOfType<A, Function>;

type OnlyProps<A extends object> = ExcludeFunctions<
  Diff<A, ValidableStoreModel<any> & JSONSerializable<any>>
>;

// Like Moment object
interface ValueContainer<A> {
  valueOf: () => A;
}

type UnknownType = string;
type JSONArrayValue<A, IsReadonly extends boolean> = IsReadonly extends true
  ? ReadonlyArray<A extends object ? JSONObjectValue<A> : UnknownType>
  : Array<A extends object ? JSONObjectValue<A> : UnknownType>;

type JSONObjectValue<A extends object> = keyof OnlyProps<A> extends never
  ? (A extends ValueContainer<infer R> ? R : {})
  : { [P in keyof OnlyProps<A>]: JSONValue<A[P]> };

type ArrayOrObject<A> = A extends ReadonlyArray<infer T>
  ? (A extends Array<infer T> ? JSONArrayValue<T, false> : JSONArrayValue<T, true>)
  : (A extends Uint8Array | Uint16Array | Uint32Array | Int8Array | Int16Array | Int32Array
      ? Array<number>
      : (A extends object ? JSONObjectValue<A> : UnknownType));

type JSONSomeValue<A> = A extends JSONTypes
  ? A
  : (A extends JSONSerializable<infer T>
      ? JSONObjectValue<T>
      : (undefined extends A
          ? ArrayOrObject<Exclude<A, undefined>> | undefined
          : ArrayOrObject<A>));

export type JSONValue<A> = A extends Option<infer T>
  ? JSONSomeValue<T> | undefined
  : JSONSomeValue<A>;

// For TS 3.4.1: replace `Copy<JSONValue<A>>` with itself implemetation.
export type JSONModel<A extends object> = { [P in keyof JSONValue<A>]: JSONValue<A>[P] };
// export type JSONModel<A extends object> = Copy<JSONValue<A>>;

export default interface JSONSerializable<A extends object> {
  /**
   * Just for correct infering: https://github.com/Microsoft/TypeScript/issues/26688
   * It's required to define in implementation for correct typing with `JSONModel`.
   * It might be just equals `this`.
   */
  // It needs to remove with TS 3.4.1 but may be present with 3.4.5
  // readonly _serializable: A;
  toJSON(): JSONModel<A>;
}

export type CustomSerializerResult = { use: true; value: any } | { use: false };

export function serialize<V>(
  v: V,
  customSerializer?: (value: any) => CustomSerializerResult
): JSONValue<V> {
  const customResult = customSerializer && customSerializer(v);
  if (customResult && customResult.use) return customResult.value;

  if (v == null) {
    return v as JSONValue<V>;
  }

  if (Array.isArray(v)) {
    return v.map(item => serialize(item, customSerializer)) as JSONValue<V>;
  }

  if (
    v instanceof Uint8Array ||
    v instanceof Uint16Array ||
    v instanceof Uint32Array ||
    v instanceof Int8Array ||
    v instanceof Int16Array ||
    v instanceof Int32Array
  ) {
    return Array.from(v) as JSONValue<V>;
  }

  if (v instanceof Option) {
    return v.map(value => serialize(value, customSerializer)).orUndefined();
  }

  if (typeof v === 'object') {
    const validable = v instanceof ValidableStoreModel ? new ValidableStoreModel({}) : undefined;
    const obj = Object.entries(v).reduce((acc, [key, value]) => {
      // Skip functions and symbols
      if (typeof value === 'function' || typeof value === 'symbol') return acc;
      // Skip ValidableStoreModel props
      if (validable && key in validable) return acc;
      // Skip JSONSerializable field
      if (
        key === '_serializable' &&
        typeof ((v as unknown) as JSONSerializable<{}>).toJSON === 'function'
      ) {
        return acc;
      }
      return { ...acc, [key]: serialize(value, customSerializer) };
    }, {}) as JSONValue<V>;

    if (
      !Object.getOwnPropertyNames(obj).length &&
      typeof (v as ValueContainer<any>).valueOf === 'function'
    ) {
      return (v as ValueContainer<any>).valueOf() as JSONValue<V>;
    }

    return obj;
  }

  if (typeof v === 'boolean' || typeof v === 'number' || typeof v === 'string') {
    return v as JSONValue<V>;
  }

  return String(v) as JSONValue<V>;
}

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

// const a = serialize({ a: 1 });
// const a = serialize(undefined);
// const a = serialize(null);
// const a = serialize([1]);
// const a = serialize(Option.of(1));
// a;
// type B = JSONModel<Option<number>>;
// type B = JSONModel<{ o: Option<number> }>;
// type B = JSONModel<{ o?: ValidableStoreModel<{}> }>;
// type B = JSONModel<number[]>;
// type B = JSONModel<{ a: 1; b: { q: string; w: string[] }[] }>;
// const b: B = {};
// type J = JSONObject;
// const j: J = { a: 0, 1: 7, z: new Date() };
