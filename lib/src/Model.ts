/**
 * NameValue<Type> = { value: Type, name: string }
 * NameValue<Type, keyof Type> = { value: Type, name: keyof Type }
 */
export interface NameValue<EntityOrValue, K extends keyof EntityOrValue = any> {
  name: undefined extends K ? string : K;
  value: undefined extends K ? EntityOrValue : EntityOrValue[K]; // : EntityOrValue extends object ? (K extends keyof EntityOrValue ? EntityOrValue[K] : any) : any;
}

export interface InputElementLike extends NameValue<any, any> {
  type?: string;
}

export interface InputEventLike {
  preventDefault: () => void;
  target: InputElementLike;
}

export interface FieldChangeHandler<Entity extends object> {
  <K extends keyof Entity>(event: InputEventLike | NameValue<Entity, K>): void;
}

export interface ModelLike<Entity extends object> {
  changeField: FieldChangeHandler<Entity>;
}

export function isInputEventLike<Entity extends object, K extends keyof Entity>(
  event: InputEventLike | NameValue<Entity, K>
): event is InputEventLike {
  return (event as InputEventLike).target !== undefined;
}

/* eslint-disable no-empty-function */

export default class Model<Entity extends object> implements ModelLike<Entity> {
  /** Target object which will be changed by `changeField`. */
  protected readonly target: Entity;

  constructor(target?: Entity) {
    this.target = target || (this as any);
    // to avoid circular dependencies on self
    const desc = Object.getOwnPropertyDescriptor(this, 'target');
    Object.defineProperty(this, 'target', { ...desc, enumerable: false });
  }

  protected onModelChanged<K extends keyof Entity>(
    // @ts-ignore
    name: NameValue<Entity, K>['name'],
    // @ts-ignore
    prevValue: NameValue<Entity, K>['value']
  ) {}

  protected getFieldName<K extends keyof Entity>(
    input: NameValue<any, any>
  ): NameValue<Entity, K>['name'] {
    if (input.name && input.name in this.target) {
      return input.name as NameValue<Entity, K>['name'];
    }

    throw new Error(`Not found property '${input.name}' in model.`);
  }

  protected getFieldValue<K extends keyof Entity>(
    input: InputElementLike
  ): NameValue<Entity, K>['value'] {
    return input.type === 'number' ? (+input.value as any) : input.value;
  }

  changeField<K extends keyof Entity>(event: InputEventLike | NameValue<Entity, K>) {
    let prevValue: NameValue<Entity, K>['value'];
    let name: NameValue<Entity, K>['name'];

    // change store's field immediately for performance purpose
    if (isInputEventLike(event)) {
      event.preventDefault && event.preventDefault();
      name = this.getFieldName(event.target);
      prevValue = this.target[name as PropertyKey];
      this.target[name as PropertyKey] = this.getFieldValue(event.target);
    } else {
      name = this.getFieldName(event);
      prevValue = this.target[name as PropertyKey];
      this.target[name as PropertyKey] = event.value;
    }

    this.onModelChanged(name, prevValue);
  }
}
