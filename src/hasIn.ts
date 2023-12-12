import { has, type ObservableMap, type ObservableSet, type IObservableArray } from 'mobx';

export function hasIn<
  T extends AnyObject,
  K extends T extends T
    ? T extends ObservableMap<infer P, any>
      ? P
      : T extends ObservableSet<infer P>
        ? P
        : T extends IObservableArray<any>
          ? number
          : keyof T
    : never,
>(
  obj: T,
  prop: K
): obj is T extends T
  ? T extends ObservableMap<any, any>
    ? T
    : T extends ObservableSet<any>
      ? T
      : T extends IObservableArray<any>
        ? T
        : K extends keyof T
          ? T
          : never
  : never {
  return has(obj, prop as any);
}
