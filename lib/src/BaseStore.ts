// import {  } from 'mobx';

export default abstract class BaseStore<RS> {
  constructor(protected readonly rootStore: RS) {}

  // toJSON() {
  //   return toJSON(this);
  // }
}
