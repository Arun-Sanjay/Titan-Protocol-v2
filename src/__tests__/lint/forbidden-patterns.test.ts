/**
 * Repo-wide guard tests. These exist because the project does not ship
 * ESLint — instead of adding a lint pipeline, the few rules we actually
 * care about are enforced by a Jest scan that walks `src/` + `app/` and
 * greps for known footguns. A violation fails `npm test`, which gates
 * the `prebuild` script and therefore EAS builds.
 *
 * If you hit one of these tests:
 *   1. Read the rule's rationale in the expect block.
 *   2. Fix the offending line. The helpers you want are in
 *      `src/lib/date.ts` (`getTodayKey` / `toLocalDateKey`) and
 *      `src/theme/shadows.ts` (`shadows.panel` / `.card` / `.ring`).
 */

import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..", "..", "..");
const SEARCH_ROOTS = [join(ROOT, "src"), join(ROOT, "app")];
const ALLOW_LIST_DATE = new Set<string>([
  // date.ts contains the documentation comment warning about the pattern.
  join(ROOT, "src", "lib", "date.ts"),
  // This file. The rule self-references the pattern in string form.
  __filename,
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (entry === "node_modules" || entry === ".expo" || entry === "__tests__") continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(p);
    }
  }
  return out;
}

const allFiles = SEARCH_ROOTS.flatMap((d) => walk(d));

describe("forbidden patterns", () => {
  it("no .toISOString().slice(0, 10) — use getTodayKey()/toLocalDateKey() from src/lib/date.ts", () => {
    const pattern = /\.toISOString\(\)\.slice\(\s*0\s*,\s*10\s*\)/;
    const offenders: string[] = [];
    for (const file of allFiles) {
      if (ALLOW_LIST_DATE.has(file)) continue;
      const src = readFileSync(file, "utf8");
      src.split("\n").forEach((line, i) => {
        // Skip pure-comment lines so documentation warnings don't trip the guard.
        const trimmed = line.trim();
        if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;
        if (pattern.test(line)) {
          offenders.push(`${file}:${i + 1}  ${trimmed}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  it("no raw `elevation:` in TS/TSX — use src/theme/shadows.ts helpers or Platform-guard iOS-only shadows", () => {
    // The only allowed source of `elevation:` is theme/shadows.ts itself.
    const ALLOW = new Set<string>([join(ROOT, "src", "theme", "shadows.ts")]);
    const pattern = /^\s*elevation\s*:/;
    const offenders: string[] = [];
    for (const file of allFiles) {
      if (ALLOW.has(file)) continue;
      const src = readFileSync(file, "utf8");
      src.split("\n").forEach((line, i) => {
        if (pattern.test(line)) {
          offenders.push(`${file}:${i + 1}  ${line.trim()}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });
});
