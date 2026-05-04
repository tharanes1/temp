/**
 * Socket.IO handshake authentication.
 *
 * Locked decision A2 — the **access** token is presented in
 * `socket.handshake.auth.token`.  Refresh tokens are rejected.  When the
 * access token expires the client reconnects with the freshly-minted access
 * (axios interceptor + a `socket.disconnect()/.connect()` after refresh).
 */
import { Config } from '@cravix/shared-config';
import { logger } from '@cravix/shared-logger';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import type { Socket } from 'socket.io';

import type { SocketData } from '../types.js';

interface AccessClaims extends JwtPayload {
  sub: string;
  phone: string;
  type: 'access' | 'refresh';
  jti: string;
  role: 'rider';
}

export function authHandshake(
  socket: Socket<unknown, unknown, unknown, SocketData>,
  next: (err?: Error) => void,
): void {
  const headerToken = (socket.handshake.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
  const authToken = (socket.handshake.auth?.token as string | undefined) ?? headerToken;

  if (!authToken) {
    return next(new Error('Authentication required'));
  }

  try {
    const secrets = [Config.JWT_ACCESS_SECRET, Config.JWT_ACCESS_SECRET_PREVIOUS].filter(
      Boolean,
    ) as string[];
    let decoded: AccessClaims | null = null;
    let lastErr: Error | null = null;
    for (const secret of secrets) {
      try {
        decoded = jwt.verify(authToken, secret, {
          algorithms: ['HS256'],
          issuer: Config.JWT_ISSUER,
          audience: Config.JWT_AUDIENCE,
        }) as AccessClaims;
        break;
      } catch (e) {
        lastErr = e as Error;
      }
    }
    if (!decoded) throw lastErr ?? new Error('Invalid token');
    if (decoded.type !== 'access') throw new Error('Wrong token type');
    if (!decoded.sub) throw new Error('Missing subject claim');

    socket.data = {
      riderId: decoded.sub,
      phone: decoded.phone,
      jti: decoded.jti,
    };
    return next();
  } catch (e) {
    logger.warn('socket: handshake rejected', { err: (e as Error).message });
    return next(new Error('Authentication failed'));
  }
}
