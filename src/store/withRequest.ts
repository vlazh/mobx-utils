/* eslint-disable @typescript-eslint/no-this-alias */
/* eslint-disable no-shadow */
/* eslint-disable dot-notation */
import { type IWhenOptions, when as whenFn, runInAction } from 'mobx';
import { Try } from '@js-toolkit/utils/fp/Try';
import type Validable from '../model/Validable';
import RequestableStore, { type AsyncAction, type RequestOptions } from './RequestableStore';
import type WorkerStore from './WorkerStore';

function defineInstanceProp<S extends RequestableStore<any, any, any>>(
  request: (self: S, originalFn: AnyFunction) => AsyncAction<Try<any>>,
  target: S,
  propertyKey: string | symbol,
  initialFn: AnyFunction
): void {
  let fn = initialFn;
  Object.defineProperty(target, propertyKey, {
    configurable: true,
    enumerable: true,
    get() {
      return fn;
    },
    set(this: typeof target, nextFn: AnyFunction) {
      fn = request(this, nextFn);
    },
  });
}

type BabelDescriptor = TypedPropertyDescriptor<AsyncAction<void>> & {
  initializer?: (() => any) | undefined;
};

function withDecorator<S extends RequestableStore<any, any, any>>(
  request: (self: S, originalFn: AnyFunction) => AsyncAction<Try<any>>,
  bound: boolean,
  target: S,
  propertyKey: string | symbol,
  descriptor?: BabelDescriptor | undefined
): any {
  // Method bound:
  if (bound && descriptor?.value) {
    return {
      configurable: true,
      enumerable: false,

      get(this: typeof target) {
        const { value, get, set, ...rest } = descriptor;
        const fn = value!;
        const self = this;

        Object.defineProperty(this, propertyKey, {
          ...rest,
          value(...params: unknown[]): Promise<Try<any>> {
            return request(self, fn)(...params);
          },
        });

        return this[propertyKey as keyof typeof target] as unknown;
      },
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      set: () => {},
    };
  }

  // Method decorator:
  if (descriptor?.value) {
    const { value: fn, get, set, ...rest } = descriptor;

    return {
      ...rest,
      async value(this: typeof target, ...params: unknown[]) {
        await request(this, fn)(...params);
      },
    };
  }

  // Babel property method decorator:
  if (descriptor?.initializer) {
    const { initializer, ...rest } = descriptor;
    return {
      ...rest,
      initializer(this: S) {
        // N.B: we can't immediately invoke initializer; this would be wrong
        const fn = initializer.call(this) as AnyFunction;
        return request(this, fn);
      },
    };
  }

  // Property decorator:
  return {
    configurable: true,
    enumerable: true,
    get(this: typeof target) {
      // When first get invoked we are redefine property on concreate class instance
      defineInstanceProp(
        request,
        this,
        propertyKey,
        this[propertyKey as keyof typeof target] as AnyFunction
      );
      return this[propertyKey as keyof typeof target] as unknown;
    },
    set(this: typeof target, nextFn: AnyFunction) {
      // When first set invoked we are redefine property on concreate class instance
      defineInstanceProp(request, this, propertyKey, request(this, nextFn));
    },
  };
}

export interface MemoOptions<S extends RequestableStore<any, any, any>> {
  /** Invoke decorated method if this function returns `true` or if returned inputs are changed (shallow compare) */
  inputs?: ((self: S, ...originalParams: any[]) => any[] | boolean) | undefined;
  /** Merge */
  checkOriginalParams?: boolean | undefined;
  /** In seconds */
  lifetime?: number | undefined;
}

export interface WithRequestOptions<S extends RequestableStore<any, any, any>>
  extends RequestOptions<
    S extends RequestableStore<any, any, infer WS>
      ? WS extends WorkerStore<any, infer TaskKeys>
        ? TaskKeys
        : never
      : never
  > {
  validate?: ((this: S, self: S) => boolean | ((self: S) => boolean)) | undefined;
  before?: ((this: S, self: S) => void | ((self: S) => void)) | undefined;
  after?: ((this: S, self: S) => void | ((self: S) => void)) | undefined;
  /** Suspense until when predicate resolves to true */
  when?:
    | {
        predicate: ((this: S, self: S) => boolean) | ((self: S) => boolean);
        options?: IWhenOptions;
      }
    | undefined;
  memo?: boolean | MemoOptions<S> | undefined;
  bound?: boolean | undefined;
}

