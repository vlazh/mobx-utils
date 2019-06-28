import { observable, computed, action } from 'mobx';
import jwtDecode from 'jwt-decode';
import { Option, None, Try } from '@vzh/ts-types/fp';
import RequestableStore from './RequestableStore';
import UIStore from './UIStore';

export interface BaseJwtDecoded {
  readonly exp: number;
}

function expired(decoded: BaseJwtDecoded): boolean {
  const tokenExpiration = decoded.exp;
  return !!tokenExpiration && new Date(tokenExpiration * 1000).getTime() - Date.now() < 0;
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
    return !this.decoded.map(expired).getOrElse(true);
  }

  protected clearAuth(): void {
    this.decoded = None;
  }

  protected applyToken(token: string): void {
    this.decoded = Try.of(() => jwtDecode<JwtDecoded>(token))
      .recover(err => {
        console.error(err);
        throw err;
      })
      .toOption();
  }

  @action
  updateToken(token: Option<string>): void {
    if (this.token.equals(token)) return;
    this.clearAuth();
    this.token = token;
    this.token.forEach(t => this.applyToken(t));
  }
}
