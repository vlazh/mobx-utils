/* eslint-disable dot-notation, @typescript-eslint/no-non-null-assertion */
import { Try } from '@vzh/ts-types/fp';
import RequestableStore, { AsyncAction } from './RequestableStore';
import Validable from './Validable';

function withRequestFactory<S extends RequestableStore<any, any>>(
  request: (self: typeof target, originalFn: Function) => AsyncAction<Try<any>>,
  target: S,
  propertyKey: string | symbol,
  descriptor?: TypedPropertyDescriptor<AsyncAction<void>>
): any {
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

function withRequest(
  target: RequestableStore<any, any>,
  propertyKey: string | symbol,
  descriptor?: TypedPropertyDescriptor<AsyncAction<void>>
): any {
  return withRequestFactory(
    (self, originalFn) => (...params: any[]) => {
      return self['request'](() => originalFn.call(self, ...params));
    },
    target,
    propertyKey,
    descriptor
  );
}

withRequest.bound = function bound(
  target: RequestableStore<any, any>,
  propertyKey: string | symbol,
  descriptor: TypedPropertyDescriptor<AsyncAction<void>>
): TypedPropertyDescriptor<AsyncAction<void>> {
  return {
    configurable: true,
    enumerable: false,

    get(this: typeof target) {
      const { value, get, set, ...rest } = descriptor;
      const fn = value!;
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
};

function isUpdated(lastInputs: any[] | undefined, nextInputs: any[]): boolean {
  // Always true for empty cache
  if (!lastInputs) return true;
  // Always true for empty inputs
  if (nextInputs.length === 0) return true;
  if (lastInputs.length !== nextInputs.length) return true;
  for (let i = 0; i < lastInputs.length; i += 1) {
    if (lastInputs[i] !== nextInputs[i]) return true;
  }
  return false;
}

interface MemoCacheEntry {
  lastInputs: any[] | boolean;
  lastResult: Try<any>;
  cacheTimeoutHandler: number | undefined;
}

const memoCache: WeakMap<RequestableStore<any, any>, MemoCacheEntry> = new WeakMap();

function createRemoveEntryTimer(
  lifetime: number,
  key: RequestableStore<any, any>
): number | undefined {
  return lifetime > 0 ? setTimeout(() => memoCache.delete(key), lifetime * 1000) : undefined;
}

withRequest.memo = function memo<S extends RequestableStore<any, any>>(
  /** Invoke decorated method if this function returns `true` or if returned inputs are changed (shallow compare) */
  inputsGetter: (self: S, ...params: any[]) => any[] | boolean,
  /** In seconds */
  lifetime: number = 0
): (
  target: S,
  propertyKey: string | symbol,
  descriptor?: TypedPropertyDescriptor<AsyncAction<void>>
) => any {
  // let lastInputs: any[] | undefined;
  // let lastResult: Try<any> | undefined;
  // let cacheTimeoutHandler: number | undefined;
  // const clearCache =
  //   lifetime > 0
  //     ? () => {
  //         lastInputs = undefined;
  //         lastResult = undefined;
  //         cacheTimeoutHandler = undefined;
  //       }
  //     : undefined;

  return function withRequestMemo(target, propertyKey, descriptor): any {
    return withRequestFactory(
      (self, originalFn) => async (...params: any[]) => {
        const entry = memoCache.get(self);
        const inputs = inputsGetter(self, ...params);

        // is called already earlier
        if (entry) {
          // Recreate timer on every call
          if (entry.cacheTimeoutHandler) {
            clearTimeout(entry.cacheTimeoutHandler);
            memoCache.set(self, {
              ...entry,
              lastInputs: inputs,
              cacheTimeoutHandler: createRemoveEntryTimer(lifetime, self),
            });
          }

          // return last result if inputs is false
          if (typeof inputs === 'boolean' && !inputs) {
            console.log(propertyKey, 'Return cached [bool]');
            return entry.lastResult;
          }

          // return last result if inputs are not updated
          if (
            Array.isArray(inputs) &&
            Array.isArray(entry.lastInputs) &&
            !isUpdated(entry.lastInputs, inputs)
          ) {
            console.log(propertyKey, 'Return cached [array]');
            return entry.lastResult;
          }
        }

        const result = await self['request'](() => originalFn.call(self, ...params));

        const lastEntry = memoCache.get(self);
        memoCache.set(self, {
          ...lastEntry,
          lastInputs: inputs,
          lastResult: result,
          cacheTimeoutHandler:
            // dont create timer if already recreated
            lastEntry && lastEntry.cacheTimeoutHandler
              ? lastEntry.cacheTimeoutHandler
              : createRemoveEntryTimer(lifetime, self),
        });

        return result;

        // // is called already earlier
        // if (lastResult != null) {
        //   const inputs = inputsGetter(self, ...params);

        //   if (typeof inputs === 'boolean' && !inputs) return lastResult || Try.success(undefined);

        //   if (Array.isArray(inputs)) {
        //     if (!isUpdated(lastInputs, inputs)) {
        //       // If cache still exists extend timeout on every call
        //       if (clearCache && cacheTimeoutHandler) {
        //         clearTimeout(cacheTimeoutHandler);
        //         cacheTimeoutHandler = setTimeout(clearCache, lifetime * 1000);
        //       }
        //       // return last result if inputs are not updated
        //       return lastResult;
        //     }

        //     // if inputs are updated
        //     if (inputs.length > 0) {
        //       lastInputs = inputs;
        //       // Create/recreate timeout
        //       clearTimeout(cacheTimeoutHandler);
        //       cacheTimeoutHandler = clearCache && setTimeout(clearCache, lifetime * 1000);
        //     }
        //   }
        // }

        // lastResult = await self['request'](() => originalFn.call(self, ...params));
        // return lastResult;
      },
      target,
      propertyKey,
      descriptor
    );
  };
};

export default withRequest;

export function withSubmit<S extends RequestableStore<any, any>>(
  modelGetter: (self: S) => Validable
): (
  target: S,
  propertyKey: string | symbol,
  descriptor?: TypedPropertyDescriptor<AsyncAction<void>>
) => any {
  return function withSubmitRequest(target, propertyKey, descriptor): any {
    return withRequestFactory(
      (self, originalFn) => (...params: any[]) => {
        const model = modelGetter(self);
        return self['submit'](model, () => originalFn.call(self, ...params));
      },
      target,
      propertyKey,
      descriptor
    );
  };
}
