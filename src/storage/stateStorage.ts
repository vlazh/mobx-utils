import 'localforage';
import { Option, None } from '@js-toolkit/utils/fp/Option';
import { getErrorMessage } from '@js-toolkit/utils/getErrorMessage';
import type { JsonOf } from '../serialization/json';

export type JSONStoreState<RootState extends AnyObject> = Required<JsonOf<RootState>>;

export async function saveStoreState<
  RootState extends AnyObject,
  K extends keyof JSONStoreState<RootState>,
>(
  storage: LocalForageDbMethodsCore,
  store: K,
  state?: JSONStoreState<RootState>[K] | undefined,
  throwError = false
): Promise<void> {
  try {
    const prevState = await storage.getItem<JSONStoreState<RootState>[K]>(store as string);
    const nextState = prevState ? { ...prevState, ...state } : state;
    await storage.setItem(store as string, nextState);
  } catch (ex: unknown) {
    if (throwError) throw ex;
    console.error(getErrorMessage(ex));
  }
}

export async function saveRootState<RootState extends AnyObject>(
  storage: LocalForageDbMethodsCore,
  state: Partial<JSONStoreState<RootState>>,
  throwError = false
): Promise<void> {
  try {
    await Promise.all(
      Object.getOwnPropertyNames(state).map((store) =>
        saveStoreState<RootState, keyof JSONStoreState<RootState>>(
          storage,
          store as keyof JSONStoreState<RootState>,
          state[store as keyof JSONStoreState<RootState>],
          throwError
        )
      )
    );
  } catch (ex) {
    if (throwError) throw ex;
    console.error(getErrorMessage(ex));
  }
}

export async function getStoreState<
  RootState extends AnyObject,
  K extends keyof JSONStoreState<RootState>,
>(
  storage: LocalForageDbMethodsCore,
  store: K,
  defaultState?: Partial<JSONStoreState<RootState>[K]> | undefined,
  throwError = false
): Promise<Option<JSONStoreState<RootState>[K]>> {
  try {
    const state = await storage.getItem<JSONStoreState<RootState>[K]>(store as string);
    if (!state && !defaultState) return None;
    return Option.of<JSONStoreState<RootState>[K]>(
      defaultState
        ? {
            ...defaultState,
            ...(state as JSONStoreState<RootState>[K]),
          }
        : state
    );
  } catch (ex) {
    if (throwError) throw ex;
    console.error(getErrorMessage(ex));
    return None;
  }
}
