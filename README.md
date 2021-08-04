# MobX Utils

![GitHub package.json version](https://img.shields.io/github/package-json/v/vlazh/mobx-utils)

Base classes and utilities of mobx stores and validable mobx models.

## Example

#### RootStore

```ts
import { action } from 'mobx';
import { BaseRootStore, NotificationsStore, WorkerStore } from '@vzh/mobx-utils/stores';
import { JSONModel, JSONSerializable } from '@vzh/mobx-utils/serialization';
import AuthStore from './AuthStore';
import AppStore from './AppStore';
import SignUpStore from './SignUpStore';
import SignInStore from './SignInStore';

export type RootStoreState = Pick<Partial<RootStore>, 'appStore' | 'authStore'>;

export default class RootStore extends BaseRootStore implements JSONSerializable<RootStoreState> {
  readonly _serializable = this;

  readonly authStore: AuthStore;

  readonly appStore: AppStore;

  readonly signInStore: SignInStore;

  readonly signUpStore: SignUpStore;

  // ...

  constructor(initialState: Partial<JSONModel<RootStoreState>> = {}) {
    super();
    const appNotificationsStore = this.createNotificationsStore();
    const appWorkerStore = this.createWorkerStore();

    this.authStore = new AuthStore(
      this,
      appNotificationsStore,
      appWorkerStore,
      initialState.authStore
    );
    this.appStore = new AppStore(
      this,
      appNotificationsStore,
      appWorkerStore,
      initialState.appStore
    );

    this.signInStore = new SignInStore(this, appNotificationsStore, appWorkerStore);
    this.signUpStore = new SignUpStore(this, appNotificationsStore, appWorkerStore);
  }

  createNotificationsStore(): NotificationsStore<this, AppNotification> {
    return new NotificationsStore<this, AppNotification>(this, 10000);
  }

  createWorkerStore<TaskKeys extends string = never>(): WorkerStore<this, TaskKeys> {
    return new WorkerStore(this);
  }

  toJSON(): JSONModel<RootStoreState> {
    return {
      appStore: this.appStore.toJSON(),
      authStore: this.authStore.toJSON(),
    };
  }
}
```

#### AppStore

```ts
import { RequestableStore, NotificationsStore, WorkerStore } from '@vzh/mobx-utils/stores';
import RootStore from './RootStore';

export default class AppStore
  extends RequestableStore<
    RootStore,
    NotificationsStore<RootStore, AppNotification>,
    WorkerStore<RootStore>
  >
  implements JSONSerializable<AppStore> {
  readonly _serializable = this;

  // ...

  constructor(
    rootStore: RootStore,
    notifications: NotificationsStore<RootStore, AppNotification>,
    worker: WorkerStore<RootStore>,
    initialState?: JSONModel<AppStore>
  ) {
    super(rootStore, notifications, worker);
    if (initialState) {
      // ...
    }
  }

  @withRequest<AppStore>({
    // Keep live last result of call of loadData for 10min or while authStore.sessionId is changed.
    memo: { lifetime: 60 * 10, inputs: (self) => [self.rootStore.authStore.sessionId] },
  })
  loadData = flow(function* loadData(this: AppStore) {
    const { authStore } = this.rootStore;

    if (authStore.isLoggedIn) {
      const data = yield api.fetchSomeData();
      // ...
    } else {
      const data = yield api.fetchOtherData();
      // ...
    }
  });

  toJSON(): JSONModel<AppStore> {
    return {
      // ...
    };
  }
}
```

#### AppView

```tsx
import React, { useEffect } from 'react';
import { observer } from 'mobx-react-lite';

function AppView({ rootStore }: AppViewProps): JSX.Element {
  const {
    authStore,
    appStore,
    appStore: { notifications, worker },
  } = rootStore;

  useEffect(() => {
    appStore.loadData();
  }, [appStore, authStore.isLoggedIn]);

  return (
    <RootStoreContext.Provider value={rootStore}>
      <AppLoader loading={worker.isPending()} />
      <AppNotifications notifications={notifications} position="window-top" />
    </RootStoreContext.Provider>
  );
}

export default observer(AppView);
```
