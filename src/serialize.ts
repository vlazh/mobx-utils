import { Option } from '@vzh/ts-types/fp';
import JSONSerializable, { JSONValue, ValueContainer } from './JSONSerializable';

export type CustomSerializerResult = { use: true; value: any } | { use: false };

export interface SerializeOptions {
  customSerializer?: (value: any) => CustomSerializerResult;
  skipValidableModelFields?: boolean;
  skipJSONSerializableFields?: boolean;
}

export default function serialize<V>(v: V, options: SerializeOptions = {}): JSONValue<V> {
  const {
    customSerializer,
    skipValidableModelFields = true,
    skipJSONSerializableFields = true,
  } = options;

  const customResult = customSerializer && customSerializer(v);
  if (customResult && customResult.use) return customResult.value;

  if (v == null) {
    return v as JSONValue<V>;
  }

  if (Array.isArray(v)) {
    return v.map(item => serialize(item, options)) as JSONValue<V>;
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
    return v.map(value => serialize(value, options)).orUndefined();
  }

  if (typeof v === 'object') {
    const obj = Object.entries(v).reduce((acc, [key, value]) => {
      // Skip functions and symbols
      if (typeof value === 'function' || typeof value === 'symbol') return acc;
      // Skip ValidableModel fields
      if (skipValidableModelFields) {
        if (key === 'changeField') return acc;
        if (key === 'validate') return acc;
        if (key === 'isValid') return acc;
        if (key === 'errors') return acc;
      }
      // Skip JSONSerializable field
      if (skipJSONSerializableFields) {
        if (
          key === '_serializable' &&
          typeof ((v as unknown) as JSONSerializable<{}>).toJSON === 'function'
        ) {
          return acc;
        }
      }
      return { ...acc, [key]: serialize(value, options) };
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
