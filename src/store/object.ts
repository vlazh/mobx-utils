import {
  type AnnotationsMap,
  type CreateObservableOptions,
  transaction,
  toJS,
  makeAutoObservable,
  isObservableProp,
  isComputedProp,
  isAction as isMobxAction,
  action as mobxAction,
  runInAction,
} from 'mobx';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  export namespace NodeJS {
    interface ProcessEnv {
      readonly NODE_ENV?: string | undefined;
    }
  }
}

export interface GetSnapshotOptions<F = string> {
  readonly field?: F | undefined;
  readonly excludeReadonly?: boolean | undefined;
}

export type State<S extends AnyObject> = ExcludeKeysOfType<S, AnyFunction>;

export interface StoreMethods<S extends AnyObject> {
  init(this: this, initialState: State<S>): void;
  update(
    this: this,
    patch: Partial<State<S>> | ((state: State<S>) => Partial<State<S>> | undefined)
  ): void;
  reset(this: this): void;
  getSnapshot<F extends keyof S = keyof S>(
    this: this,
    options?: GetSnapshotOptions<F>
  ): State<keyof S extends F ? S : Pick<S, F>>;
}

export type Store<S extends AnyObject> = S & StoreMethods<S>;

type States = Record<string, State<AnyObject>>;

export type JSStates<S extends States> = { readonly [P in keyof State<S>]: State<S[P]> };

type JSStatePatches<S extends States> = {
  readonly [P in keyof State<S>]?: Parameters<StoreMethods<S[P]>['update']>[0] | undefined;
};

type Stores = Readonly<Record<string, Store<AnyObject> | AnyFunction>>;

type WithStores<RS extends RootStore<any>, S extends Stores> = RS & S;

type WithSelectors<
  RS extends RootStore<any>,
  S extends Readonly<AnyObject>,
  P extends string = 'selectors',
> = RS & Readonly<Record<P, Readonly<S>>>;

export interface RootStoreMethods<S extends Stores> {
  init(this: this, initialStates: Partial<JSStates<S>>): void;
  update(this: this, patches: JSStatePatches<S>): void;
  resetAll(this: this): void;
  getSnapshots(this: this): JSStates<S>;
  transaction<T>(this: this, action: () => T): T;
  action<T>(this: this, action: () => T): T;
  attach<SS extends Stores>(this: this, stores: SS): WithStores<this, SS>;
  attachSelectors<SS extends Readonly<AnyObject>, P extends string | undefined = 'selectors'>(
    selectors: SS,
    propertyName?: P,
    overrides?: AnnotationsMap<SS, never>,
    options?: CreateObservableOptions
  ): WithSelectors<this, SS, undefined extends P ? 'selectors' : Exclude<P, undefined>>;
}

export type RootStore<S extends Stores> = S & RootStoreMethods<S>;

const storeSymbolProp = '@@__mobx_object_store__';
const rootStoreSymbolProp = '@@__mobx_object_root_store__';
const storeSymbol = Symbol.for(storeSymbolProp);
const rootStoreSymbol = Symbol.for(rootStoreSymbolProp);

export function isStore<S extends AnyObject>(value: unknown): value is Store<S> {
  return (
    typeof value === 'object' &&
    value != null &&
    (value as AnyObject)[storeSymbolProp] === storeSymbol &&
    typeof (value as Store<S>).init === 'function' &&
    typeof (value as Store<S>).update === 'function' &&
    typeof (value as Store<S>).reset === 'function'
  );
}

export function isRootStore<S extends Stores>(value: unknown): value is RootStore<S> {
  return (
    typeof value === 'object' &&
    value != null &&
    (value as AnyObject)[rootStoreSymbolProp] === rootStoreSymbol &&
    typeof (value as RootStore<S>).init === 'function' &&
    typeof (value as RootStore<S>).update === 'function' &&
    typeof (value as RootStore<S>).resetAll === 'function'
  );
}

