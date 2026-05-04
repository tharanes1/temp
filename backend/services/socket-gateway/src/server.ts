/**
 * Socket.IO server bootstrap.
 *
 *   • Express-less HTTP server purely for the WS upgrade.
 *   • Redis adapter for cross-instance fan-out (spec §2).
 *   • JWT handshake middleware.
 *   • Per-rider room `rider:{id}` for direct emits from the API gateway.
 */
import { createServer, type Server as HttpServer } from 'node:http';

import { Config } from '@cravix/shared-config';
import { logger } from '@cravix/shared-logger';
import { redis, RedisKeys } from '@cravix/shared-redis';
import { buildRedisAdapter } from '@cravix/shared-queue';
import { Server } from 'socket.io';

import { authHandshake } from './middleware/auth.js';
import { bindLocationHandler } from './events/location.js';
import { bindOrderHandlers } from './events/order.js';
import { bindRiderHandlers } from './events/rider.js';
import { riderRoom } from './rooms.js';
import { startEmergencySubscriber } from './subscribers/emergency.js';
import { startNotificationsSubscriber } from './subscribers/notifications.js';
import { startOrderEventsSubscriber } from './subscribers/orderEvents.js';
import { startRiderStatusSubscriber } from './subscribers/riderStatus.js';
import type { ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData } from './types.js';

export interface SocketServerHandle {
  io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
  httpServer: HttpServer;
}

export async function startSocketServer(): Promise<SocketServerHandle> {
  const httpServer = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: { socket: 'cravix-socket-gateway' } }));
  });

  const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(
    httpServer,
    {
      transports: ['websocket'],
      adapter: buildRedisAdapter(),
      cors: {
        origin: Config.ALLOWED_ORIGINS.length > 0 ? Config.ALLOWED_ORIGINS : false,
        credentials: false,
      },
      pingInterval: 25_000,
      pingTimeout: 20_000,
      maxHttpBufferSize: 4 * 1024, // location pings are tiny; cap to limit DoS surface
    },
  );

  // ── JWT handshake (mandatory for every connection) ──────────
  io.use(authHandshake);

  io.on('connection', (socket) => {
    const { riderId } = socket.data;

    // Personal room — API gateway emits direct messages here for `order:new-request`,
    // `notification:push`, `earnings:updated`, etc.
    void socket.join(riderRoom(riderId));

    // Track the live socket id so other instances can locate the rider.
    void redis.set(RedisKeys.socketRider(riderId), socket.id, 'EX', 3600);

    logger.info('socket: connected', { riderId, socketId: socket.id, instance: Config.INSTANCE_ID });

    // ── Bind per-event handlers ───────────────────────────────
    socket.on('join', (_payload, ack) => {
      // Spec §6 legacy event — the join already happened above.  Ack so the
      // client can confirm the handshake reached the server.
      ack?.(true);
    });

    bindLocationHandler(socket);
    bindRiderHandlers(socket);
    bindOrderHandlers(socket);

    socket.on('disconnect', (reason) => {
      void redis.del(RedisKeys.socketRider(riderId));
      logger.info('socket: disconnected', { riderId, reason });
    });
  });

  // ── Cross-instance pub/sub subscribers ──────────────────────
  startRiderStatusSubscriber(io);
  startOrderEventsSubscriber(io);
  startNotificationsSubscriber(io);
  startEmergencySubscriber(io);

  return new Promise((resolve) => {
    httpServer.listen(Config.SOCKET_PORT, Config.HOST, () => {
      logger.info(`socket-gateway listening on ${Config.HOST}:${Config.SOCKET_PORT}`, {
        instance: Config.INSTANCE_ID,
      });
      resolve({ io, httpServer });
    });
  });
}
