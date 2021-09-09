import { action } from 'mobx';
import Model from './Model';

export default class StoreModel<Entity extends AnyObject> extends Model<Entity> {
  constructor() {
    super();
    this.changeField = action(this.changeField.bind(this));
    this.set = action(this.set.bind(this));
  }
}
