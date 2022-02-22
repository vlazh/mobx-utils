import {
  transaction,
  toJS,
  makeAutoObservable,
  AnnotationsMap,
  CreateObservableOptions,
  isObservableProp,
  isComputedProp,
  isAction,
} from 'mobx';

export type StateLike<S extends AnyObject> = ExcludeKeysOfType<S, AnyFunction>;

export interface StoreMethods<S extends AnyObject> {
  init(this: this, initialState: StateLike<S>): void;
  update(
    this: this,
    patch: Partial<StateLike<S>> | ((state: StateLike<S>) => Partial<StateLike<S>> | undefined)
  ): void;
  reset(this: this): void;
  getSnapshot(this: this): StateLike<S>;
}

export type StoreLike<S extends AnyObject> = S & StoreMethods<S>;

type States = { [P: string]: StateLike<AnyObject> };

export type JSStates<S extends States> = { readonly [P in keyof StateLike<S>]: StateLike<S[P]> };

type JSStatePatches<S extends States> = {
  readonly [P in keyof StateLike<S>]?: Parameters<StoreMethods<S[P]>['update']>[0];
};

interface Stores {
  readonly [P: string]: StoreLike<AnyObject>;
}

export interface RootStoreMethods<S extends Stores> {
  init(this: this, initialStates: Partial<JSStates<S>>): void;
  update(this: this, patches: JSStatePatches<S>): void;
  resetAll(this: this): void;
  getSnapshots(this: this): JSStates<S>;
  transaction<T>(this: this, action: () => T): T;
}

export type RootStoreLike<S extends Stores> = S & RootStoreMethods<S>;

const storeSymbolProp = '@@__mobx_object_store__';
const rootStoreSymbolProp = '@@__mobx_object_root_store__';
const storeSymbol = Symbol.for(storeSymbolProp);
const rootStoreSymbol = Symbol.for(rootStoreSymbolProp);

export function isStore<S extends AnyObject>(value: unknown): value is StoreLike<S> {
  return (
    typeof value === 'object' &&
    value != null &&
    value[storeSymbolProp] === storeSymbol &&
    typeof (value as StoreLike<S>).init === 'function' &&
    typeof (value as StoreLike<S>).update === 'function' &&
    typeof (value as StoreLike<S>).reset === 'function'
  );
}

export function isRootStore<S extends Stores>(value: unknown): value is RootStoreLike<S> {
  return (
    typeof value === 'object' &&
    value != null &&
    value[rootStoreSymbolProp] === rootStoreSymbol &&
    typeof (value as RootStoreLike<S>).init === 'function' &&
    typeof (value as RootStoreLike<S>).update === 'function' &&
    typeof (value as RootStoreLike<S>).resetAll === 'function'
  );
}

export function updateState<S extends AnyObject>(
  state: S,
  patch: Parameters<StoreMethods<S>['update']>[0]
): S {
  const patchObject = typeof patch === 'function' ? patch(state) : patch;
  if (patchObject) {
    Object.getOwnPropertyNames(patchObject).forEach((prop) => {
      if (
        typeof patchObject[prop] !== 'function' &&
        prop in state &&
        typeof state[prop] !== 'function' &&
        !isComputedProp(state, prop)
      ) {
        // Ignore getters and readonly fields
        const desc = Object.getOwnPropertyDescriptor(state, prop);
        if (desc?.set || desc?.writable) {
          // eslint-disable-next-line no-param-reassign
          state[prop as keyof S] = patchObject[prop] as S[keyof S];
        }
      }
    });
  }
  return state;
}

export function getSnapshot<S extends AnyObject>(store: StoreLike<S>): StateLike<S> {
  return Object.getOwnPropertyNames(store).reduce((acc, prop) => {
    const value = store[prop as keyof typeof acc];
    if (
      value !== storeSymbol &&
      ((isObservableProp(store, prop) && !isAction(value)) || typeof value !== 'function')
    ) {
      acc[prop] = toJS(value);
    }
    return acc;
  }, {} as StateLike<S>);
}

