import { create } from 'zustand'
import type { UserPresence } from '@canvas-draw/shared'

export interface RemoteUser extends UserPresence {
  userId: string
}

interface PresenceStore {
  remoteUsers: Record<string, RemoteUser>
  localUserId: string
  localColor: string
  localName: string

  setLocalName: (name: string) => void
  _setRemoteUsers: (users: Record<string, RemoteUser>) => void
  _upsertRemoteUser: (user: RemoteUser) => void
  _removeRemoteUser: (userId: string) => void
  clearAll: () => void
}

function randomColor(): string {
  const colors = ['#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4']
  return colors[Math.floor(Math.random() * colors.length)] ?? '#6366f1'
}

import { newId } from '../lib/uuid.js'

const _localUserId = newId()

export const usePresenceStore = create<PresenceStore>((set) => ({
  remoteUsers: {},
  localUserId: _localUserId,
  localColor: randomColor(),
  localName: `User #${_localUserId.slice(-4).toUpperCase()}`,

  setLocalName: (name) => set({ localName: name }),
  _setRemoteUsers: (remoteUsers) => set({ remoteUsers }),
  _upsertRemoteUser: (user) =>
    set((s) => ({ remoteUsers: { ...s.remoteUsers, [user.userId]: user } })),
  _removeRemoteUser: (userId) =>
    set((s) => {
      const next = { ...s.remoteUsers }
      delete next[userId]
      return { remoteUsers: next }
    }),
  clearAll: () => set({ remoteUsers: {} }),
}))
