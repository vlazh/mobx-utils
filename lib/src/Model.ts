export interface NameValue<Entity extends object, K extends keyof Entity> {
  name: undefined extends K ? string : K;
  value: undefined extends K ? any : Entity[K];
}

export interface InputElementLike extends NameValue<any, any> {
  type?: string;
}

export interface InputEventLike {
  preventDefault: () => void;
  target: InputElementLike;
}

export interface ChangeFieldHandler<Entity extends object> {
  <K extends keyof Entity>(event: InputEventLike | NameValue<Entity, K>): void;
}

export interface ModelLike<Entity extends object> {
  changeField: ChangeFieldHandler<Entity>;
}

export function isInputEventLike<Entity extends object, K extends keyof Entity>(
  event: InputEventLike | NameValue<Entity, K>
): event is InputEventLike {
  return (event as InputEventLike).target !== undefined;
}

export default class Model<Entity extends object> implements ModelLike<Entity> {
  /** Target object which will be changed by `changeField`. */
  protected readonly target: Entity;

  constructor(target?: Entity) {
    this.target = target || (this as any);
    // to avoid circular dependencies on self
    const desc = Object.getOwnPropertyDescriptor(this, 'target');
    Object.defineProperty(this, 'target', { ...desc, enumerable: false });
  }

  // @ts-ignore
  // eslint-disable-next-line no-empty-function
  protected onModelChanged<K extends keyof Entity>(name: keyof Entity, prevValue: Entity[K]) {}

  protected getFieldName<K extends keyof Entity>(input: NameValue<any, any>): K {
    if (input.name && input.name in this.target) {
      return input.name as K;
    }

    throw new Error(`Not found property '${input.name}' in model.`);
  }

  protected getFieldValue<K extends keyof Entity>(input: InputElementLike): Entity[K] {
    return input.type === 'number' ? (+input.value as any) : input.value;
  }

  changeField<K extends keyof Entity>(event: InputEventLike | NameValue<Entity, K>) {
    let prevValue: Entity[K];

    // change store's field immediately for performance purpose
    if (isInputEventLike(event)) {
      event.preventDefault && event.preventDefault();
      const name = this.getFieldName(event.target);
      prevValue = this.target[name] as Entity[K];
      this.target[name] = this.getFieldValue(event.target);
    } else {
      const name = this.getFieldName(event);
      prevValue = this.target[name] as Entity[K];
      this.target[name] = event.value;
    }

    this.onModelChanged(name, prevValue);
  }
}
