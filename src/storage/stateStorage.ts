import 'localforage';
import { Option, None } from '@vzh/ts-types/fp';
import { JSONModel } from '../serialization/JSONSerializable';

export type JSONStoreState<RootState extends {}> = Required<JSONModel<RootState>>;

export async function saveStoreState<
  RootState extends {},
  K extends keyof JSONStoreState<RootState>
>(
  storage: LocalForageDbMethodsCore,
  store: K,
  state?: JSONStoreState<RootState>[K],
  throwError = false
): Promise<void> {
  try {
    const prevState = await storage.getItem<JSONStoreState<RootState>[K] | undefined>(
      store as string
    );
    const nextState = prevState ? { ...prevState, ...state } : state;
    await storage.setItem(store as string, nextState);
  } catch (ex) {
    if (throwError) throw ex;
    console.error(ex.message || ex);
  }
}

export async function saveRootState<RootState extends {}>(
  storage: LocalForageDbMethodsCore,
  state: Partial<JSONStoreState<RootState>>,
  throwError = false
): Promise<void> {
  try {
    await Promise.all(
      Object.getOwnPropertyNames(state).map(store =>
        saveStoreState<RootState, keyof JSONStoreState<RootState>>(
          storage,
          store as keyof JSONStoreState<RootState>,
          state[store],
          throwError
        )
      )
    );
  } catch (ex) {
    if (throwError) throw ex;
    console.error(ex.message || ex);
  }
}

export async function getStoreState<
  RootState extends {},
  K extends keyof JSONStoreState<RootState>
>(
  storage: LocalForageDbMethodsCore,
  store: K,
  defaultState?: Partial<JSONStoreState<RootState>[K]>,
  throwError = false
): Promise<Option<JSONStoreState<RootState>[K]>> {
  try {
    const state = await storage.getItem<JSONStoreState<RootState>[K] | undefined>(store as string);
    if (!state && !defaultState) return None;
    return Option.of(defaultState ? { ...defaultState, ...state } : state);
  } catch (ex) {
    if (throwError) throw ex;
    console.error(ex.message || ex);
    return None;
  }
}
