import { StateStorage } from "zustand/middleware";
import { storage } from "../db/storage";

export const mmkvStorage: StateStorage = {
  getItem: (key: string) => storage.getString(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.remove(key),
};
