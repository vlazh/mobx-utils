import { Diff } from '@vzh/ts-types';
import { inject, IReactComponent, IStoresToProps } from 'mobx-react';

type TypedInject = <I extends object, P extends object, S = any>(
  mapStoreToProps: IStoresToProps<S, P, I>
) => (component: IReactComponent<P & I>) => IReactComponent<Diff<P, I>>;

const typedInject = inject as TypedInject;
export default typedInject;
