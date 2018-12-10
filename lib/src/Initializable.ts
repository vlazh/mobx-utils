export default interface Initializable {
  init(): void;
}

export function isInitializable(obj: Initializable | object): obj is Initializable {
  return (obj as Initializable).init !== undefined;
}
