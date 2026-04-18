import { classifyError } from "../../sync/errors";

describe("classifyError", () => {
  test("401 → auth", () => {
    expect(classifyError({ status: 401 })).toBe("auth");
    expect(classifyError({ status: "401" })).toBe("auth");
    expect(classifyError({ status: 403 })).toBe("auth");
  });

  test("supabase AuthApiError → auth", () => {
    expect(classifyError({ name: "AuthApiError", status: 400 })).toBe("auth");
    expect(classifyError({ name: "AuthError", status: 500 })).toBe("auth");
  });

  test("jwt / unauthorized message → auth", () => {
    expect(classifyError({ message: "invalid JWT" })).toBe("auth");
    expect(classifyError({ message: "unauthorized" })).toBe("auth");
    expect(classifyError({ message: "User not authenticated" })).toBe("auth");
  });

  test("409 / 23505 → conflict", () => {
    expect(classifyError({ status: 409 })).toBe("conflict");
    expect(classifyError({ code: "23505" })).toBe("conflict");
  });

  test("429 → transient", () => {
    expect(classifyError({ status: 429 })).toBe("transient");
  });

  test("5xx → transient", () => {
    expect(classifyError({ status: 500 })).toBe("transient");
    expect(classifyError({ status: 502 })).toBe("transient");
    expect(classifyError({ status: 599 })).toBe("transient");
  });

  test("TypeError with network message → transient", () => {
    expect(
      classifyError({ name: "TypeError", message: "Network request failed" }),
    ).toBe("transient");
    expect(
      classifyError({ name: "TypeError", message: "Failed to fetch" }),
    ).toBe("transient");
  });

  test("4xx not auth/conflict → fatal", () => {
    expect(classifyError({ status: 400 })).toBe("fatal");
    expect(classifyError({ status: 422 })).toBe("fatal");
    expect(classifyError({ status: 404 })).toBe("fatal");
  });

  test("unknown / missing status → transient", () => {
    expect(classifyError(new Error("something"))).toBe("transient");
    expect(classifyError({})).toBe("transient");
    expect(classifyError(null)).toBe("transient");
  });
});
