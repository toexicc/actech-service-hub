import { useEffect, useState } from "react";

interface FilterState {
  [key: string]: any;
}

export const useFilterPersistence = <T extends FilterState>(
  storageKey: string,
  initialState: T
): [T, (filters: Partial<T>) => void, () => void] => {
  const [filters, setFiltersState] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? { ...initialState, ...JSON.parse(saved) } : initialState;
    } catch {
      return initialState;
    }
  });

  const setFilters = (newFilters: Partial<T>) => {
    setFiltersState(prev => {
      const updated = { ...prev, ...newFilters };
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch (error) {
        console.error("Failed to save filters to localStorage:", error);
      }
      return updated;
    });
  };

  const clearFilters = () => {
    setFiltersState(initialState);
    try {
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.error("Failed to clear filters from localStorage:", error);
    }
  };

  return [filters, setFilters, clearFilters];
};
