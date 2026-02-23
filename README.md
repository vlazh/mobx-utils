# @js-toolkit/mobx-utils

[![npm package](https://img.shields.io/npm/v/@js-toolkit/mobx-utils.svg?style=flat-square)](https://www.npmjs.org/package/@js-toolkit/mobx-utils)
[![license](https://img.shields.io/npm/l/@js-toolkit/mobx-utils.svg?style=flat-square)](https://www.npmjs.org/package/@js-toolkit/mobx-utils)

MobX utilities: store management with `createStore` / `createRootStore`, serialization, LocalForage-based state persistence, and JWT helpers.

## Install

```bash
yarn add @js-toolkit/mobx-utils
# or
npm install @js-toolkit/mobx-utils
```

Requires `mobx` as a peer dependency.

## Import

```typescript
import { createStore, createRootStore, attachSelectors } from '@js-toolkit/mobx-utils/store/object';
import { serialize } from '@js-toolkit/mobx-utils/serialization/serialize';
```

## API Overview

### Store Management (`store/object`)

| Export | Description |
|--------|-------------|
| `createStore` | Create a MobX store with `init`, `update`, `reset`, `getSnapshot` |
| `createRootStore` | Create a root store that manages child stores |
| `attachSelectors` | Attach computed selectors to a root store |
| `updateState` | Update store state with a patch |
| `getSnapshot` | Get a plain JS snapshot of store state |
| `isStore`, `isRootStore` | Type guards |

### Serialization (`serialization/serialize`)

| Export | Description |
|--------|-------------|
| `serialize` | Recursively serialize objects (handles dates, Option, custom serializers) |

### Storage (`storage`)

| Export | Description |
|--------|-------------|
| `saveStoreState` | Save a single store state to LocalForage |
| `saveRootState` | Save multiple stores to LocalForage |
| `getStoreState` | Retrieve store state from LocalForage (returns `Option`) |

### Auth (`auth`)

| Export | Description |
|--------|-------------|
| `decodeToken` | Decode JWT token (returns `Option`) |
| `isExpired` | Check if JWT token is expired |

### Utilities

| Export | Description |
|--------|-------------|
| `hasIn` | Type-safe wrapper around MobX `has` |
| `isArray` | Type guard for arrays (including MobX observable arrays) |

## Usage Examples

### Create stores

```typescript
import { observable } from 'mobx';
import { createStore, createRootStore, attachSelectors } from '@js-toolkit/mobx-utils/store/object';

const root = createRootStore({
  auth: createStore({
    token: '',
    username: '',
  }),
  ui: createStore(
    {
      theme: 'light' as 'light' | 'dark',
      items: [] as string[],
    },
    {
      items: observable.shallow,
    }
  ),
});

const store = attachSelectors(root, {
  get isLoggedIn(): boolean {
    return root.auth.token.length > 0;
  },
});

store.auth.update({ token: 'abc123' });
console.log(store.isLoggedIn); // true
store.auth.reset();
```

### Serialize store state

```typescript
import { serialize } from '@js-toolkit/mobx-utils/serialization/serialize';

const snapshot = serialize(store.auth);
```

### Persist and restore state

```typescript
import { saveStoreState, getStoreState } from '@js-toolkit/mobx-utils/storage';

await saveStoreState<typeof root>('auth', root.auth);
const saved = await getStoreState<typeof root>('auth');
if (saved.nonEmpty()) {
  root.auth.update(saved.get());
}
```

### JWT helpers

```typescript
import { decodeToken } from '@js-toolkit/mobx-utils/auth/decodeToken';
import { isExpired } from '@js-toolkit/mobx-utils/auth/isExpired';

const decoded = decodeToken(token);
if (decoded.nonEmpty() && !isExpired(decoded.get())) {
  // token is valid
}
```

## Repository

[https://github.com/vlazh/mobx-utils](https://github.com/vlazh/mobx-utils)
