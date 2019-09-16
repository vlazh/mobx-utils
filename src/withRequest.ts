/* eslint-disable dot-notation, @typescript-eslint/no-non-null-assertion */
import { IWhenOptions, when as whenFn, runInAction } from 'mobx';
import { Omit } from '@vzh/ts-types';
import { Try } from '@vzh/ts-types/fp';
import RequestableStore, { AsyncAction, RequestOptions } from './RequestableStore';
import Validable from './Validable';

function withDecorator<S extends RequestableStore<any, any>>(
  request: (self: S, originalFn: Function) => AsyncAction<Try<any>>,
  bound: boolean,
  target: S,
  propertyKey: string | symbol,
  descriptor?: TypedPropertyDescriptor<AsyncAction<void>>
): any {
  // Method bound:
  if (bound && descriptor) {
    return {
      configurable: true,
      enumerable: false,

      get(this: typeof target) {
        const { value, get, set, ...rest } = descriptor;
        const fn = value!;
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;

        Object.defineProperty(this, propertyKey, {
          ...rest,
          value(...params: any[]): Promise<Try<any>> {
            return self['request'](() => fn.call(self, ...params));
          },
        });

        return this[propertyKey];
      },
      set: () => {},
    };
  }

  // Property decorator:
  if (!descriptor) {
    let fn: Function = target[propertyKey];

    Object.defineProperty(target, propertyKey, {
      configurable: true,
      enumerable: true,
      get() {
        return fn;
      },
      set(this: typeof target, nextFn: Function) {
        fn = request(this, nextFn);
      },
    });

    return undefined;
  }

  // Method decorator:
  const { value, get, set, ...rest } = descriptor;
  const fn = value!;

  return {
    ...rest,
    async value(this: typeof target, ...params: any[]) {
      await request(this, fn)(...params);
    },
  };
}

export interface WithRequestOptions<S extends RequestableStore<any, any>> extends RequestOptions {
  before?: (this: S, self: S) => void | ((self: S) => void);
  after?: (this: S, self: S) => void | ((self: S) => void);
  when?: {
    predicate: ((this: S, self: S) => boolean) | ((self: S) => boolean);
    options?: IWhenOptions;
  };
  memo?: boolean | MemoOptions<S>;
  bound?: boolean;
}

function callRequestWithOptions<S extends RequestableStore<any, any>>(
  self: S,
  originalFn: Function,
  originalFnParams: any[],
  { before, after, when, ...requestOptions }: Omit<WithRequestOptions<S>, 'memo' | 'bound'>
): Promise<Try<any>> {
  return (
    (when
      ? new Promise(resolve => {
          // call whenFn on next tick
          setTimeout(() => {
            resolve(whenFn(() => when.predicate.call(self, self), when.options || {}));
          });
        })
      : Promise.resolve()
    )
      .then(() => before && runInAction(before.bind(self, self)))
      .then(() =>
        self['request'](() => originalFn.call(self, ...originalFnParams), undefined, requestOptions)
      )
      // After call request it must be invoked in anyway
      .then(result => {
        after && runInAction(after.bind(self, self));
        return result;
      })
  );
}

/* Memo */

function isUpdated(lastInputs: any[] | undefined, nextInputs: any[]): boolean {
  // Always true for empty cache
  if (!lastInputs) return true;
  // Always true for empty inputs
  // if (nextInputs.length === 0) return true;
  if (lastInputs.length !== nextInputs.length) return true;
  for (let i = 0; i < lastInputs.length; i += 1) {
    if (lastInputs[i] !== nextInputs[i]) return true;
  }
  return false;
}

interface MemoCacheEntry {
  lastInputs: any[] | boolean;
  lastParams: any[] | undefined;
  lastResult: Try<any>;
  cacheTimeoutHandler: number | undefined;
}

const memoCache: WeakMap<Function, MemoCacheEntry> = new WeakMap();

function createRemoveEntryTimer(lifetime: number, key: Function): number | undefined {
  return lifetime > 0 ? setTimeout(() => memoCache.delete(key), lifetime * 1000) : undefined;
}

/**
 * @param entry Cache for function
 * @param inputs function inputs
 * @param originalParams undefined if not required to check params
 */
function getLastResult(
  entry: MemoCacheEntry | undefined,
  inputs: MemoCacheEntry['lastInputs'],
  originalParams?: any[]
): MemoCacheEntry['lastResult'] | undefined {
  if (!entry) {
    return undefined;
  }

  // return last result if inputs is false
  let notUpdated = typeof inputs === 'boolean' && !inputs;

  // return last result if inputs are not updated
  if (
    !notUpdated &&
    Array.isArray(inputs) &&
    Array.isArray(entry.lastInputs) &&
    !isUpdated(entry.lastInputs, inputs)
  ) {
    notUpdated = true;
  }

  // If inputs are not updated then check originalParams
  // and return last result if originalParams are not updated
  if (notUpdated && originalParams && !isUpdated(entry.lastParams, originalParams)) {
    return entry.lastResult;
  }

  return undefined;
}

