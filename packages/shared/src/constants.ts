export const MSG_SYNC = 0
export const MSG_AWARENESS = 1

export type WsMessage =
  | { type: typeof MSG_SYNC; payload: Uint8Array }
  | { type: typeof MSG_AWARENESS; payload: Uint8Array }