async function callRequestWithOptions<S extends RequestableStore<any, any, any>>(
  self: S,
  originalFn: AnyFunction,
  originalFnParams: unknown[],
  {
    validate,
    before,
    after,
    when,
    ...requestOptions
  }: OmitStrict<WithRequestOptions<S>, 'memo' | 'bound'>
): Promise<Try<any>> {
  const isValid = await (validate
    ? new Promise((resolve) => {
        resolve(validate.call(self, self));
      })
    : Promise.resolve(true));
  if (!isValid) {
    return Try.failure(new Error('Something is not valid.'));
  }

  await (when
    ? new Promise((resolve) => {
        // call whenFn on next tick
        setTimeout(() => {
          resolve(whenFn(() => when.predicate.call(self, self), when.options || {}));
        });
      })
    : Promise.resolve());

  before && runInAction(before.bind(self, self));

  const result = await self['request'](
    () => originalFn.call(self, ...originalFnParams) as Promise<unknown>,
    undefined,
    requestOptions
  );

  // After call request it must be invoked in anyway
  after && runInAction(after.bind(self, self));

  return result;
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
  cacheTimeoutHandler: any | undefined;
}

const memoCache: WeakMap<AnyFunction, MemoCacheEntry> = new WeakMap();

function createRemoveEntryTimer(lifetime: number, key: AnyFunction): unknown | undefined {
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
  originalParams?: any[] | undefined
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

async function withMemo<S extends RequestableStore<any, any, any>>(
  self: S,
  originalFn: AnyFunction,
  originalFnParams: unknown[],
  request: typeof callRequestWithOptions,
  options: OmitStrict<WithRequestOptions<S>, 'memo'>,
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
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
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

type PropertyOrMethodDecorator<S extends RequestableStore<any, any, any>> = (
  target: S,
  propertyKey: string | symbol,
  descriptor?: TypedPropertyDescriptor<AsyncAction<void>> | undefined
) => any;

function isRequestableStore<S extends RequestableStore<any, any, any>>(
  targetOrOpts: S | WithRequestOptions<S>
): targetOrOpts is S {
  return typeof targetOrOpts === 'object' && targetOrOpts instanceof RequestableStore;
}

function withRequest<S extends RequestableStore<any, any, any>>(
  target: S,
  propertyKey: string | symbol,
  descriptor?: TypedPropertyDescriptor<AsyncAction<void>> | undefined
): any;

function withRequest<S extends RequestableStore<any, any, any>>(
  options: WithRequestOptions<S>
): PropertyOrMethodDecorator<S>;

function withRequest<S extends RequestableStore<any, any, any>>(
  targetOrOptions: S | WithRequestOptions<S>,
  propertyKeyOrNothing?: string | symbol | undefined,
  descriptorOrNothing?: TypedPropertyDescriptor<AsyncAction<void>> | undefined
): typeof targetOrOptions extends WithRequestOptions<S> ? PropertyOrMethodDecorator<S> : any {
  if (isRequestableStore(targetOrOptions)) {
    return withDecorator(
      (self, originalFn) =>
        (...params: unknown[]) => {
          return self['request'](() => originalFn.call(self, ...params) as Promise<unknown>);
        },
      false,
      targetOrOptions,
      propertyKeyOrNothing as string,
      descriptorOrNothing
    );
  }

  return function withRequestOptions(
    target: S,
    propertyKey: string | symbol,
    descriptor?: TypedPropertyDescriptor<AsyncAction<void>> | undefined
  ): any {
    const { bound, memo, ...restOptions } = targetOrOptions;

    return withDecorator(
      (self, originalFn) =>
        (...params: any[]) => {
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
      target,
      propertyKey,
      descriptor
    );
  } as any;
}

export default withRequest;

export function withSubmit<S extends RequestableStore<any, any, any>>(
  modelGetter: (self: S) => Validable,
  options?:
    | RequestOptions<
        S extends RequestableStore<any, any, infer WS>
          ? WS extends WorkerStore<any, infer TaskKeys>
            ? TaskKeys
            : never
          : never
      >
    | undefined
): (
  target: S,
  propertyKey: string | symbol,
  descriptor?: TypedPropertyDescriptor<AsyncAction<void>> | undefined
) => any {
  return function withSubmitRequest(target, propertyKey, descriptor): any {
    return withDecorator(
      (self, originalFn) =>
        (...params: unknown[]) => {
          const model = modelGetter(self);
          return self['submit'](
            model,
            () => originalFn.call(self, ...params) as Promise<unknown>,
            undefined,
            options
          );
        },
      false,
      target,
      propertyKey,
      descriptor
    );
  };
}
