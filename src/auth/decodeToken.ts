import { jwtDecode } from 'jwt-decode';
import { Try } from '@js-toolkit/utils/fp/Try';
import type { Option } from '@js-toolkit/utils/fp/Option';
import type { BaseJwtDecoded } from './isExpired';

export function decodeToken<JwtDecoded extends BaseJwtDecoded>(token: string): Option<JwtDecoded> {
  return Try.of(() => jwtDecode<JwtDecoded>(token))
    .recover((err) => {
      console.error(err);
      throw err;
    })
    .toOption();
}
