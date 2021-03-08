import { transaction, toJS, makeAutoObservable, AnnotationsMap } from 'mobx';
import type { CreateObservableOptions } from 'mobx/dist/internal';

export type StateLike<S extends AnyObject> = ExcludeKeysOfType<S, AnyFunction>;

export interface StoreMethods<S extends AnyObject> {
  init: (initialState: StateLike<S>) => void;
  update: (patch: Partial<StateLike<S>>) => void;
  reset: VoidFunction;
}

type States = { [P: string]: StateLike<AnyObject> };

export type JSStates<S extends States> = { [P in keyof StateLike<S>]: StateLike<S[P]> };

export interface RootStoreMethods<S extends States> {
  init: (states: Partial<JSStates<S>>) => void;
  update: (states: Partial<JSStates<S>>) => void;
  resetAll: VoidFunction;
  toJS: () => JSStates<S>;
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

export function updateState<S extends AnyObject>(state: S, patch: Partial<S>): S {
  Object.getOwnPropertyNames(patch).forEach((prop) => {
    if (typeof patch[prop] !== 'function' && prop in state) {
      // eslint-disable-next-line no-param-reassign
      state[prop as keyof S] = patch[prop as keyof S] as S[keyof S];
    }
  });
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
        updateState(this, patch);
      },

      reset() {
        this.update(initial);
      },
    },
    overrides,
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
          if (states[prop] && typeof states[prop] !== 'function' && isStore(this[prop])) {
            (this[prop] as StoreLike<AnyObject>).init(states[prop]);
          }
        });
      });
    },

    update(states) {
      transaction(() => {
        Object.getOwnPropertyNames(states).forEach((prop) => {
          if (states[prop] && typeof states[prop] !== 'function' && isStore(this[prop])) {
            (this[prop] as StoreLike<AnyObject>).update(states[prop]);
          }
        });
      });
    },

    resetAll() {
      transaction(() => {
        Object.getOwnPropertyNames(this).forEach((prop) => {
          if (typeof this[prop] !== 'function' && isStore(this[prop])) {
            (this[prop] as StoreLike<AnyObject>).reset();
          }
        });
      });
    },

    toJS() {
      return Object.getOwnPropertyNames(this).reduce((acc, prop) => {
        if (typeof this[prop] !== 'function' && isStore(this[prop])) {
          acc[prop] = toJS(this[prop]);
        }
        return acc;
      }, {} as JSStates<S>);
    },
  };
}
