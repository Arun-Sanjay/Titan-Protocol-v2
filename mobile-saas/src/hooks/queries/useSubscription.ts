import { useQuery, type QueryClient } from "@tanstack/react-query";

import { useAuthStore } from "../../stores/useAuthStore";
import {
  getSubscription,
  deriveEntitlement,
  type Entitlement,
  type Subscription,
} from "../../services/subscription";
import { useProfile, profileQueryKey, type Profile } from "./useProfile";

export const subscriptionKeys = {
  all: ["subscriptions"] as const,
};

export type { Subscription, Entitlement };

export function useSubscription() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: subscriptionKeys.all,
    queryFn: getSubscription,
    enabled: Boolean(userId),
  });
}

/**
 * The user's current entitlement, combining their subscription row and the
 * profile's 1-day trial marker. Defaults to free while loading / when
 * neither grants access — callers gate Pro features on `isPro` with no
 * loading dance.
 */
export function useEntitlement(): Entitlement {
  const { data: sub } = useSubscription();
  const { data: profile } = useProfile();
  return deriveEntitlement(sub ?? null, profile?.trial_started_at ?? null);
}

/**
 * Synchronous entitlement read from the React Query cache — for non-hook
 * call sites (e.g. the completion-toggle gate) that can't call hooks.
 */
export function entitlementFromCache(qc: QueryClient): Entitlement {
  const sub = qc.getQueryData<Subscription>(subscriptionKeys.all) ?? null;
  const profile = qc.getQueryData<Profile>(profileQueryKey) ?? null;
  return deriveEntitlement(sub, profile?.trial_started_at ?? null);
}
