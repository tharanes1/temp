/**
 * Cravix realtime client.
 *
 * Locked decisions reflected here:
 *   A2 — handshake presents the access token (3 min) in `auth.token`.  When
 *        the axios interceptor refreshes the access, `refreshAuthToken()`
 *        is called and the socket reconnects with the new token.
 *
 * Connection lifecycle:
 *   • `connect(token)` is called from `useAuthStore.setAuth` (login/refresh).
 *   • `disconnect()` is called from `useAuthStore.logout()` and on unmount of
 *     the root provider.
 *   • Reconnect parameters match spec §6: 10 attempts, exp backoff up to 30s.
 *
 * Streaming:
 *   • `emitLocationUpdate(payload)` is fire-and-forget; the server enqueues
 *     to BullMQ and acks asynchronously.
 *
 * Subscription helpers:
 *   • `on/off/once` re-attach listeners across reconnects so callers don't
 *     have to re-subscribe themselves.
 */
import { io, type Socket } from 'socket.io-client';

import { ENV } from '@/core/config/env';

// ─── Typed events (mirror of backend `types.ts`) ────────────────

export interface LocationPayload {
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  accuracy?: number;
  capturedAt?: number;
}

export interface OrderRequestPayload {
  orderId: string;
  expiresIn: number;
  baseEarnings: number;
  longDistanceBonus: number;
  distance: number;
  estimatedTime: string;
  hubName: string;
  hubAddress: string;
  hubCoords: { latitude: number; longitude: number };
  deliveryAddress: string;
  destCoords: { latitude: number; longitude: number };
  items: { name: string; qty: number; icon: string }[];
  specialInstructions: string;
  merchantRating: number;
}

export interface ServerEvents {
  'order:new-request': OrderRequestPayload;
  'order:cancelled': { orderId: string; reason: string };
  'order:status-updated': { orderId: string; status: string; at: number };
  'notification:push': { title: string; body: string; type: string; metadata?: Record<string, unknown> };
  'location:zone-update': { zoneId: string; demandLevel: 'low' | 'medium' | 'high' | 'very_high' };
  'earnings:updated': { delta: number; newBalance: number };
  'emergency:alert': { type: string; message: string };
  'shift:reminder': { shiftName: string; startsIn: number };
}

export type ServerEventName = keyof ServerEvents;
export type ServerEventHandler<E extends ServerEventName> = (payload: ServerEvents[E]) => void;

type StoredHandlers = {
  [K in ServerEventName]?: Set<ServerEventHandler<K>>;
};

// ─── Implementation ─────────────────────────────────────────────

class SocketClient {
  private socket: Socket | null = null;
  private currentToken: string | null = null;
  private handlers: StoredHandlers = {};

  /** True when the socket is connected with a live access token. */
  get connected(): boolean {
    return this.socket?.connected ?? false;
  }

  /**
   * Open (or replace) the connection with the given access token.  Idempotent
   * when the token hasn't changed.
   */
  connect(accessToken: string): void {
    if (this.socket?.connected && this.currentToken === accessToken) return;
    if (this.socket) this.socket.removeAllListeners();
    if (this.socket?.connected) this.socket.disconnect();

    this.currentToken = accessToken;
    this.socket = io(ENV.SOCKET_URL, {
      transports: ['websocket'],
      auth: { token: accessToken },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2_000,
      reconnectionDelayMax: 30_000,
      timeout: 10_000,
      autoConnect: true,
    });

    this.attachInternalListeners();
    this.reattachUserHandlers();
  }

  /** Replace the access token used for future reconnects (called by axios refresh). */
  refreshAuthToken(accessToken: string): void {
    this.currentToken = accessToken;
    if (!this.socket) return;
    // socket.io-client reads `auth` afresh on every reconnect attempt.
    this.socket.auth = { token: accessToken };
    // Force a clean reconnect so the server re-validates the new token.
    this.socket.disconnect();
    this.socket.connect();
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.currentToken = null;
  }

  // ── Emits ───────────────────────────────────────────────────

  emitLocationUpdate(payload: LocationPayload): void {
    if (!this.socket?.connected) return;
    this.socket.volatile.emit('locationUpdate', payload);
  }

  emitGoingOnline(riderId: string): void {
    this.socket?.emit('rider:going-online', { riderId });
  }

  emitGoingOffline(riderId: string): void {
    this.socket?.emit('rider:going-offline', { riderId });
  }

  emitOrderArrivedAtHub(orderId: string): void {
    this.socket?.emit('order:arrived-at-hub', { orderId });
  }

  emitOrderDeliveryConfirmed(orderId: string, proofUrl?: string): void {
    this.socket?.emit('order:delivery-confirmed', { orderId, proofUrl });
  }

  // ── Subscription helpers ────────────────────────────────────

  on<E extends ServerEventName>(event: E, handler: ServerEventHandler<E>): () => void {
    let bag = this.handlers[event] as Set<ServerEventHandler<E>> | undefined;
    if (!bag) {
      bag = new Set<ServerEventHandler<E>>();
      this.handlers[event] = bag as StoredHandlers[E];
    }
    bag.add(handler);
    if (this.socket) this.socket.on(event, handler as never);
    return () => this.off(event, handler);
  }

  off<E extends ServerEventName>(event: E, handler: ServerEventHandler<E>): void {
    const bag = this.handlers[event] as Set<ServerEventHandler<E>> | undefined;
    bag?.delete(handler);
    this.socket?.off(event, handler as never);
  }

  once<E extends ServerEventName>(event: E, handler: ServerEventHandler<E>): void {
    this.socket?.once(event, handler as never);
  }

  // ── Internals ───────────────────────────────────────────────

  private attachInternalListeners(): void {
    if (!this.socket) return;
    this.socket.on('connect', () => {
      if (__DEV__) console.warn('[socket] connected');
    });
    this.socket.on('disconnect', (reason) => {
      if (__DEV__) console.warn('[socket] disconnected:', reason);
    });
    this.socket.on('connect_error', (err) => {
      if (__DEV__) console.warn('[socket] connect_error:', err.message);
    });
  }

  private reattachUserHandlers(): void {
    if (!this.socket) return;
    (Object.keys(this.handlers) as ServerEventName[]).forEach((event) => {
      const bag = this.handlers[event];
      if (!bag) return;
      bag.forEach((handler) => {
        this.socket?.on(event, handler as never);
      });
    });
  }
}

const socketClient = new SocketClient();
export default socketClient;
