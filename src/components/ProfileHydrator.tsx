import { useEffect } from "react";
import { useProfile } from "../hooks/queries/useProfile";
import { useIdentityStore, type Archetype } from "../stores/useIdentityStore";
import {
  useModeStore,
  type ExperienceMode,
  type IdentityArchetype,
} from "../stores/useModeStore";
import type { EngineKey } from "../db/schema";

/**
 * Mirrors server profile values into the MMKV-backed stores that
 * components still read from. On a fresh install the stores default
 * to "titan"; without this, an existing account signing in on a new
 * device would see the default archetype/mode until they re-ran
 * onboarding. Must be mounted inside QueryClientProvider.
 *
 * Now hydrates archetype, mode (both `experienceMode` AND the derived
 * `AppMode`) AND `focus_engines` — previously only archetype was
 * synced, so a user who picked Focus mode + body/mind on Device A
 * would land on Full Protocol with no focus engines on Device B until
 * they manually re-set everything in Settings.
 */
export function ProfileHydrator(): null {
  const { data: profile } = useProfile();
  const localArchetype = useIdentityStore((s) => s.archetype);
  const localExperienceMode = useModeStore((s) => s.experienceMode);
  const localFocusEngines = useModeStore((s) => s.focusEngines);

  useEffect(() => {
    const cloudArchetype = profile?.archetype;
    if (cloudArchetype && cloudArchetype !== localArchetype) {
      useIdentityStore.setState({ archetype: cloudArchetype as Archetype });
      useModeStore.getState().setIdentity(cloudArchetype as IdentityArchetype);
    }
  }, [profile?.archetype, localArchetype]);

  useEffect(() => {
    const cloudMode = profile?.mode as ExperienceMode | undefined;
    if (cloudMode && cloudMode !== localExperienceMode) {
      // setExperienceMode also derives + writes the AppMode so feature
      // gates (`checkFeatureVisible(mode, ...)`) flip in lockstep.
      useModeStore.getState().setExperienceMode(cloudMode);
    }
  }, [profile?.mode, localExperienceMode]);

  useEffect(() => {
    const cloudEngines = (profile?.focus_engines ?? []) as EngineKey[];
    if (!sameStringArray(cloudEngines, localFocusEngines)) {
      useModeStore.getState().setFocusEngines(cloudEngines);
    }
    // focus_engines is a JSON array; React Query returns the same
    // reference until the row changes, so we compare by content.
  }, [profile?.focus_engines, localFocusEngines]);

  return null;
}

function sameStringArray(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
