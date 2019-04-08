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
      await this['request'](() => fn.call(this, ...params));
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

function isUpdated(inputs: any[], nextInputs: any[]): boolean {
  if (inputs.length !== nextInputs.length) return true;
  for (let i = 0; i < inputs.length; i += 1) {
    if (inputs[i] !== nextInputs[i]) return true;
  }
  return false;
}

withRequest.memo = function memo<S extends RequestableStore<any, any>>(
  /** Invoke decorated method if this function returns `true` or if returned inputs are changed (shallow compare) */
  inputsGetter: (self: S) => any[] | boolean
): (
  target: S,
  propertyKey: string | symbol,
  descriptor?: TypedPropertyDescriptor<AsyncAction<void>>
) => any {
  let lastInputs: any[] = [];

  return function withRequestMemo(target, propertyKey, descriptor): any {
    return withRequestFactory(
      (self, originalFn) => async (...params: any[]) => {
        const inputs = inputsGetter(self);

        if (typeof inputs === 'boolean' && !inputs) return;
        if (Array.isArray(inputs)) {
          if (!isUpdated(lastInputs, inputs)) return;
          lastInputs = inputs;
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
