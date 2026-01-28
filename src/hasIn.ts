import { has } from 'mobx';

export function hasIn<
  T extends AnyObject,
  K extends T extends T ? (T extends ArrayLike<any> ? number : keyof T) : never,
>(obj: T, prop: K): obj is T extends T ? (K extends keyof T ? T : never) : never {
  return has(obj, prop as string);
}