const storeMethods: Record<keyof StoreMethods<AnyObject>, true> = {
  init: true,
  reset: true,
  update: true,
  getSnapshot: true,
};

export function updateState<S extends AnyObject>(
  state: S,
  patch: Parameters<StoreMethods<S>['update']>[0]
): S {
  const patchObject = typeof patch === 'function' ? patch(state) : patch;
  if (!patchObject) return state;

  Object.getOwnPropertyNames(patchObject).forEach((key) => {
    const prop = key as keyof typeof patchObject;
    if (
      typeof patchObject[prop] !== 'function' &&
      typeof state[prop] !== 'function' &&
      prop in state &&
      !isComputedProp(state, prop)
    ) {
      // Ignore getters and readonly fields
      const desc = Object.getOwnPropertyDescriptor(state, prop);
      if (desc?.set || desc?.writable) {
        state[prop as keyof S] = patchObject[prop] as S[keyof S];
      } else if (globalThis.process?.env.NODE_ENV !== 'production') {
        console.warn(`Skip the value applied for readonly prop '${String(prop)}'.`);
      }
    } else if (globalThis.process?.env.NODE_ENV !== 'production') {
      if (!storeMethods[prop as keyof StoreMethods<AnyObject>]) {
        console.warn(`Skip the value applied for prop '${String(prop)}'.`);
      }
    }
  });
  return state;
}

export function getSnapshot<S extends AnyObject, F extends keyof S = keyof S>(
  store: Store<S>,
  { field, excludeReadonly }: GetSnapshotOptions<F> = {}
): State<keyof S extends F ? S : Pick<S, F>> {
  const props = field ? [field] : Object.getOwnPropertyNames(store);
  return props.reduce((acc, key) => {
    const prop = key as keyof typeof acc;
    const value = store[prop];
    if (
      value !== storeSymbol &&
      ((isObservableProp(store, prop) && !isMobxAction(value)) || typeof value !== 'function')
    ) {
      if (excludeReadonly) {
        if (!isComputedProp(store, prop)) {
          const desc = Object.getOwnPropertyDescriptor(store, prop);
          if (!desc || desc.writable || desc.set) {
            acc[prop] = toJS(value);
          }
        }
      } else {
        acc[prop] = toJS(value);
      }
    }
    return acc;
  }, {} as State<S>) as State<keyof S extends F ? S : Pick<S, F>>;
}

function filterState<S extends AnyObject>(
  state: AnyObject,
  statePropDescriptors = Object.getOwnPropertyDescriptors(state),
  stateProps = Object.getOwnPropertyNames(statePropDescriptors)
): State<S> {
  return stateProps.reduce((result, prop) => {
    const desc = statePropDescriptors[prop];
    if (desc && !desc.get && !desc.set && typeof desc.value !== 'function') {
      Object.defineProperty(result, prop, desc);
    }
    return result;
  }, {} as State<S>);
}

export type createStore<S extends AnyObject> = (
  initialState: S & ThisType<Store<S>>,
  overrides?: AnnotationsMap<S, never>,
  options0?: CreateObservableOptions
) => Store<S>;

