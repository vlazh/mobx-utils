import { Reaction, IReactionDisposer, $mobx } from 'mobx';

function isReaction(value: any): value is Reaction {
  return value && typeof value === 'object' && value.isMobXReaction === true;
}

function isReactionDisposer(value: any): value is IReactionDisposer {
  return value && typeof value === 'function' && isReaction((value as IReactionDisposer)[$mobx]);
}

export function disposeMobxReactions(value: any) {
  if (isReactionDisposer(value)) {
    value();
  }
}

export default abstract class DisposableStore {
  dispose(callback?: (name: string, value: any) => void) {
    Object.entries(this).forEach(([name, value]) => {
      if (callback) callback(name, value);
      else disposeMobxReactions(value);
    });
  }
}
