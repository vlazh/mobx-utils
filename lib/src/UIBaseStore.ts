import LoadableStore from './LoadableStore';

export default abstract class UIBaseStore<RS, N> extends LoadableStore<RS> {
  abstract notifications: N;

  abstract cleanNotifications(): void;
}
