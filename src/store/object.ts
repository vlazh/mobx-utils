import {
  transaction,
  toJS,
  makeAutoObservable,
  AnnotationsMap,
  CreateObservableOptions,
} from 'mobx';

export type StateLike<S extends AnyObject> = ExcludeKeysOfType<S, AnyFunction>;

export interface StoreMethods<S extends AnyObject> {
  init: (initialState: StateLike<S>) => void;
  update: (
    patch: Partial<StateLike<S>> | ((state: StateLike<S>) => Partial<StateLike<S>> | undefined)
  ) => void;
  reset: VoidFunction;
}

type States = { [P: string]: StateLike<AnyObject> };

export type JSStates<S extends States> = { [P in keyof StateLike<S>]: StateLike<S[P]> };

type JSStatePatches<S extends States> = {
  [P in keyof StateLike<S>]?: Parameters<StoreMethods<S[P]>['update']>[0];
};

export interface RootStoreMethods<S extends States> {
  init: (states: Partial<JSStates<S>>) => void;
  update: (states: JSStatePatches<S>) => void;
  resetAll: VoidFunction;
  toJS: () => JSStates<S>;
  transaction: <T>(action: () => T) => T;
}

export type StoreLike<S extends AnyObject> = S & StoreMethods<S>;

export type RootStoreLike<S extends States> = S & RootStoreMethods<S>;

const storeSymbol = Symbol.for('__mobx_object_store__');
const rootStoreSymbol = Symbol.for('__mobx_object_root_store__');
const storeSymbolProp = '@@__mobx_object_store__';
const rootStoreSymbolProp = '@@__mobx_object_root_store__';

export function isStore<S extends AnyObject>(value: AnyObject): value is StoreLike<S> {
  return (
    typeof value === 'object' &&
    value[storeSymbolProp] === storeSymbol &&
    typeof (value as StoreLike<S>).init === 'function' &&
    typeof (value as StoreLike<S>).update === 'function' &&
    typeof (value as StoreLike<S>).reset === 'function'
  );
}

export function isRootStore<S extends States>(value: AnyObject): value is RootStoreLike<S> {
  return (
    typeof value === 'object' &&
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
      if (typeof patchObject[prop] !== 'function' && prop in state) {
        // eslint-disable-next-line no-param-reassign
        state[prop as keyof S] = patchObject[prop] as S[keyof S];
      }
    });
  }
  return state;
}

export function createStore<T extends AnyObject>(
  initialState: T,
  overrides?: AnnotationsMap<T, never>,
  options?: CreateObservableOptions
): StoreLike<T> {
  let initial: StateLike<T> = initialState;
  return makeAutoObservable<StoreLike<T>>(
    {
      ...initialState,
      [storeSymbolProp]: storeSymbol,

      init(state) {
        initial = state;
        this.update(state);
      },

      update(patch) {
        updateState(this as StoreLike<T>, patch);
      },

      reset() {
        this.update(initial);
      },
    },
    { ...overrides, [storeSymbolProp]: false },
    options
  );
}

export function createRootStore<S extends States>(stores: S): RootStoreLike<S> {
  return {
    ...stores,
    [rootStoreSymbolProp]: rootStoreSymbol,

    init(states) {
      transaction(() => {
        Object.getOwnPropertyNames(states).forEach((prop) => {
          const store = this[prop];
          if (states[prop] && typeof states[prop] !== 'function' && isStore(store)) {
            store.init(states[prop]);
          }
        });
      });
    },

    update(states) {
      transaction(() => {
        Object.getOwnPropertyNames(states).forEach((prop) => {
          const store = this[prop];
          if (states[prop] && typeof states[prop] !== 'function' && isStore(store)) {
            store.update(states[prop]);
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

    toJS() {
      return Object.getOwnPropertyNames(this).reduce((acc, prop) => {
        const store = this[prop];
        if (isStore(store)) {
          acc[prop] = toJS(store);
        }
        return acc;
      }, {} as JSStates<S>);
    },
  };
}
