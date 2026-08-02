import { createContext, useContext } from "react";

interface TabActiveState {
  isActive: boolean;
}

export const TabActiveContext = createContext<TabActiveState>({ isActive: true });

/** Returns whether the page's workbench tab is currently visible. */
export function useIsTabActive(): boolean {
  return useContext(TabActiveContext).isActive;
}