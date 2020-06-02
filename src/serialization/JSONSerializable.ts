import { JSONValue as JSONValueOrigin, ObjectToJSON } from '@vzh/ts-types/json';
import ValidableModel from '../models/ValidableModel';

export type JSONValue<A> = A extends JSONSerializable<infer T>
  ? ObjectToJSON<T, keyof (ValidableModel<any> & JSONSerializable<any>)>
  : JSONValueOrigin<A, keyof (ValidableModel<any> & JSONSerializable<any>)>;

// For TS 3.4.1+: `Copy<JSONValue<A>>` is replaced with itself implemetation to avoid circular dependency error and other.
export type JSONModel<A extends object> = { [P in keyof JSONValue<A>]: JSONValue<A>[P] };

export default interface JSONSerializable<A extends object> {
  /**
   * Just for correct infering: https://github.com/Microsoft/TypeScript/issues/26688
   * It's required to define in implementation for correct typing with `JSONModel`.
   * It might be just equals `this`.
   */
  // Must be declared!
  // Because `Date` type has `toJSON` method and it incorrectly determined as JSONSerializable
  // because generic type `A` will be erased due to the fact that it is not used.
  // It needs to remove with TS 3.4.1 but may be present with 3.4.5+
  readonly _serializable: JSONSerializable<A>;
  toJSON(): JSONModel<A>;
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