export function createStore<S extends AnyObject>(
  initialState: S & ThisType<Store<S>>,
  overrides?: AnnotationsMap<S, never>,
  options0?: CreateObservableOptions
): Store<S> {
  const options = { autoBind: true, ...options0 };

  const initialDescriptors = Object.getOwnPropertyDescriptors(initialState);
  const initialProps = Object.getOwnPropertyNames(initialDescriptors);
  const initialSymbols = Object.getOwnPropertySymbols(initialDescriptors);

  // Define default state: exclude getters, setters, functions
  let initial: State<S> = filterState(initialState, initialDescriptors, initialProps);

  const store: Store<S> = {
    // Copy props and methods
    // Getters/Setters will be copied as regular props so we have to redefine them below
    // Not enumerable props will not be copied so we have to redefine them below
    ...(initialState as S),

    [storeSymbolProp]: storeSymbol,

    init(state) {
      initial = filterState(state, initialDescriptors, initialProps);
      this.update(initial);
    },

    update(patch) {
      updateState(this, patch);
    },

    reset() {
      this.update(initial);
    },

    getSnapshot(opts) {
      return getSnapshot(this, opts);
    },
  };

  // To exclude non-writeable props from observable
  const ignored: PropertyKey[] = [];

  // Redefine getters/setters
  const redefine = (prop: string | symbol): void => {
    const desc = (initialDescriptors as Record<PropertyKey, TypedPropertyDescriptor<unknown>>)[
      prop
    ];
    desc &&
      (desc.get || desc.set || desc.enumerable === false) &&
      Object.defineProperty(store, prop, desc);

    if (desc.writable === false && !desc.get && !desc.set) {
      ignored.push(prop);
    }
  };
  initialProps.forEach(redefine);
  initialSymbols.forEach(redefine);

  // Bind methods
  // Object.entries(store).forEach(([key, value]) => {
  //   if (typeof value === 'function') {
  //     const fn = value as AnyFunction;
  //     const prop = key as keyof typeof store;
  //     store[prop] = fn.bind(store) as typeof store[typeof prop];
  //   }
  // });

  // Make auto bound annotations for passed methods to avoid auto make its as observable values.
  const methodAnnotations =
    options.autoBind &&
    Object.entries(store).reduce(
      (acc, [key, value]) => {
        if (!storeMethods[key as keyof StoreMethods<AnyObject>] && typeof value === 'function') {
          acc[key] = mobxAction.bound;
        }
        return acc;
      },
      {} as AnnotationsMap<EmptyObject, string>
    );

  return makeAutoObservable(
    store,
    {
      ...ignored.reduce(
        (acc, prop) => {
          acc[prop] = false;
          return acc;
        },
        {} as Record<PropertyKey, false>
      ),
      ...methodAnnotations,
      ...overrides,
      [storeSymbolProp]: false,
      init: false,
      reset: mobxAction.bound,
      getSnapshot: false,
      update: mobxAction.bound,
    },
    options
  );
}

export function createRootStore<S extends Stores>(
  stores: S & ThisType<RootStore<S>>
): RootStore<S> {
  return {
    ...stores,

    [rootStoreSymbolProp]: rootStoreSymbol,

    init(states) {
      transaction(() => {
        Object.getOwnPropertyNames(states).forEach((prop) => {
          const store = this[prop];
          const state = states[prop as keyof typeof states];
          if (state && isStore(store)) {
            store.init(state);
          }
        });
      });
    },

    update(patches) {
      transaction(() => {
        Object.getOwnPropertyNames(patches).forEach((prop) => {
          const store = this[prop];
          const patch = patches[prop as keyof typeof patches];
          if (patch && isStore(store)) {
            store.update(patch);
          }
        });
      });
    },

    resetAll() {
      transaction(() => {
        Object.getOwnPropertyNames(this).forEach((prop) => {
          const store = this[prop];
          if (isStore(store)) {
            store.reset();
          }
        });
      });
    },

    transaction(action) {
      return transaction(action);
    },

    action(action) {
      return runInAction(action);
    },

    getSnapshots() {
      return Object.getOwnPropertyNames(this).reduce(
        (acc, key) => {
          const store = this[key];
          if (isStore(store)) {
            acc[key as keyof typeof acc] = store.getSnapshot() as (typeof acc)[keyof typeof acc];
          }
          return acc;
        },
        {} as Writeable<JSStates<S>>
      );
    },

    attach(newStores) {
      return Object.assign(this, newStores);
    },

    attachSelectors(selectors, propertyName?, overrides?, options?) {
      const selectorsProp = propertyName ?? 'selectors';
      const obj = Object.assign(this, {
        [selectorsProp]: makeAutoObservable(selectors, overrides, options),
      });
      return obj as WithSelectors<typeof obj, typeof selectors, typeof selectorsProp>;
    },
  };
}
