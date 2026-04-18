/**
 * Tests the engine's syncNow coordination. Push and pull modules are
 * auto-mocked so we can assert call order + error short-circuiting
 * without re-testing their internals (covered elsewhere).
 */

jest.mock("../../sync/push", () => ({
  pushAll: jest.fn(),
  pushBatch: jest.fn(),
}));
jest.mock("../../sync/pull", () => ({
  pullAll: jest.fn(),
  pullTable: jest.fn(),
  readCursor: jest.fn(),
}));
jest.mock("../../sync/outbox", () => ({
  countPending: jest.fn(),
}));
jest.mock("../../lib/query-client", () => ({
  queryClient: { invalidateQueries: jest.fn() },
}));
jest.mock("../../lib/error-log", () => ({ logError: jest.fn() }));
jest.mock("react-native", () => ({
  AppState: { addEventListener: jest.fn(() => ({ remove: jest.fn() })) },
}));
jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: { addEventListener: jest.fn(() => () => {}) },
}));

import { pushAll } from "../../sync/push";
import { pullAll } from "../../sync/pull";
import { countPending } from "../../sync/outbox";
import { queryClient } from "../../lib/query-client";
import { syncNow } from "../../sync/engine";
import { useSyncStore } from "../../sync/store";

const mockPushAll = pushAll as jest.MockedFunction<typeof pushAll>;
const mockPullAll = pullAll as jest.MockedFunction<typeof pullAll>;
const mockCountPending = countPending as jest.MockedFunction<typeof countPending>;
const mockInvalidate = queryClient.invalidateQueries as jest.MockedFunction<
  typeof queryClient.invalidateQueries
>;

describe("syncNow", () => {
  beforeEach(() => {
    mockPushAll.mockReset();
    mockPullAll.mockReset();
    mockCountPending.mockReset();
    mockInvalidate.mockReset();
    useSyncStore.setState({
      status: "idle",
      lastSyncAt: null,
      lastError: null,
      pendingCount: 0,
    });

    mockPushAll.mockResolvedValue({ pushed: 0, failed: 0, stopReason: "empty" });
    mockPullAll.mockResolvedValue({
      perTable: [],
      totalPulled: 0,
      totalSkipped: 0,
      stopReason: "complete",
    });
    mockCountPending.mockResolvedValue(0);
  });

  test("runs push then pull and marks success", async () => {
    await syncNow({ fullRefresh: true });
    expect(mockPushAll).toHaveBeenCalledTimes(1);
    expect(mockPullAll).toHaveBeenCalledTimes(1);
    const state = useSyncStore.getState();
    expect(state.status).toBe("idle");
    expect(state.lastSyncAt).not.toBeNull();
  });

  test("pushOnly skips the pull phase", async () => {
    await syncNow({ pushOnly: true, fullRefresh: true });
    expect(mockPushAll).toHaveBeenCalledTimes(1);
    expect(mockPullAll).not.toHaveBeenCalled();
  });

  test("pullOnly skips the push phase", async () => {
    await syncNow({ pullOnly: true, fullRefresh: true });
    expect(mockPushAll).not.toHaveBeenCalled();
    expect(mockPullAll).toHaveBeenCalledTimes(1);
  });

  test("auth failure during push short-circuits (no pull)", async () => {
    mockPushAll.mockResolvedValue({
      pushed: 0,
      failed: 1,
      stopReason: "auth",
    });
    await syncNow({ fullRefresh: true });
    expect(mockPullAll).not.toHaveBeenCalled();
    expect(useSyncStore.getState().status).toBe("error");
    expect(useSyncStore.getState().lastError).toBe("auth");
  });

  test("invalidates query keys for every table that pulled rows", async () => {
    mockPullAll.mockResolvedValue({
      perTable: [
        { table: "tasks", pulled: 3, skippedDirty: 0, stopReason: "complete" },
        { table: "habits", pulled: 0, skippedDirty: 0, stopReason: "complete" },
        { table: "budgets", pulled: 5, skippedDirty: 0, stopReason: "complete" },
      ],
      totalPulled: 8,
      totalSkipped: 0,
      stopReason: "complete",
    });

    await syncNow({ fullRefresh: true });

    expect(mockInvalidate).toHaveBeenCalledTimes(2);
    const calls = mockInvalidate.mock.calls;
    expect((calls[0][0] as { queryKey: string[] }).queryKey).toEqual(["tasks"]);
    expect((calls[1][0] as { queryKey: string[] }).queryKey).toEqual(["budgets"]);
  });

  test("coalesces concurrent calls (only one cycle actually runs)", async () => {
    let resolvePush: () => void;
    mockPushAll.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePush = () =>
            resolve({ pushed: 0, failed: 0, stopReason: "empty" });
        }),
    );

    const p1 = syncNow({ fullRefresh: true });
    const p2 = syncNow({ fullRefresh: true });
    expect(mockPushAll).toHaveBeenCalledTimes(1);

    resolvePush!();
    await Promise.all([p1, p2]);
    expect(mockPushAll).toHaveBeenCalledTimes(1);
  });

  test("updates pendingCount after cycle completes", async () => {
    mockCountPending.mockResolvedValue(4);
    await syncNow({ fullRefresh: true });
    expect(useSyncStore.getState().pendingCount).toBe(4);
  });

  test("thrown exceptions caught and surfaced via store", async () => {
    mockPullAll.mockRejectedValue(new Error("kablam"));
    await syncNow({ fullRefresh: true });
    expect(useSyncStore.getState().status).toBe("error");
    expect(useSyncStore.getState().lastError).toBe("kablam");
  });
});
