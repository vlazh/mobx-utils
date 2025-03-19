# MobX Utils

[![npm package](https://img.shields.io/npm/v/@js-toolkit/mobx-utils.svg?style=flat-square)](https://www.npmjs.org/package/@js-toolkit/mobx-utils)

Useful utils for mobx.

```ts
import { observable } from 'mobx';
import { attachSelectors, createRootStore, createStore } from '@js-toolkit/mobx-utils/store/object';

const rootStore0 = createRootStore({
  store1: createStore(
    {
      prop1: 0,
      prop2: 0,
      prop3: [],
      prop4: '',
      method: () => {},
    },
    {
      prop3: observable.shallow,
      prop4: false,
    }
  ),
});

const rootStore = attachSelectors(rootStore0, {
  get isProp1(): boolean {
    return root.store1.prop1 > 0;
  },
});
```
