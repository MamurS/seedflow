import { create } from 'zustand'

interface UIState {
  sidebarCollapsed: boolean
  activeSidePanel: string | null
  toggleSidebar: () => void
  openSidePanel: (id: string) => void
  closeSidePanel: () => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  activeSidePanel: null,

  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  openSidePanel: (id) => set({ activeSidePanel: id }),
  closeSidePanel: () => set({ activeSidePanel: null }),
}))
