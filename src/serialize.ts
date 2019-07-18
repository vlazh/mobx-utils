import { Option } from '@vzh/ts-types/fp';
import JSONSerializable, { JSONValue, ValueContainer } from './JSONSerializable';
import ValidableStoreModel from './ValidableStoreModel';

export type CustomSerializerResult = { use: true; value: any } | { use: false };

export default function serialize<V>(
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
