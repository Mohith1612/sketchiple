export type UserId = string
export type RoomId = string

export interface UserPresence {
  userId: UserId
  color: string
  cursor: { x: number; y: number } | null
  name?: string
  /** World-space center of the user's viewport. Canvas-size-independent. */
  viewport?: { zoom: number; centerX: number; centerY: number }
}
