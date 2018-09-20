export interface NameValue<V = any> {
  name: string;
  value: V;
}

export interface InputElementLike<V = any> extends NameValue<V> {
  type?: string;
}

export interface InputEventLike<V = any> {
  preventDefault?: () => void;
  target: InputElementLike<V>;
}

export interface ChangeFieldHandler {
  (event: InputEventLike | NameValue): void;
}

export interface ModelLike {
  changeField: ChangeFieldHandler;
}

export function isInputEventLike(event: InputEventLike | NameValue): event is InputEventLike {
  return (event as InputEventLike).target !== undefined;
}

export default class Model<Entity extends object> implements ModelLike {
  protected readonly target: object;

  constructor(target?: object) {
    this.target = target || this;
    // to avoid circular dependencies on self
    const desc = Object.getOwnPropertyDescriptor(this, 'target');
    Object.defineProperty(this, 'target', { ...desc, enumerable: false });
  }

  // @ts-ignore
  // eslint-disable-next-line no-empty-function
  protected onModelChanged(name: keyof Entity, prevValue: any) {}

  protected getFieldName(input: NameValue): string {
    if (input.name && input.name in this.target) {
      return input.name;
    }

    throw new Error(`Not found property '${input.name}' in model.`);
  }

  protected getFieldValue(input: InputElementLike): any {
    return input.type === 'number' ? +input.value : input.value;
  }

  changeField(event: InputEventLike | NameValue) {
    const prevValue = this.target[name];

    // change store's field immediately for performance purpose
    if (isInputEventLike(event)) {
      event.preventDefault && event.preventDefault();
      const name = this.getFieldName(event.target);
      this.target[name] = this.getFieldValue(event.target);
    } else {
      const name = this.getFieldName(event);
      this.target[name] = this.getFieldValue(event);
    }

    this.onModelChanged(name as keyof Entity, prevValue);
  }
}
