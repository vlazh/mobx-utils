import { Option } from '@js-toolkit/utils/fp/Option';
import type { ValueContainer } from '@js-toolkit/utils/types/json';
import type { JSONSerializable, JsonOf } from './json';

export type SerializerResult = { value: any; next: boolean };

export interface SerializeOptions {
  serializer?: ((value: any) => SerializerResult) | undefined;
  excludeValidableModelFields?: boolean | undefined;
  excludeJSONSerializableFields?: boolean | undefined;
}

export function serialize<V>(valueOrObject: V, options: SerializeOptions = {}): JsonOf<V> {
  type Result = JsonOf<V>;

  const {
    serializer,
    excludeValidableModelFields = true,
    excludeJSONSerializableFields = true,
  } = options;

  let value: unknown = valueOrObject;

  if (serializer) {
    const result = serializer(value);
    // if not continue (value serialized by user as needed) just return serialized value ...
    if (!result.next) return result.value as Result;
    // ... else continue serializing
    value = result.value as AnyObject;
  }

  if (value == null) {
    return value as Result;
  }

  if (Array.isArray(value)) {
    return value.map((item: unknown) => serialize(item, options)) as Result;
  }

  if (
    value instanceof Uint8Array ||
    value instanceof Uint16Array ||
    value instanceof Uint32Array ||
    value instanceof Int8Array ||
    value instanceof Int16Array ||
    value instanceof Int32Array
  ) {
    return Array.from(value) as Result;
  }

  if (value instanceof Option) {
    return value.map((v: unknown) => serialize(v, options)).orUndefined() as Result;
  }

  if (value && typeof value === 'object') {
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
          typeof (value as JSONSerializable<any>).toJSON === 'function'
        ) {
          return acc;
        }
      }
      return { ...acc, [prop]: serialize<unknown>(propValue, options) };
    }, {}) as Result;

    // Dates and other
    if (
      !Object.getOwnPropertyNames(obj).length &&
      typeof (value as ValueContainer<any>).valueOf === 'function'
    ) {
      return (value as ValueContainer<any>).valueOf() as Result;
    }

    return obj;
  }

  const valueType = typeof value;
  if (valueType === 'boolean' || valueType === 'number' || valueType === 'string') {
    return value as Result;
  }

  return String(value as unknown) as Result;
}
