import { isObservableArray } from 'mobx';

export function isArray<T extends readonly any[]>(arg: unknown): arg is T {
  return Array.isArray(arg) || isObservableArray(arg);
}
