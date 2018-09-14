export default abstract class BaseStore<RS> {
  constructor(protected readonly rootStore: RS) {}
}
