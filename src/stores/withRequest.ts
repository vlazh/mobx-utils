import { IWhenOptions, when as whenFn, runInAction } from 'mobx';
import { Try } from '@vlazh/ts-utils/fp/Try';
import RequestableStore, { AsyncAction, RequestOptions } from './RequestableStore';
import Validable from '../models/Validable';
import WorkerStore from './WorkerStore';

function defineInstanceProp<S extends RequestableStore<any, any, any>>(
  request: (self: S, originalFn: Function) => AsyncAction<Try<any>>,
  target: S,
  propertyKey: string | symbol,
  initialFn: Function
): void {
  let fn = initialFn;
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
}

type BabelDescriptor = TypedPropertyDescriptor<AsyncAction<void>> & { initializer?: () => any };

function withDecorator<S extends RequestableStore<any, any, any>>(
  request: (self: S, originalFn: Function) => AsyncAction<Try<any>>,
  bound: boolean,
  target: S,
  propertyKey: string | symbol,
  descriptor?: BabelDescriptor
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
          value(...params: any[]): Promise<Try<any>> {
            return request(self, fn)(...params);
          },
        });

        return this[propertyKey];
      },
      set: () => {},
    };
  }

  // Method decorator:
  if (descriptor?.value) {
    const { value: fn, get, set, ...rest } = descriptor;

    return {
      ...rest,
      async value(this: typeof target, ...params: any[]) {
        await request(this, fn)(...params);
      },
    };
  }

  // Babel property method decorator:
  if (descriptor?.initializer) {
    const { initializer, ...rest } = descriptor;
    return {
      ...rest,
      initializer() {
        // N.B: we can't immediately invoke initializer; this would be wrong
        const fn = initializer.call(this);
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
      defineInstanceProp(request, this, propertyKey, this[propertyKey]);
      return this[propertyKey];
    },
    set(this: typeof target, nextFn: Function) {
      // When first set invoked we are redefine property on concreate class instance
      defineInstanceProp(request, this, propertyKey, request(this, nextFn));
    },
  };
}

export interface WithRequestOptions<S extends RequestableStore<any, any, any>>
  extends RequestOptions<
    S extends RequestableStore<any, any, infer WS>
      ? WS extends WorkerStore<any, infer TaskKeys>
        ? TaskKeys
        : never
      : never
  > {
  validate?: (this: S, self: S) => boolean | ((self: S) => boolean);
  before?: (this: S, self: S) => void | ((self: S) => void);
  after?: (this: S, self: S) => void | ((self: S) => void);
  /** Suspense until when predicate resolves to true */
  when?: {
    predicate: ((this: S, self: S) => boolean) | ((self: S) => boolean);
    options?: IWhenOptions;
  };
  memo?: boolean | MemoOptions<S>;
  bound?: boolean;
}

async function callRequestWithOptions<S extends RequestableStore<any, any, any>>(
  self: S,
  originalFn: Function,
  originalFnParams: any[],
  {
    validate,
    before,
    after,
    when,
    ...requestOptions
  }: OmitStrict<WithRequestOptions<S>, 'memo' | 'bound'>
): Promise<Try<any>> {
  const isValid = await (validate
    ? new Promise((resolve) => resolve(validate.call(self, self)))
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
    () => originalFn.call(self, ...originalFnParams),
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

export interface MemoOptions<S extends RequestableStore<any, any, any>> {
  /** Invoke decorated method if this function returns `true` or if returned inputs are changed (shallow compare) */
  inputs?: (self: S, ...originalParams: any[]) => any[] | boolean;
  /** Merge */
  checkOriginalParams?: boolean;
  /** In seconds */
  lifetime?: number;
}

async function withMemo<S extends RequestableStore<any, any, any>>(
  self: S,
  originalFn: Function,
  originalFnParams: any[],
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
  descriptor?: TypedPropertyDescriptor<AsyncAction<void>>
) => any;

function isRequestableStore<S extends RequestableStore<any, any, any>>(
  targetOrOpts: S | WithRequestOptions<S>
): targetOrOpts is S {
  return typeof targetOrOpts === 'object' && targetOrOpts instanceof RequestableStore;
}

function withRequest<S extends RequestableStore<any, any, any>>(
  target: S,
  propertyKey: string | symbol,
  descriptor?: TypedPropertyDescriptor<AsyncAction<void>>
): any;

function withRequest<S extends RequestableStore<any, any, any>>(
  options: WithRequestOptions<S>
): PropertyOrMethodDecorator<S>;

function withRequest<S extends RequestableStore<any, any, any>>(
  targetOrOptions: S | WithRequestOptions<S>,
  propertyKeyOrNothing?: string | symbol,
  descriptorOrNothing?: TypedPropertyDescriptor<AsyncAction<void>>
): typeof targetOrOptions extends WithRequestOptions<S> ? PropertyOrMethodDecorator<S> : any {
  if (isRequestableStore(targetOrOptions)) {
    return withDecorator(
      (self, originalFn) => (...params: any[]) => {
        return self['request'](() => originalFn.call(self, ...params));
      },
      false,
      targetOrOptions,
      propertyKeyOrNothing!,
      descriptorOrNothing
    );
  }

  return function withRequestOptions(
    target: S,
    propertyKey: string | symbol,
    descriptor?: TypedPropertyDescriptor<AsyncAction<void>>
  ): any {
    const { bound, memo, ...restOptions } = targetOrOptions;

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
      target,
      propertyKey,
      descriptor
    );
  } as any;
}

export default withRequest;

export function withSubmit<S extends RequestableStore<any, any, any>>(
  modelGetter: (self: S) => Validable,
  options?: RequestOptions<
    S extends RequestableStore<any, any, infer WS>
      ? WS extends WorkerStore<any, infer TaskKeys>
        ? TaskKeys
        : never
      : never
  >
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
