import { Reaction, type IReactionDisposer, $mobx } from 'mobx';

export function isReaction(value: unknown): value is Reaction {
  return !!value && typeof value === 'object' && (value as AnyObject).isMobXReaction === true;
}

export function isReactionDisposer(value: unknown): value is IReactionDisposer {
  return (
    !!value &&
    typeof value === 'function' &&
    isReaction((value as AnyFunction & Record<typeof $mobx, unknown>)[$mobx])
  );
}

export function disposeMobxReactions(value: any): void {
  if (isReactionDisposer(value)) {
    value();
  }
}

export default abstract class CleanerDisposer {
  /**
   * Dispose reactions recursively.
   * @param callback If callback returns true then do nothing for that name
   */
  dispose(callback?: ((name: string, value: any) => boolean) | undefined): void {
    Object.entries(this).forEach(([name, value]) => {
      if (value === this) return; // Skip self referencies. For example, `jsonModel` in `SerializableModel`.
      if (callback && callback(name, value)) return;
      if (value instanceof CleanerDisposer) value.dispose();
      else disposeMobxReactions(value);
    });
  }

  /**
   * Clean recursively.
   * @param callback If callback returns true then do nothing for that name
   */
  clean(callback?: ((name: string, value: any) => boolean) | undefined): void {
    Object.entries(this).forEach(([name, value]) => {
      if (value === this) return; // Skip self referencies. For example, `jsonModel` in `SerializableModel`.
      if (callback && callback(name, value)) return;
      if (value instanceof CleanerDisposer) value.clean();
    });
  }
}
