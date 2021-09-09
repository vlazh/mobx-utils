import type {
  Jsonify,
  JSONSerializable as JSONSerializableOrigin,
} from '@js-toolkit/ts-utils/types/json';
import type ValidableModel from '../models/ValidableModel';

export type JSONOf<A> = A extends ValidableModel<any>
  ? Jsonify<A | ValidableModel<EmptyObject>, keyof ValidableModel<EmptyObject>>
  : Jsonify<A>;

export type JSONModel<A extends AnyObject> = JSONOf<A>;

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface JSONSerializable<A extends AnyObject>
  extends JSONSerializableOrigin<
    A | ValidableModel<EmptyObject>,
    keyof ValidableModel<EmptyObject>
  > {}

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
// type B = JSONModel<{ a: JSONSerializable<{ q: number }> }>;
// const b: B = { a:{} };
// type J = JSONObject;
// const j: J = { a: 0, 1: 7, z: new Date() };
