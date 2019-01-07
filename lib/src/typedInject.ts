import { Merge } from '@vzh/ts-types';
import { inject, IReactComponent, IStoresToProps } from 'mobx-react';

type TypedInject = <I extends object, P extends I, S = any>(
  mapStoreToProps: IStoresToProps<S, P, I>
) => (component: IReactComponent<P>) => IReactComponent<Merge<P, Partial<I>>>;

export default inject as TypedInject;
