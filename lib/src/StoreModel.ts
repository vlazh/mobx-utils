import { action } from 'mobx';

export interface InputElementLike<V = any> {
  // getAttribute?: (name: string) => string | null;
  // id?: string;
  type?: string;
  name?: string;
  value: V;
}

export interface InputEventLike<V = any> {
  preventDefault?: () => void;
  target: InputElementLike<V>;
}

export default class StoreModel<Entity extends object> {
  constructor() {
    this.changeField = this.changeField.bind(this);
  }

  protected onModelChanged(_: keyof Entity) {}

  protected getFieldName(input: InputElementLike): string {
    if (input.name && input.name in this) {
      return input.name;
    }

    throw new Error(`Not found property '${input.name}' in model.`);
  }

  @action
  changeField(event: InputEventLike) {
    event.preventDefault && event.preventDefault();

    const { target: el } = event;
    const name = this.getFieldName(el);
    this[name] = el.type === 'number' ? +el.value : el.value;
    this.onModelChanged(name as keyof Entity);
  }
}
