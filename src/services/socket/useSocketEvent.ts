/**
 * Subscribe a screen-level handler to a server-emitted socket event.
 *
 *   useSocketEvent('order:new-request', (payload) => { ... });
 *
 * The handler is auto-attached on mount (or socket-connect) and detached on
 * unmount.  Reconnects re-attach automatically because socketClient stores
 * the active handler set internally.
 */
import { useEffect, useRef } from 'react';

import socketClient, { type ServerEventName, type ServerEventHandler } from './socketClient';

export function useSocketEvent<E extends ServerEventName>(
  event: E,
  handler: ServerEventHandler<E>,
): void {
  // Always invoke the latest handler closure without re-subscribing on every render.
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const stable: ServerEventHandler<E> = ((payload) => handlerRef.current(payload)) as ServerEventHandler<E>;
    const unsub = socketClient.on(event, stable);
    return () => {
      unsub();
    };
  }, [event]);
}
