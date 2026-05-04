/** Centralized Socket.IO room name builders. */
export const riderRoom = (riderId: string) => `rider:${riderId}`;
export const adminRoom = (channel: string) => `admin:${channel}`;
