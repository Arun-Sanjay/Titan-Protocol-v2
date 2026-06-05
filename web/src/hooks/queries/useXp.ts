import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentUserId } from "../../lib/session";
import {
  getXpLogForDate,
  awardXpForCompletion,
  type AwardResult,
} from "../../services/xp";
import { profileKeys } from "./useProfile";

export const xpKeys = {
  day: (dateKey: string) => ["xp_log", dateKey] as const,
};

/** Today's (or a given day's) XP ledger row — drives "X / 10 tasks counted",
 *  XP earned today, etc. */
export function useXpLog(dateKey: string) {
  const userId = useCurrentUserId();
  return useQuery({
    queryKey: xpKeys.day(dateKey),
    queryFn: () => getXpLogForDate(dateKey),
    enabled: Boolean(userId),
  });
}

/** Standalone award mutation (the task-completion path calls the service
 *  directly inside useToggleCompletion; this is for any future callers). */
export function useAwardXpForCompletion() {
  const qc = useQueryClient();
  return useMutation<AwardResult, Error, { dateKey: string; taskId: string }>({
    mutationFn: ({ dateKey, taskId }) => awardXpForCompletion(dateKey, taskId),
    onSettled: (_res, _err, { dateKey }) => {
      qc.invalidateQueries({ queryKey: profileKeys.all });
      qc.invalidateQueries({ queryKey: xpKeys.day(dateKey) });
    },
  });
}
