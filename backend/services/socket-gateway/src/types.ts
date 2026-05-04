/**
 * Socket.IO typed events (spec §6).
 *
 * All payloads are wire-format DTOs. Money fields follow locked decision A6
 * — `number` rupees with up to 2 decimals.
 */

// ─── Client → Server ─────────────────────────────────────────────

export interface ClientToServerEvents {
  /** Legacy spec event — frontend calls this on connect. Idempotent. */
  join: (payload: { userId: string }, ack?: (ok: boolean) => void) => void;

  /** Real-time GPS ping. Enqueued to BullMQ — never written to Postgres directly. */
  locationUpdate: (
    payload: {
      latitude: number;
      longitude: number;
      heading?: number;
      speed?: number;
      accuracy?: number;
      capturedAt?: number; // unix ms; server-fills if missing
    },
    ack?: (ok: boolean) => void,
  ) => void;

  /** Mirror of PATCH /rider/status — kept for clients that prefer socket-only. */
  'rider:going-online': (payload: { riderId: string }) => void;
  'rider:going-offline': (payload: { riderId: string }) => void;

  /** Order lifecycle confirmations. */
  'order:arrived-at-hub': (payload: { orderId: string }) => void;
  'order:delivery-confirmed': (payload: { orderId: string; proofUrl?: string }) => void;
}

// ─── Server → Client ─────────────────────────────────────────────

export interface OrderRequestPayload {
  orderId: string;
  expiresIn: number; // 45
  baseEarnings: number; // rupees decimal — locked A6
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

export interface ServerToClientEvents {
  'order:new-request': (payload: OrderRequestPayload) => void;
  'order:cancelled': (payload: { orderId: string; reason: string }) => void;
  'order:status-updated': (payload: { orderId: string; status: string; at: number }) => void;
  'notification:push': (payload: { title: string; body: string; type: string; metadata?: Record<string, unknown> }) => void;
  'location:zone-update': (payload: { zoneId: string; demandLevel: 'low' | 'medium' | 'high' | 'very_high' }) => void;
  'earnings:updated': (payload: { delta: number; newBalance: number }) => void;
  'emergency:alert': (payload: { type: string; message: string }) => void;
  'shift:reminder': (payload: { shiftName: string; startsIn: number }) => void;
}

// ─── Inter-server (Redis adapter) ────────────────────────────────

export interface InterServerEvents {
  ping: () => void;
}

// ─── Per-socket data attached after JWT handshake ────────────────

export interface SocketData {
  riderId: string;
  phone: string;
  jti: string;
}
