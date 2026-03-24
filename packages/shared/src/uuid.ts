import { uuidv7 } from 'uuidv7'

/** Single source of truth for all ID generation (shape, user, room). */
export const newId = (): string => uuidv7()
