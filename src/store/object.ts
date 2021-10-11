import {
  transaction,
  toJS,
  makeAutoObservable,
  AnnotationsMap,
  CreateObservableOptions,
} from 'mobx';

export type StateLike<S extends AnyObject> = ExcludeKeysOfType<S, AnyFunction>;

export interface StoreMethods<S extends AnyObject> {
  init(initialState: StateLike<S>): void;
  update(
    patch: Partial<StateLike<S>> | ((state: StateLike<S>) => Partial<StateLike<S>> | undefined)
  ): void;
  reset(): void;
}

export type StoreLike<S extends AnyObject> = S & StoreMethods<S>;

type States = { [P: string]: StateLike<AnyObject> };

export type JSStates<S extends States> = { [P in keyof StateLike<S>]: StateLike<S[P]> };

type JSStatePatches<S extends States> = {
  [P in keyof StateLike<S>]?: Parameters<StoreMethods<S[P]>['update']>[0];
};

type Stores = { [P: string]: StoreLike<AnyObject> };

export interface RootStoreMethods<S extends Stores> {
  init(initialStates: Partial<JSStates<S>>): void;
  update(patches: JSStatePatches<S>): void;
  resetAll(): void;
  toJS(): JSStates<S>;
  transaction<T>(action: () => T): T;
}

export type RootStoreLike<S extends Stores> = S & RootStoreMethods<S>;

const storeSymbol = Symbol.for('__mobx_object_store__');
const rootStoreSymbol = Symbol.for('__mobx_object_root_store__');
const storeSymbolProp = '@@__mobx_object_store__';
const rootStoreSymbolProp = '@@__mobx_object_root_store__';

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
        typeof state[prop] !== 'function'
      ) {
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
  const descriptors = Object.getOwnPropertyDescriptors(initialState);
  const props = Object.getOwnPropertyNames(descriptors);

  // Define default state: exclude getters, setters, functions
  const filterState = (
    state: AnyObject,
    stateProps = Object.getOwnPropertyNames(state)
  ): StateLike<T> => {
    return stateProps.reduce((result, prop) => {
      const desc = descriptors[prop];
      if (desc && !desc.get && !desc.set && typeof desc.value !== 'function') {
        Object.defineProperty(result, prop, desc);
      }
      return result;
    }, {} as StateLike<T>);
  };

  let initial: StateLike<T> = filterState(initialState, props);

  const store: StoreLike<T> = {
    ...initialState,

    [storeSymbolProp]: storeSymbol,

    init(state) {
      initial = filterState(state);
      this.reset();
    },

    update(patch) {
      updateState(this as StoreLike<T>, patch);
    },

    reset() {
      this.update(initial);
    },
  };

  // Redefine getters/setters
  props.forEach((prop) => {
    const desc = descriptors[prop];
    desc && (desc.get || desc.set) && Object.defineProperty(store, prop, desc);
  });

  return makeAutoObservable<StoreLike<T>>(
    store,
    { ...overrides, [storeSymbolProp]: false },
    options
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
          if (states[prop] && typeof states[prop] !== 'function' && isStore(store)) {
            store.init(states[prop]);
          }
        });
      });
    },

    update(patches) {
      transaction(() => {
        Object.getOwnPropertyNames(patches).forEach((prop) => {
          const store = this[prop];
          if (patches[prop] && isStore(store)) {
            store.update(patches[prop]);
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
