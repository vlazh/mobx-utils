import { inject, IReactComponent, IStoresToProps } from 'mobx-react';
import { Omit } from './types';

type TypedInject = <I, P extends I, S = any>(
  mapStoreToProps: IStoresToProps<S, P, I>
) => (component: IReactComponent<P>) => IReactComponent<Omit<P, keyof I> & Partial<I>>;

export default inject as TypedInject;
