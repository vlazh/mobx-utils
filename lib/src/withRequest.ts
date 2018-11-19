import RequestableStore, { AsyncAction } from './RequestableStore';

function withRequest<T>(
  target: RequestableStore<any, any>,
  _propertyKey: string | symbol,
  descriptor: TypedPropertyDescriptor<AsyncAction<T>>
): TypedPropertyDescriptor<AsyncAction<T>> {
  const { value, get, set, ...rest } = descriptor;
  const fn = value!;

  return {
    ...rest,
    async value(this: typeof target, ...params: any[]) {
      const t = await this.request(() => fn.call(this, ...params) as ReturnType<AsyncAction<T>>);
      return t.get();
    },
  };
}

withRequest.bound = function bound<T>(
  target: RequestableStore<any, any>,
  propertyKey: string | symbol,
  descriptor: TypedPropertyDescriptor<AsyncAction<T>>
): TypedPropertyDescriptor<AsyncAction<T>> {
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
          const t = await self.request(() => fn.call(self, ...params));
          return t.get();
        },
      });

      return this[propertyKey];
    },
    set: () => {},
  };
};

export default withRequest;
