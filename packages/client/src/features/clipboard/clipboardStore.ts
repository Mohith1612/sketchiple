import { create } from 'zustand'
import type { Shape } from '@canvas-draw/shared'

interface ClipboardStore {
  clipboard: Shape[]
  setClipboard: (shapes: Shape[]) => void
}

export const useClipboardStore = create<ClipboardStore>((set) => ({
  clipboard: [],
  setClipboard: (clipboard) => set({ clipboard }),
}))
