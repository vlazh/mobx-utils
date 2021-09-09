import { Option } from '@js-toolkit/ts-utils/fp/Option';
import type { ValueContainer } from '@js-toolkit/ts-utils/types/json';
import type { JSONSerializable, JSONOf } from './JSONSerializable';

export type SerializerResult = { value: any; next: boolean };

export interface SerializeOptions {
  serializer?: (value: any) => SerializerResult;
  excludeValidableModelFields?: boolean;
  excludeJSONSerializableFields?: boolean;
}

export default function serialize<V>(valueOrObject: V, options: SerializeOptions = {}): JSONOf<V> {
  const {
    serializer,
    excludeValidableModelFields = true,
    excludeJSONSerializableFields = true,
  } = options;

  let value: AnyObject = valueOrObject;

  if (serializer) {
    const result = serializer(value);
    // if not continue (value serialized by user as needed) just return serialized value ...
    if (!result.next) return result.value as JSONOf<V>;
    // ... else continue serializing
    value = result.value as AnyObject;
  }

  if (value == null) {
    return value as JSONOf<V>;
  }

  if (Array.isArray(value)) {
    return value.map((item) => serialize(item, options)) as JSONOf<V>;
  }

  if (
    value instanceof Uint8Array ||
    value instanceof Uint16Array ||
    value instanceof Uint32Array ||
    value instanceof Int8Array ||
    value instanceof Int16Array ||
    value instanceof Int32Array
  ) {
    return Array.from(value) as JSONOf<V>;
  }

  if (value instanceof Option) {
    return value.map((v) => serialize(v, options)).orUndefined();
  }

  if (typeof value === 'object') {
    const obj = Object.entries(value).reduce((acc, [prop, propValue]) => {
      // Skip functions and symbols
      if (typeof propValue === 'function' || typeof propValue === 'symbol') return acc;
      // Skip ValidableModel fields
      if (excludeValidableModelFields) {
        if (prop === 'changeField') return acc;
        if (prop === 'validate') return acc;
        if (prop === 'isValid') return acc;
        if (prop === 'errors') return acc;
      }
      // Skip JSONSerializable field
      if (excludeJSONSerializableFields) {
        if (
          prop === '_serializable' &&
          typeof (value as unknown as JSONSerializable<{}>).toJSON === 'function'
        ) {
          return acc;
        }
      }
      return { ...acc, [prop]: serialize(propValue, options) };
    }, {}) as JSONOf<V>;

    // Dates and other
    if (
      !Object.getOwnPropertyNames(obj).length &&
      typeof (value as ValueContainer<any>).valueOf === 'function'
    ) {
      return (value as ValueContainer<any>).valueOf() as JSONOf<V>;
    }

    return obj;
  }

  if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
    return value as JSONOf<V>;
  }

  return String(value) as JSONOf<V>;
}
