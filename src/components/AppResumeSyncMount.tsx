import { useAppResumeSync } from "../hooks/useAppResumeSync";

/**
 * Phase 3.4c: Trivial mount-point component for the app-resume sync
 * hook. The hook needs to be called inside the QueryClientProvider,
 * and the root layout's QueryClientProvider is scoped to each render
 * branch. Rather than duplicate the hook call or restructure the
 * layout, we mount this zero-render component once inside the
 * authenticated tree.
 */
export function AppResumeSyncMount(): null {
  useAppResumeSync();
  return null;
}
