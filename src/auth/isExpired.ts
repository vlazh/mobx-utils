export interface BaseJwtDecoded {
  readonly exp: number;
}

export function isExpired(decoded: BaseJwtDecoded): boolean {
  const tokenExpiration = decoded.exp;
  return !!tokenExpiration && new Date(tokenExpiration * 1000).getTime() - Date.now() < 0;
}
