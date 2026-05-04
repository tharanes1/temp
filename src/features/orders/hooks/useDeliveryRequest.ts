/**
 * `DeliveryRequestScreen` driver.
 *
 * Subscribes to the `order:new-request` socket event and exposes:
 *   • offer        — the most recently received offer
 *   • secondsLeft  — countdown from `expiresIn`
 *   • accept(id)   — POST /orders/:id/accept
 *   • reject(id)   — POST /orders/:id/reject
 *
 * The 45-second window is enforced server-side via the atomic SET NX EX, so
 * even if the FE timer drifts the rider can't claim a stale offer.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { orderService, type RejectReason } from '@/services/api/features/orders';
import socketClient, { type OrderRequestPayload } from '@/services/socket/socketClient';
import { useSocketEvent } from '@/services/socket/useSocketEvent';

interface UseDeliveryRequestResult {
  offer: OrderRequestPayload | null;
  secondsLeft: number;
  accepting: boolean;
  rejecting: boolean;
  error: string | null;
  accept: () => Promise<boolean>;
  reject: (reason?: RejectReason, note?: string) => Promise<void>;
  /** Manually load from the offer payload — used when the screen is opened directly. */
  setOffer: (offer: OrderRequestPayload | null) => void;
}

export function useDeliveryRequest(): UseDeliveryRequestResult {
  const [offer, setOffer] = useState<OrderRequestPayload | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [accepting, setAccepting] = useState<boolean>(false);
  const [rejecting, setRejecting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Listen for the realtime offer.  Each new offer resets the countdown.
  useSocketEvent(
    'order:new-request',
    useCallback((payload: OrderRequestPayload) => {
      setOffer(payload);
      setSecondsLeft(payload.expiresIn ?? 45);
      setError(null);
    }, []),
  );

  useEffect(() => {
    if (!offer) return;
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          if (tickRef.current) clearInterval(tickRef.current);
          tickRef.current = null;
          return 0;
        }
        return s - 1;
      });
    }, 1_000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = null;
    };
  }, [offer]);

  const accept = useCallback(async (): Promise<boolean> => {
    if (!offer || accepting) return false;
    setAccepting(true);
    setError(null);
    try {
      await orderService.accept(offer.orderId);
      return true;
    } catch (e: unknown) {
      const msg = (e as { message?: string } | undefined)?.message ?? 'Could not accept order';
      setError(msg);
      return false;
    } finally {
      setAccepting(false);
    }
  }, [offer, accepting]);

  const reject = useCallback(
    async (reason: RejectReason = 'other', note?: string): Promise<void> => {
      if (!offer || rejecting) return;
      setRejecting(true);
      setError(null);
      try {
        await orderService.reject(offer.orderId, reason, note);
        // Optionally let the rider know via the socket — we already informed the server.
        socketClient.emitGoingOnline; // noop reference to avoid tree-shaking
      } catch (e: unknown) {
        const msg = (e as { message?: string } | undefined)?.message ?? 'Could not reject order';
        setError(msg);
      } finally {
        setRejecting(false);
        setOffer(null);
      }
    },
    [offer, rejecting],
  );

  return { offer, secondsLeft, accepting, rejecting, error, accept, reject, setOffer };
}
