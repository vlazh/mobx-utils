/* eslint-disable dot-notation, @typescript-eslint/no-non-null-assertion */
import { IWhenOptions, when } from 'mobx';
import { Try } from '@vzh/ts-types/fp';
import RequestableStore, { AsyncAction, RequestOptions } from './RequestableStore';
import Validable from './Validable';

function withRequestFactory<S extends RequestableStore<any, any>>(
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
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

interface WithRequestOptions<S extends RequestableStore<any, any>> extends RequestOptions {
  whenPredicate?: ((this: S, self: S) => boolean) | ((self: S) => boolean);
  whenOptions?: IWhenOptions;
  before?: (this: S, self: S) => void | ((self: S) => void);
  after?: (this: S, self: S) => void | ((self: S) => void);
}

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
    return withRequestFactory(
      (self, originalFn) => (...params: any[]) => {
        return self['request'](() => originalFn.call(self, ...params));
      },
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
    return withRequestFactory(
      (self, originalFn) => (...params: any[]) => {
        const { before, after, whenPredicate, whenOptions = {}, ...requestOptions } = targetOrOpts;
        return (
          (whenPredicate ? when(whenPredicate.bind(self, self), whenOptions) : Promise.resolve())
            .then(() => before && before.call(self, self))
            .then(() =>
              self['request'](() => originalFn.call(self, ...params), undefined, requestOptions)
            )
            // After call request it must be invoked in anyway
            .then(result => {
              after && after.call(self, self);
              return result;
            })
        );
      },
      _target,
      _propertyKey,
      _descriptor
    );
  } as any;
}

// function withRequest(
//   target: RequestableStore<any, any>,
//   propertyKey: string | symbol,
//   descriptor?: TypedPropertyDescriptor<AsyncAction<void>>
// ): any {
//   return withRequestFactory(
//     (self, originalFn) => (...params: any[]) => {
//       return self['request'](() => originalFn.call(self, ...params));
//     },
//     target,
//     propertyKey,
//     descriptor
//   );
// }

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
};

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

withRequest.memo = function memo<S extends RequestableStore<any, any>>({
  inputs: inputsGetter,
  checkOriginalParams = true,
  lifetime = 0,
}: MemoOptions<S> = {}): (
  target: S,
  propertyKey: string | symbol,
  descriptor?: TypedPropertyDescriptor<AsyncAction<void>>
) => any {
  return function withRequestMemo(target, propertyKey, descriptor): any {
    return withRequestFactory(
      (self, originalFn) => async (...originalParams: any[]) => {
        const entry = memoCache.get(originalFn);
        const inputs = inputsGetter ? inputsGetter(self, ...originalParams) : [];

        const result =
          getLastResult(entry, inputs, checkOriginalParams ? originalParams : undefined) ||
          // call function if no last result yet or inputs are not updated
          (await self['request'](() => originalFn.call(self, ...originalParams)));

        // Recreate timer on every call
        entry && entry.cacheTimeoutHandler && clearTimeout(entry.cacheTimeoutHandler);

        memoCache.set(originalFn, {
          ...entry,
          lastInputs: inputs,
          lastResult: result,
          lastParams: checkOriginalParams ? originalParams : undefined,
          cacheTimeoutHandler: createRemoveEntryTimer(lifetime, originalFn),
        });

        return result;
      },
      target,
      propertyKey,
      descriptor
    );
  };
};

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
    return withRequestFactory(
      (self, originalFn) => (...params: any[]) => {
        const model = modelGetter(self);
        return self['submit'](model, () => originalFn.call(self, ...params), undefined, options);
      },
      target,
      propertyKey,
      descriptor
    );
  };
}

withRequest.props = function props(
  options: RequestOptions
): (
  target: RequestableStore<any, any>,
  propertyKey: string | symbol,
  descriptor?: TypedPropertyDescriptor<AsyncAction<void>>
) => any {
  return function withRequestProps(target, propertyKey, descriptor): any {
    return withRequestFactory(
      (self, originalFn) => (...params: any[]) => {
        return self['request'](() => originalFn.call(self, ...params), undefined, options);
      },
      target,
      propertyKey,
      descriptor
    );
  };
};

// withRequest.when = function when<S extends RequestableStore<any, any>>(
//   predicate: (this: S) => boolean,
//   opts?: IWhenOptions
// ): (
//   target: S,
//   propertyKey: string | symbol,
//   descriptor?: TypedPropertyDescriptor<AsyncAction<void>>
// ) => any {
//   return function withRequestWait(target, propertyKey, descriptor): any {
//     return withRequestFactory(
//       (self, originalFn) => (...params: any[]) => {
//         return mobx
//           .when(predicate.bind(self) as typeof predicate, opts)
//           .then(() => self['request'](() => originalFn.call(self, ...params), undefined));
//       },
//       target,
//       propertyKey,
//       descriptor
//     );
//   };
// };
