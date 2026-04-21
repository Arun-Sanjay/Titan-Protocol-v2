import { useEffect } from "react";
import { useProfile } from "../hooks/queries/useProfile";
import { useIdentityStore, type Archetype } from "../stores/useIdentityStore";
import { useModeStore, type IdentityArchetype } from "../stores/useModeStore";

/**
 * Mirrors server profile values into the MMKV-backed stores that
 * components still read from. On a fresh install the stores default
 * to "titan"; without this, an existing account signing in on a new
 * device would see the default archetype until they re-ran
 * onboarding. Must be mounted inside QueryClientProvider.
 */
export function ProfileHydrator(): null {
  const { data: profile } = useProfile();
  const localArchetype = useIdentityStore((s) => s.archetype);

  useEffect(() => {
    const cloudArchetype = profile?.archetype;
    if (!cloudArchetype || cloudArchetype === localArchetype) return;
    useIdentityStore.setState({ archetype: cloudArchetype as Archetype });
    useModeStore.getState().setIdentity(cloudArchetype as IdentityArchetype);
  }, [profile?.archetype, localArchetype]);

  return null;
}
