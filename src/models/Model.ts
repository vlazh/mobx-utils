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
  // value: EntityOrValue extends object ? (K extends keyof EntityOrValue ? EntityOrValue[K] : any) : any;
}

export interface InputElementLike<V = any> extends NameValue<V, any> {
  type?: string;
}

export interface InputEventLike<V = any> {
  preventDefault?: () => void;
  target: InputElementLike<V>;
}

// export interface FieldChangeHandler<Entity extends object> {
//   <K extends keyof Entity>(event: InputEventLike | NameValue<Entity, K>): void;
// }

// export type KeysOrAny<Entity extends object> = undefined extends Entity
//   ? any
//   : keyof Entity extends never
//   ? any
//   : keyof Entity;

export interface ModelLike<Entity extends object> {
  // changeField: FieldChangeHandler<Entity>;
  // changeField<K extends KeysOrAny<Entity>>(event: InputEventLike | NameValue<Entity, K>): void;
  changeField<K extends keyof Entity>(event: InputEventLike | NameValue<Entity, K>): void;
}

export function isInputEventLike<Entity extends object, K extends keyof Entity>(
  event: InputEventLike | NameValue<Entity, K>
): event is InputEventLike {
  return (event as InputEventLike).target !== undefined;
}

export default class Model<Entity extends object> implements ModelLike<Entity> {
  /**
   * Target object which will be changed by `changeField`.
   * Useful in `ViewModel`.
   */
  protected readonly target: Entity;

  constructor(target?: Entity) {
    this.target = target || (this as any);
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

  protected getFieldValue<K extends keyof Entity>(input: InputElementLike): Entity[K] {
    return input.type === 'number' ? (+input.value as any) : input.value;
  }

  changeField<K extends keyof Entity>(event: InputEventLike | NameValue<Entity, K>): void {
    let prevValue: Entity[K];
    let name: K;

    // change store's field immediately for performance purpose
    if (isInputEventLike(event)) {
      event.preventDefault && event.preventDefault();
      name = this.getFieldName(event.target);
      prevValue = this.target[name];
      this.target[name] = this.getFieldValue(event.target);
    } else {
      name = this.getFieldName(event);
      prevValue = this.target[name];
      this.target[name] = event.value as Entity[K];
    }

    this.onFieldChanged(name, prevValue);
  }

  /** Sets only declared fields in model */
  set(entity: Partial<Entity>): this {
    const { target } = this;
    Object.getOwnPropertyNames(entity).forEach(k => {
      if (k in target) {
        target[k] = entity[k];
      }
    });
    return this;
  }
}
