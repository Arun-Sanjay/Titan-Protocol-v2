/**
 * Local notification scheduling via expo-notifications
 *
 * All notifications are local — no push server required.
 * Handles protocol reminders, streak warnings, quest deadlines,
 * boss reminders, and phase transitions.
 */

import * as Notifications from "expo-notifications";
import { useIdentityStore, selectIdentityMeta } from "../stores/useIdentityStore";
import { useProtocolStore } from "../stores/useProtocolStore";
import { useQuestStore, selectActiveQuests } from "../stores/useQuestStore";
import { getTodayKey } from "./date";

// ─── Notification IDs (for canceling specific ones) ─────────────────────────

const NOTIF_IDS = {
  DAILY_PROTOCOL: "daily_protocol",
  STREAK_WARNING: "streak_warning",
  QUEST_DEADLINE: "quest_deadline",
  BOSS_REMINDER: "boss_reminder",
  PHASE_TRANSITION: "phase_transition",
} as const;

// ─── Permissions ────────────────────────────────────────────────────────────

export async function requestPermissions(): Promise<boolean> {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === "granted") return true;

    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}

// ─── Protocol Reminder ──────────────────────────────────────────────────────

/**
 * Schedule daily protocol reminder at the user's preferred time.
 */
export async function scheduleDailyReminder(hour: number, minute: number): Promise<void> {
  try {
    const granted = await requestPermissions();
    if (!granted) return;

    // Cancel existing protocol reminder
    await cancelNotificationById(NOTIF_IDS.DAILY_PROTOCOL);

    const archetype = useIdentityStore.getState().archetype;
    const meta = selectIdentityMeta(archetype);
    const identityText = meta ? `Show up as ${meta.name}.` : "Your daily session awaits.";

    await Notifications.scheduleNotificationAsync({
      identifier: NOTIF_IDS.DAILY_PROTOCOL,
      content: {
        title: "Protocol Ready",
        body: identityText,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
  } catch {
    // Notifications may not be available in dev/simulator
  }
}

// ─── Streak Warning ─────────────────────────────────────────────────────────

/**
 * Schedule streak-at-risk warning at 9pm if protocol not completed today.
 * Call on app open — only schedules if protocol not done.
 */
export async function scheduleStreakWarning(): Promise<void> {
  try {
    const granted = await requestPermissions();
    if (!granted) return;

    // Cancel existing
    await cancelNotificationById(NOTIF_IDS.STREAK_WARNING);

    // Only schedule if protocol not done today
    const todayCompleted = useProtocolStore.getState().todayCompleted;
    if (todayCompleted) return;

    const streak = useProtocolStore.getState().streakCurrent;
    if (streak === 0) return; // No streak to protect

    await Notifications.scheduleNotificationAsync({
      identifier: NOTIF_IDS.STREAK_WARNING,
      content: {
        title: "Streak at Risk",
        body: `${streak}-day streak expires at midnight. Complete your protocol now.`,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 21,
        minute: 0,
      },
    });
  } catch {
    // Silently fail
  }
}

// ─── Quest Deadline ─────────────────────────────────────────────────────────

/**
 * Schedule quest deadline reminder for Sunday 6pm.
 */
export async function scheduleQuestDeadline(): Promise<void> {
  try {
    const granted = await requestPermissions();
    if (!granted) return;

    await cancelNotificationById(NOTIF_IDS.QUEST_DEADLINE);

    const quests = useQuestStore.getState().weeklyQuests;
    const active = selectActiveQuests(quests);
    const completed = quests.filter((q) => q.status === "completed").length;

    if (active.length === 0) return; // All done or none

    await Notifications.scheduleNotificationAsync({
      identifier: NOTIF_IDS.QUEST_DEADLINE,
      content: {
        title: "Quest Deadline",
        body: `${completed}/${quests.length} quests completed. Deadline: midnight Sunday.`,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: 1, // Sunday
        hour: 18,
        minute: 0,
      },
    });
  } catch {
    // Silently fail
  }
}

// ─── Boss Reminder ──────────────────────────────────────────────────────────

/**
 * Schedule daily boss challenge reminder if a boss is active.
 */
export async function scheduleBossReminder(): Promise<void> {
  try {
    const granted = await requestPermissions();
    if (!granted) return;

    await cancelNotificationById(NOTIF_IDS.BOSS_REMINDER);

    const boss = useQuestStore.getState().bossChallenge;
    if (!boss || !boss.active) return;

    await Notifications.scheduleNotificationAsync({
      identifier: NOTIF_IDS.BOSS_REMINDER,
      content: {
        title: `${boss.title}: Day ${boss.currentDay + 1}/${boss.daysRequired}`,
        body: "Don't break the chain. Complete your protocol today.",
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 8,
        minute: 0,
      },
    });
  } catch {
    // Silently fail
  }
}

// ─── Phase Transition ───────────────────────────────────────────────────────

/**
 * Schedule notification for the last day of a phase.
 */
export async function schedulePhaseTransitionReminder(): Promise<void> {
  try {
    const granted = await requestPermissions();
    if (!granted) return;

    await cancelNotificationById(NOTIF_IDS.PHASE_TRANSITION);

    // Phase transitions happen at week boundaries — this is a placeholder
    // In practice, the transition is detected in protocol-completion.ts
    // This notification can be scheduled when currentWeek is the last week of a phase
  } catch {
    // Silently fail
  }
}

// ─── Cancel ─────────────────────────────────────────────────────────────────

/**
 * Cancel all scheduled notifications.
 */
export async function cancelAllNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // Silently fail
  }
}

/**
 * Cancel a specific notification by identifier.
 */
async function cancelNotificationById(id: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // May not exist — that's fine
  }
}

/**
 * Cancel streak warning (call when protocol is completed today).
 */
export async function cancelStreakWarning(): Promise<void> {
  await cancelNotificationById(NOTIF_IDS.STREAK_WARNING);
}

/**
 * Cancel boss reminder (call when boss completes or fails).
 */
export async function cancelBossReminder(): Promise<void> {
  await cancelNotificationById(NOTIF_IDS.BOSS_REMINDER);
}

// ─── Update content (for identity changes) ──────────────────────────────────

/**
 * Re-schedule daily reminder with updated identity text.
 * Call when identity changes.
 */
export async function updateNotificationContent(hour: number, minute: number): Promise<void> {
  await scheduleDailyReminder(hour, minute);
}

// ─── Notification handler ───────────────────────────────────────────────────

/**
 * Set up notification received handler.
 * Call once on app startup.
 */
export function setupNotificationHandler(navigate: (route: string) => void): Notifications.Subscription {
  // When user taps a notification
  return Notifications.addNotificationResponseReceivedListener((response) => {
    const id = response.notification.request.identifier;

    switch (id) {
      case NOTIF_IDS.DAILY_PROTOCOL:
      case NOTIF_IDS.STREAK_WARNING:
        navigate("/(tabs)");
        break;
      case NOTIF_IDS.QUEST_DEADLINE:
      case NOTIF_IDS.BOSS_REMINDER:
        navigate("/quests");
        break;
      default:
        navigate("/(tabs)");
    }
  });
}

// ─── Schedule all relevant notifications ────────────────────────────────────

/**
 * Refresh all notification schedules based on current state.
 * Call on app open and after protocol completion.
 */
export async function refreshNotifications(protocolHour: number, protocolMinute: number): Promise<void> {
  await scheduleDailyReminder(protocolHour, protocolMinute);
  await scheduleStreakWarning();
  await scheduleQuestDeadline();
  await scheduleBossReminder();
}
