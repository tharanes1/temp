/**
 * JWT minting + verification. Locked decision A2:
 *   • access  = 3 minutes
 *   • refresh = 2 days, one-time-use rotation, reuse-detection
 *
 * Tokens carry distinct `type` claims so an access can never be used as a
 * refresh and vice versa.
 */
import { Config } from '@cravix/shared-config';
import { UnauthorizedError } from '@cravix/shared-errors';
import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';
import { v7 as uuidv7 } from 'uuid';

export interface AccessClaims extends JwtPayload {
  sub: string;
  phone: string;
  role: 'rider';
  type: 'access';
  jti: string;
}

export interface RefreshClaims extends JwtPayload {
  sub: string;
  phone: string;
  type: 'refresh';
  jti: string;
}

interface MintArgs {
  riderId: string;
  phone: string;
}

const accessOpts: SignOptions = {
  algorithm: 'HS256',
  expiresIn: Config.JWT_ACCESS_EXPIRY as SignOptions['expiresIn'],
  issuer: Config.JWT_ISSUER,
  audience: Config.JWT_AUDIENCE,
};

const refreshOpts: SignOptions = {
  algorithm: 'HS256',
  expiresIn: Config.JWT_REFRESH_EXPIRY as SignOptions['expiresIn'],
  issuer: Config.JWT_ISSUER,
  audience: Config.JWT_AUDIENCE,
};

export function mintAccess({ riderId, phone }: MintArgs): { token: string; jti: string; expiresIn: number } {
  const jti = uuidv7();
  const token = jwt.sign(
    { phone, role: 'rider' as const, type: 'access' as const, jti },
    Config.JWT_ACCESS_SECRET,
    { ...accessOpts, subject: riderId },
  );
  return { token, jti, expiresIn: parseExpiryToSeconds(Config.JWT_ACCESS_EXPIRY) };
}

export function mintRefresh({ riderId, phone }: MintArgs): { token: string; jti: string; expiresIn: number } {
  const jti = uuidv7();
  const token = jwt.sign(
    { phone, type: 'refresh' as const, jti },
    Config.JWT_REFRESH_SECRET,
    { ...refreshOpts, subject: riderId },
  );
  return { token, jti, expiresIn: parseExpiryToSeconds(Config.JWT_REFRESH_EXPIRY) };
}

export function verifyAccessToken(token: string): AccessClaims {
  const secrets = [Config.JWT_ACCESS_SECRET, Config.JWT_ACCESS_SECRET_PREVIOUS].filter(Boolean) as string[];
  let lastErr: Error | null = null;
  for (const secret of secrets) {
    try {
      const decoded = jwt.verify(token, secret, {
        algorithms: ['HS256'],
        issuer: Config.JWT_ISSUER,
        audience: Config.JWT_AUDIENCE,
      }) as AccessClaims;
      if (decoded.type !== 'access') throw new UnauthorizedError('Wrong token type');
      return decoded;
    } catch (e) {
      lastErr = e as Error;
    }
  }
  throw new UnauthorizedError(lastErr?.message ?? 'Invalid token');
}

export function verifyRefreshToken(token: string): RefreshClaims {
  try {
    const decoded = jwt.verify(token, Config.JWT_REFRESH_SECRET, {
      algorithms: ['HS256'],
      issuer: Config.JWT_ISSUER,
      audience: Config.JWT_AUDIENCE,
    }) as RefreshClaims;
    if (decoded.type !== 'refresh') throw new UnauthorizedError('Wrong token type');
    return decoded;
  } catch (e) {
    throw new UnauthorizedError(e instanceof Error ? e.message : 'Invalid refresh token');
  }
}

/** "3m" → 180, "2d" → 172800 */
export function parseExpiryToSeconds(expr: string): number {
  const m = /^(\d+)(s|m|h|d)$/.exec(expr);
  if (!m) throw new Error(`Invalid expiry: ${expr}`);
  const n = Number(m[1]);
  switch (m[2]) {
    case 's': return n;
    case 'm': return n * 60;
    case 'h': return n * 3600;
    case 'd': return n * 86_400;
    default: throw new Error(`Invalid expiry unit: ${m[2]}`);
  }
}
