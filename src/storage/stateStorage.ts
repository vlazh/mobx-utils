import 'localforage';
import { Option, None } from '@vzh/ts-types/fp';
import { JSONModel } from '../JSONSerializable';

export type JSONStoreState<RootState extends {}> = Required<JSONModel<RootState>>;

export async function saveRootState<RootState extends {}>(
  storage: LocalForageDbMethodsCore,
  state: Partial<JSONStoreState<RootState>>,
  throwError: boolean = false
): Promise<void> {
  try {
    await Promise.all(
      Object.getOwnPropertyNames(state).map(async prop => {
        const prevState = await storage.getItem<{} | undefined>(prop);
        await storage.setItem(prop, prevState ? { ...prevState, ...state[prop] } : state[prop]);
      })
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
  mergeWith?: Partial<JSONStoreState<RootState>[K]>,
  throwError: boolean = false
): Promise<Option<JSONStoreState<RootState>[K]>> {
  try {
    const state = await storage.getItem<JSONStoreState<RootState>[K] | undefined>(store as string);
    if (!state && !mergeWith) return None;
    return Option.of(mergeWith ? { ...mergeWith, ...state } : state);
  } catch (ex) {
    if (throwError) throw ex;
    console.error(ex.message || ex);
    return None;
  }
}
