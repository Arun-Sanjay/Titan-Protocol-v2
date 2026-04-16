// Database layer now uses MMKV (react-native-mmkv)
// Re-export everything from the new storage module
export { storage, getJSON, setJSON, nextId } from "./storage";