type WithThis<T extends AnyObject> = {
  [P in keyof T]: T[P] extends AnyFunction
    ? (this: StoreLike<T>, ...args: Parameters<T[P]>) => ReturnType<T[P]>
    : T[P];
};

function filterState<S extends AnyObject>(
  state: AnyObject,
  statePropDescriptors = Object.getOwnPropertyDescriptors(state),
  stateProps = Object.getOwnPropertyNames(statePropDescriptors)
): StateLike<S> {
  return stateProps.reduce((result, prop) => {
    const desc = statePropDescriptors[prop];
    if (desc && !desc.get && !desc.set && typeof desc.value !== 'function') {
      Object.defineProperty(result, prop, desc);
    }
    return result;
  }, {} as StateLike<S>);
}

export function createStore<S extends AnyObject>(
  initialState: WithThis<S>,
  overrides?: AnnotationsMap<S, never>,
  options?: CreateObservableOptions
): StoreLike<S> {
  const initialDescriptors = Object.getOwnPropertyDescriptors(initialState);
  const initialProps = Object.getOwnPropertyNames(initialDescriptors);

  // Define default state: exclude getters, setters, functions
  let initial: StateLike<S> = filterState(initialState, initialDescriptors, initialProps);

  const store: StoreLike<S> = {
    // Copy props and methods
    // Getters/Setters will be copied as regular props so we have to redefine them below
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

    getSnapshot() {
      return getSnapshot(this);
    },
  };

  // Redefine getters/setters
  initialProps.forEach((prop) => {
    const desc = initialDescriptors[prop];
    desc && (desc.get || desc.set) && Object.defineProperty(store, prop, desc);
  });

  // Bind methods
  // Object.entries(store).forEach(([key, value]) => {
  //   if (typeof value === 'function') {
  //     const fn = value as AnyFunction;
  //     const desc = Object.getOwnPropertyDescriptors(fn);
  //     // Only methods have prototype and caller, arrow functions do not.
  //     if (desc.caller && desc.prototype) {
  //       const prop = key as keyof typeof store;
  //       store[prop] = fn.bind(store) as typeof store[typeof prop];
  //     }
  //   }
  // });

  return makeAutoObservable(
    store,
    { ...overrides, [storeSymbolProp]: false, getSnapshot: false, reset: false, init: false },
    { autoBind: true, ...options }
  );
}

export function createRootStore<S extends Stores>(stores: S): RootStoreLike<S> {
  return {
    ...stores,

    [rootStoreSymbolProp]: rootStoreSymbol,

    init(states) {
      transaction(() => {
        Object.getOwnPropertyNames(states).forEach((prop) => {
          const store = this[prop];
          const state = states[prop as keyof typeof states];
          if (state && typeof state !== 'function' && isStore(store)) {
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

    getSnapshots() {
      return Object.getOwnPropertyNames(this).reduce((acc, prop) => {
        const store = this[prop];
        if (isStore(store)) {
          acc[prop] = store.getSnapshot();
        }
        return acc;
      }, {} as JSStates<S>);
    },
  };
}

type WithSelectors<RS extends RootStoreLike<any>, S extends Readonly<AnyObject>> = RS & {
  readonly selectors: Readonly<S>;
};

export function attachSelectors<RS extends RootStoreLike<any>, S extends Readonly<AnyObject>>(
  rootStore: RS,
  selectors: S,
  overrides?: AnnotationsMap<S, never>,
  options?: CreateObservableOptions
): WithSelectors<RS, S> {
  return Object.assign(rootStore, {
    selectors: makeAutoObservable(selectors, overrides, options),
  });
}

type WithStores<RS extends RootStoreLike<any>, S extends Stores> = RS & S;

export function attachStores<RS extends RootStoreLike<any>, S extends Stores>(
  rootStore: RS,
  stores: S
): WithStores<RS, S> {
  return Object.assign(rootStore, stores);
}
