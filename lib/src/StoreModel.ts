import { action } from 'mobx';

export interface NameValue<V> {
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
  (event: InputEventLike | NameValue<any>): void;
}

export interface StoreModelLike {
  changeField: ChangeFieldHandler;
}

export function isInputEventLike(event: InputEventLike | NameValue<any>): event is InputEventLike {
  return (event as InputEventLike).target !== undefined;
}

export default class StoreModel<Entity extends object> implements StoreModelLike {
  constructor() {
    this.changeField = this.changeField.bind(this);
  }

  // @ts-ignore
  // eslint-disable-next-line no-empty-function
  protected onModelChanged(name: keyof Entity, prevValue: any) {}

  protected getFieldName(input: NameValue<any>): string {
    if (input.name && input.name in this) {
      return input.name;
    }

    throw new Error(`Not found property '${input.name}' in model.`);
  }

  protected getFieldValue(input: InputElementLike): any {
    return input.type === 'number' ? +input.value : input.value;
  }

  @action
  changeField(event: InputEventLike | NameValue<any>) {
    const prevValue = this[name];

    // change store's field immediately for performance purpose
    if (isInputEventLike(event)) {
      event.preventDefault && event.preventDefault();
      const name = this.getFieldName(event.target);
      this[name] = this.getFieldValue(event.target);
    } else {
      const name = this.getFieldName(event);
      this[name] = this.getFieldValue(event);
    }

    this.onModelChanged(name as keyof Entity, prevValue);
  }
}
