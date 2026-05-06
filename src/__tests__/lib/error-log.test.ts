/**
 * Regression tests for the secret-redaction in src/lib/error-log.ts.
 *
 * The bug: the magic-link verify screen called
 *
 *   logError("verify.handleLink", e, { params })
 *
 * where `params` could carry access_token / refresh_token. logError
 * forwarded that context to console + Sentry, leaking session tokens
 * into telemetry. The fix sanitises the context recursively against
 * a list of known-sensitive key patterns.
 *
 * The verify.tsx call site was also updated to pass only safe
 * metadata, but defence-in-depth says the logger should still scrub.
 */

const mockCaptureException = jest.fn();
const mockCaptureMessage = jest.fn();
jest.mock("@sentry/react-native", () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
  captureMessage: (...args: unknown[]) => mockCaptureMessage(...args),
}));

import { logError, getErrorLog, clearErrorLog } from "../../lib/error-log";

describe("error-log sensitive-key redaction", () => {
  beforeEach(() => {
    clearErrorLog();
    mockCaptureException.mockClear();
    mockCaptureMessage.mockClear();
  });

  test("redacts access_token / refresh_token in context", () => {
    logError("verify.handleLink", new Error("boom"), {
      params: {
        token_hash: "tk_hash_redact",
        access_token: "secret-access",
        refresh_token: "secret-refresh",
        type: "magiclink",
      },
    });

    const entry = getErrorLog().at(-1);
    const ctx = entry?.context as
      | { params?: Record<string, unknown> }
      | undefined;
    expect(ctx?.params?.access_token).toBe("[redacted]");
    expect(ctx?.params?.refresh_token).toBe("[redacted]");
    expect(ctx?.params?.token_hash).toBe("[redacted]");
    expect(ctx?.params?.type).toBe("magiclink");
  });

  test("Sentry receives the redacted extras (not the raw secrets)", () => {
    logError("verify.handleLink", new Error("boom"), {
      access_token: "leaky",
    });
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    const extras = (mockCaptureException.mock.calls[0][1] as {
      extra?: Record<string, unknown>;
    }).extra;
    expect(extras?.access_token).toBe("[redacted]");
    expect(extras?.access_token).not.toBe("leaky");
  });

  test("non-sensitive keys pass through untouched", () => {
    logError("some.module", "string error", {
      userId: "u1",
      attempts: 3,
      flag: "magiclink",
    });
    const entry = getErrorLog().at(-1);
    expect(entry?.context).toEqual({
      userId: "u1",
      attempts: 3,
      flag: "magiclink",
    });
  });

  test("redacts password / api_key / authorization too", () => {
    logError("dummy", new Error("x"), {
      password: "pw",
      api_key: "k",
      authorization: "Bearer xyz",
      cookie: "session=abc",
    });
    const ctx = getErrorLog().at(-1)?.context as Record<string, unknown>;
    expect(ctx).toEqual({
      password: "[redacted]",
      api_key: "[redacted]",
      authorization: "[redacted]",
      cookie: "[redacted]",
    });
  });

  test("nested objects get redacted recursively", () => {
    logError("dummy", new Error("x"), {
      response: {
        headers: { authorization: "Bearer xyz" },
        body: { id: "u1" },
      },
    });
    const ctx = getErrorLog().at(-1)?.context as {
      response?: {
        headers?: { authorization?: string };
        body?: { id?: string };
      };
    };
    expect(ctx.response?.headers?.authorization).toBe("[redacted]");
    expect(ctx.response?.body?.id).toBe("u1");
  });
});