export interface MemoOptions<S extends RequestableStore<any, any>> {
  /** Invoke decorated method if this function returns `true` or if returned inputs are changed (shallow compare) */
  inputs?: (self: S, ...originalParams: any[]) => any[] | boolean;
  /** Merge */
  checkOriginalParams?: boolean;
  /** In seconds */
  lifetime?: number;
}

async function withMemo<S extends RequestableStore<any, any>>(
  self: S,
  originalFn: Function,
  originalFnParams: any[],
  request: typeof callRequestWithOptions,
  options: Omit<WithRequestOptions<S>, 'memo'>,
  { inputs: inputsGetter, checkOriginalParams = true, lifetime = 0 }: MemoOptions<S>
): Promise<Try<any>> {
  // (self, originalFn) => async (...originalParams: any[]) => {
  const entry = memoCache.get(originalFn);
  const inputs = inputsGetter ? inputsGetter(self, ...originalFnParams) : [];

  const result =
    getLastResult(entry, inputs, checkOriginalParams ? originalFnParams : undefined) ||
    // call function if no last result yet or inputs are not updated
    // (await self['request'](() => originalFn.call(self, ...originalFnParams)));
    (await request(self, originalFn, originalFnParams, options));

  // Recreate timer on every call
  entry && entry.cacheTimeoutHandler && clearTimeout(entry.cacheTimeoutHandler);

  memoCache.set(originalFn, {
    ...entry,
    lastInputs: inputs,
    lastResult: result,
    lastParams: checkOriginalParams ? originalFnParams : undefined,
    cacheTimeoutHandler: createRemoveEntryTimer(lifetime, originalFn),
  });

  return result;
}

/* withRequest */

type PropertyOrMethodDecorator<S extends RequestableStore<any, any>> = (
  target: S,
  propertyKey: string | symbol,
  descriptor?: TypedPropertyDescriptor<AsyncAction<void>>
) => any;

function isRequestableStore<S extends RequestableStore<any, any>>(
  targetOrOpts: S | WithRequestOptions<S>
): targetOrOpts is S {
  return typeof targetOrOpts === 'object' && targetOrOpts instanceof RequestableStore;
}

export function withRequest<S extends RequestableStore<any, any>>(
  target: S,
  propertyKey: string | symbol,
  descriptor?: TypedPropertyDescriptor<AsyncAction<void>>
): any;

export function withRequest<S extends RequestableStore<any, any>>(
  options: WithRequestOptions<S>
): PropertyOrMethodDecorator<S>;

export function withRequest<S extends RequestableStore<any, any>>(
  targetOrOpts: S | WithRequestOptions<S>,
  propertyKey?: string | symbol,
  descriptor?: TypedPropertyDescriptor<AsyncAction<void>>
): (typeof targetOrOpts) extends WithRequestOptions<S> ? PropertyOrMethodDecorator<S> : any {
  if (isRequestableStore(targetOrOpts)) {
    return withDecorator(
      (self, originalFn) => (...params: any[]) => {
        return self['request'](() => originalFn.call(self, ...params));
      },
      false,
      targetOrOpts,
      propertyKey!,
      descriptor
    );
  }

  return function withRequestOptions(
    _target: S,
    _propertyKey: string | symbol,
    _descriptor?: TypedPropertyDescriptor<AsyncAction<void>>
  ): any {
    const { bound, memo, ...restOptions } = targetOrOpts;

    return withDecorator(
      (self, originalFn) => (...params: any[]) => {
        if (memo) {
          return withMemo(
            self,
            originalFn,
            params,
            callRequestWithOptions,
            restOptions,
            typeof memo === 'object' ? memo : {}
          );
        }

        return callRequestWithOptions(self, originalFn, params, restOptions);
      },
      !!bound,
      _target,
      _propertyKey,
      _descriptor
    );
  } as any;
}

export default withRequest;

export function withSubmit<S extends RequestableStore<any, any>>(
  modelGetter: (self: S) => Validable,
  options?: RequestOptions
): (
  target: S,
  propertyKey: string | symbol,
  descriptor?: TypedPropertyDescriptor<AsyncAction<void>>
) => any {
  return function withSubmitRequest(target, propertyKey, descriptor): any {
    return withDecorator(
      (self, originalFn) => (...params: any[]) => {
        const model = modelGetter(self);
        return self['submit'](model, () => originalFn.call(self, ...params), undefined, options);
      },
      false,
      target,
      propertyKey,
      descriptor
    );
  };
}
