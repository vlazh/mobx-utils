/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable class-methods-use-this */

/**
 * NameValue<Type> = { value: Type, name: string }
 * NameValue<Type, keyof Type> = { value: Type, name: keyof Type }
 */
export interface NameValue<EntityOrValue, K extends keyof EntityOrValue = any> {
  name: undefined extends K ? string : Exclude<K, never> extends never ? string : K;
  value: undefined extends K
    ? EntityOrValue
    : Exclude<K, never> extends never
    ? any
    : EntityOrValue[K];
  // value: EntityOrValue extends AnyObject ? (K extends keyof EntityOrValue ? EntityOrValue[K] : any) : any;
}

export interface InputElementLike<V = any> extends NameValue<V, any> {
  type?: string | undefined;
}

export interface InputEventLike<V = any> {
  preventDefault?: VoidFunction | undefined;
  target: InputElementLike<V>;
}

// export interface FieldChangeHandler<Entity extends AnyObject> {
//   <K extends keyof Entity>(event: InputEventLike | NameValue<Entity, K>): void;
// }

// export type KeysOrAny<Entity extends AnyObject> = undefined extends Entity
//   ? any
//   : keyof Entity extends never
//   ? any
//   : keyof Entity;

export interface ModelLike<Entity extends AnyObject> {
  // changeField: FieldChangeHandler<Entity>;
  // changeField<K extends KeysOrAny<Entity>>(event: InputEventLike | NameValue<Entity, K>): void;
  changeField<K extends keyof Entity>(event: InputEventLike | NameValue<Entity, K>): void;
}

export function isInputEventLike<Entity extends AnyObject, K extends keyof Entity>(
  event: InputEventLike | NameValue<Entity, K>
): event is InputEventLike {
  return (event as InputEventLike).target !== undefined;
}

export interface ModelSetOptions {
  /** If true then don't fire onFieldChanged */
  silent?: boolean | undefined;
  errorIfUnknownField?: boolean | undefined;
}

export default class Model<Entity extends AnyObject> implements ModelLike<Entity> {
  /**
   * Target object which will be changed by `changeField`.
   * Useful in `ViewModel`.
   */
  protected readonly target: Entity;

  constructor(target?: Entity | undefined) {
    this.target = target || (this as unknown as Entity);
    // to avoid circular dependencies on self
    const desc = Object.getOwnPropertyDescriptor(this, 'target');
    Object.defineProperty(this, 'target', { ...desc, enumerable: false });
  }

  protected onFieldChanged<K extends keyof Entity>(_name: K, _prevValue: Entity[K]): void {}

  protected getFieldName<K extends keyof Entity>(input: NameValue<any, any>): K {
    if (input.name && input.name in this.target) {
      return input.name as K;
    }

    throw new Error(`Property '${input.name}' not found in model.`);
  }

  protected getFieldValue<K extends keyof Entity>(
    input: InputElementLike,
    fallback: Entity[K]
  ): Entity[K] {
    if (input.type === 'number') {
      const nextValue = +input.value;
      if (Number.isNaN(nextValue)) return fallback;
      return nextValue as any;
    }
    return input.value;
  }

  changeField<K extends keyof Entity>(event: InputEventLike | NameValue<Entity, K>): void {
    let prevValue: Entity[K];
    let name: K;

    // change store's field immediately for performance purpose
    if (isInputEventLike(event)) {
      event.preventDefault && event.preventDefault();
      name = this.getFieldName(event.target);
      prevValue = this.target[name];
      const nextValue = this.getFieldValue(event.target, prevValue);
      if (nextValue === prevValue) return; // Unchanged, so just exit
      this.target[name] = nextValue;
    } else {
      name = this.getFieldName(event);
      prevValue = this.target[name];
      this.target[name] = event.value as Entity[K];
    }

    this.onFieldChanged(name, prevValue);
  }

  /** Sets only declared fields in model */
  set(entity: Partial<Entity>, { silent, errorIfUnknownField = true }: ModelSetOptions = {}): this {
    const { target } = this;
    Object.getOwnPropertyNames(entity).forEach((k) => {
      if (k in target) {
        const prevValue = target[k];
        const nextValue = entity[k];
        if (prevValue === nextValue) return; // Skip if unchanged
        target[k as keyof Entity] = entity[k] as Entity[typeof k];
        !silent && this.onFieldChanged(k as keyof Entity, prevValue);
      } else if (errorIfUnknownField) {
        throw new Error(`Property '${k}' not found in model.`);
      }
    });
    return this;
  }
}
