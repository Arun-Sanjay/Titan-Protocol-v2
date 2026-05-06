/**
 * Tests for the sleep notes JSON envelope added so bedtime/wakeTime
 * actually round-trip through the cloud `notes` column. Before this
 * encoding, the schedule the user typed was thrown away by the
 * service and a later read fabricated a 7am wake time, breaking
 * timeline + consistency metrics.
 */

import {
  packSleepNotes,
  unpackSleepNotes,
} from "../../lib/sleep-helpers";

describe("packSleepNotes / unpackSleepNotes round-trip", () => {
  test("packs schedule + note into a JSON envelope", () => {
    const packed = packSleepNotes({
      bedtime: "23:30",
      wakeTime: "06:45",
      note: "slept well",
    });
    expect(typeof packed).toBe("string");
    const decoded = unpackSleepNotes(packed);
    expect(decoded).toEqual({
      bedtime: "23:30",
      wakeTime: "06:45",
      note: "slept well",
    });
  });

  test("plain text from a legacy row decodes as note-only", () => {
    const decoded = unpackSleepNotes("woke up tired");
    expect(decoded).toEqual({
      bedtime: null,
      wakeTime: null,
      note: "woke up tired",
    });
  });

  test("null/undefined notes give an empty payload", () => {
    expect(unpackSleepNotes(null)).toEqual({
      bedtime: null,
      wakeTime: null,
      note: "",
    });
    expect(unpackSleepNotes(undefined)).toEqual({
      bedtime: null,
      wakeTime: null,
      note: "",
    });
  });

  test("malformed JSON is treated as plain text (forward-compat)", () => {
    const decoded = unpackSleepNotes("{not really json");
    expect(decoded).toEqual({
      bedtime: null,
      wakeTime: null,
      note: "{not really json",
    });
  });

  test("packing without bedtime/wake stays as plain text (no envelope cost)", () => {
    expect(packSleepNotes({ note: "hello" })).toBe("hello");
    expect(packSleepNotes({ note: "" })).toBeNull();
    expect(packSleepNotes({})).toBeNull();
  });

  test("partial schedule still envelopes (bedtime only)", () => {
    const packed = packSleepNotes({ bedtime: "23:00", note: "x" });
    expect(packed).not.toBeNull();
    const decoded = unpackSleepNotes(packed);
    expect(decoded.bedtime).toBe("23:00");
    expect(decoded.wakeTime).toBeNull();
    expect(decoded.note).toBe("x");
  });

  test("envelope from a future version is treated as plain text", () => {
    const futureEnvelope = JSON.stringify({
      v: 99,
      bed: "23:00",
      wake: "07:00",
      note: "x",
    });
    const decoded = unpackSleepNotes(futureEnvelope);
    expect(decoded.bedtime).toBeNull();
    expect(decoded.wakeTime).toBeNull();
    expect(decoded.note).toBe(futureEnvelope);
  });
});
