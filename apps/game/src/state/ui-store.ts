import { create } from "zustand";

export type UiTheme = "SYSTEM" | "LIGHT" | "DARK";

export type UiStore = {
  sidebarCollapsed: boolean;
  activeTableView: string;
  theme: UiTheme;
  toggleSidebar: () => void;
  setActiveTableView: (view: string) => void;
  setTheme: (theme: UiTheme) => void;
};

export const useUiStore = create<UiStore>((set) => ({
  sidebarCollapsed: false,
  activeTableView: "default",
  theme: "SYSTEM",
  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setActiveTableView: (activeTableView) => set({ activeTableView }),
  setTheme: (theme) => set({ theme }),
}));
