/* eslint-disable dot-notation */
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

export default withRequest;

// type A = Parameters<ReturnType<typeof withSubmit>>[0];

export function withSubmit<S extends RequestableStore<any, any>>(
  modelGetter: (self: S) => Validable
): (
  target: S,
  propertyKey: string | symbol,
  descriptor?: TypedPropertyDescriptor<AsyncAction<void>>
) => any {
  // eslint-disable-next-line func-names
  return function(target, propertyKey, descriptor): any {
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
