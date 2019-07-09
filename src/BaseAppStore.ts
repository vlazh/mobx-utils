import { observable, computed, action, runInAction } from 'mobx';
import jwtDecode from 'jwt-decode';
import { Option, None, Try } from '@vzh/ts-types/fp';
import RequestableStore from './RequestableStore';
import UIStore from './UIStore';

export interface BaseJwtDecoded {
  readonly exp: number;
}

export function isExpired(decoded: BaseJwtDecoded): boolean {
  const tokenExpiration = decoded.exp;
  return !!tokenExpiration && new Date(tokenExpiration * 1000).getTime() - Date.now() < 0;
}

export function decodeToken<JwtDecoded extends BaseJwtDecoded>(token: string): Option<JwtDecoded> {
  return Try.of(() => jwtDecode<JwtDecoded>(token))
    .recover(err => {
      console.error(err);
      throw err;
    })
    .toOption();
}

export default class BaseAppStore<
  JwtDecoded extends BaseJwtDecoded,
  RS extends object,
  UIS extends UIStore<RS>,
  InitState extends object = {}
> extends RequestableStore<RS, UIS, InitState> {
  @observable
  protected decoded: Option<JwtDecoded> = None;

  protected token: Option<string> = None;

  get accessToken(): Option<string> {
    return this.token;
  }

  @computed
  get isLoggedIn(): boolean {
    return !this.decoded.map(isExpired).getOrElse(true);
  }

  @action
  updateToken(token: Option<string>): void {
    if (this.token.equals(token)) return;
    this.token = token;
    token.fold(
      () => {
        runInAction(() => {
          this.decoded = None;
        });
      },
      t => {
        runInAction(() => {
          this.decoded = decodeToken(t);
        });
      }
    );
  }
}
