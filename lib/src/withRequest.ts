/* eslint-disable dot-notation, @typescript-eslint/no-non-null-assertion */
import RequestableStore, { AsyncAction } from './RequestableStore';
import Validable from './Validable';

function withRequestFactory<S extends RequestableStore<any, any>>(
  request: (self: typeof target, originalFn: Function) => AsyncAction<void>,
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
    (self, originalFn) => async (...params: any[]) => {
      await self['request'](() => originalFn.call(self, ...params));
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
        async value(...params: any[]) {
          await self['request'](() => fn.call(self, ...params));
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

withRequest.memo = function memo<S extends RequestableStore<any, any>>(
  /** Invoke decorated method if this function returns `true` or if returned inputs are changed (shallow compare) */
  inputsGetter: (self: S) => any[] | boolean,
  /** In seconds */
  lifetime: number = 0
): (
  target: S,
  propertyKey: string | symbol,
  descriptor?: TypedPropertyDescriptor<AsyncAction<void>>
) => any {
  let lastInputs: any[] | undefined;
  let cacheTimeoutHandler: number | undefined;
  const clearCache =
    lifetime > 0
      ? () => {
          lastInputs = undefined;
          cacheTimeoutHandler = undefined;
        }
      : undefined;

  return function withRequestMemo(target, propertyKey, descriptor): any {
    return withRequestFactory(
      (self, originalFn) => async (...params: any[]) => {
        const inputs = inputsGetter(self);

        if (typeof inputs === 'boolean' && !inputs) return;

        if (Array.isArray(inputs)) {
          if (!isUpdated(lastInputs, inputs)) {
            // If cache still exists extend timeout
            if (clearCache && cacheTimeoutHandler) {
              clearTimeout(cacheTimeoutHandler);
              cacheTimeoutHandler = setTimeout(clearCache, lifetime * 1000);
            }
            return;
          }

          if (inputs.length > 0) {
            lastInputs = inputs;
            // Create/recreate timeout
            cacheTimeoutHandler && clearTimeout(cacheTimeoutHandler);
            cacheTimeoutHandler = clearCache && setTimeout(clearCache, lifetime * 1000);
          }
        }

        await self['request'](() => originalFn.call(self, ...params));
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
      (self, originalFn) => async (...params: any[]) => {
        const model = modelGetter(self);
        if (!model.validate()) return;
        await self['request'](() => originalFn.call(self, ...params));
      },
      target,
      propertyKey,
      descriptor
    );
  };
}
