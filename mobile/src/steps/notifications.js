import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Linking, Platform } from "react-native";

import { buildStepNotificationCopy, formatNotificationPermissionLabel } from "./coach";
import { createStepError, stepInfo, stepWarn } from "./debug";

const STEP_NOTIFICATION_IDS_KEY = "fitness-notebook-mobile-step-notification-ids";
const SMART_NOTIFICATION_IDS_KEY = "fitness-notebook-mobile-smart-notification-ids";
const WALK_SESSION_NOTIFICATION_IDS_KEY = "fitness-notebook-mobile-walk-session-notification-ids";
const STEP_NOTIFICATION_CHANNEL = "step-coach";

let notificationHandlerConfigured = false;

function resolveExpoProjectId() {
  return (
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
    Constants?.easConfig?.projectId ||
    Constants?.expoConfig?.extra?.eas?.projectId ||
    Constants?.expoConfig?.extra?.easProjectId ||
    null
  );
}

function normalizePermissionStatus(permission) {
  if (permission?.granted) {
    return {
      status: "granted",
      label: formatNotificationPermissionLabel("granted"),
      canAskAgain: Boolean(permission?.canAskAgain),
    };
  }

  if (permission?.status === "denied") {
    return {
      status: "denied",
      label: formatNotificationPermissionLabel("denied"),
      canAskAgain: Boolean(permission?.canAskAgain),
    };
  }

  return {
    status: "pending",
    label: formatNotificationPermissionLabel("pending"),
    canAskAgain: true,
  };
}

async function readScheduledIds(storageKey) {
  const rawValue = await AsyncStorage.getItem(storageKey);
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeScheduledIds(storageKey, ids) {
  await AsyncStorage.setItem(storageKey, JSON.stringify(ids));
}

export function configureStepNotifications() {
  if (notificationHandlerConfigured) {
    return;
  }

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  notificationHandlerConfigured = true;
}

export async function getStepNotificationPermissionState() {
  if (Platform.OS === "web") {
    return {
      status: "unavailable",
      label: formatNotificationPermissionLabel("unavailable"),
      canAskAgain: false,
    };
  }

  const permission = await Notifications.getPermissionsAsync();
  const normalized = normalizePermissionStatus(permission);
  stepInfo("step_notification_permission_state", {
    provider: "expo_notifications",
    permissionStatus: normalized.status,
  });
  return normalized;
}

export async function requestStepNotificationPermission() {
  if (Platform.OS === "web") {
    return {
      status: "unavailable",
      label: formatNotificationPermissionLabel("unavailable"),
      canAskAgain: false,
    };
  }

  const permission = await Notifications.requestPermissionsAsync();
  const normalized = normalizePermissionStatus(permission);
  stepInfo("step_notification_permission_request", {
    provider: "expo_notifications",
    permissionStatus: normalized.status,
  });
  return normalized;
}

export async function openStepNotificationSettings() {
  await Linking.openSettings();
}

export async function getExpoPushTokenAsyncSafe() {
  if (Platform.OS === "web") {
    return null;
  }

  const projectId = resolveExpoProjectId();
  if (!projectId) {
    stepWarn("expo_push_project_id_missing", {
      provider: "expo_notifications",
      lastErrorCode: "expo_push_project_id_missing",
      lastErrorMessage: "Expo project id bulunamadi.",
    });
    return null;
  }

  try {
    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
    stepInfo("expo_push_token_ready", {
      provider: "expo_notifications",
      permissionStatus: "granted",
      projectId,
    });
    return {
      token: tokenResponse?.data || null,
      projectId,
    };
  } catch (error) {
    stepWarn("expo_push_token_failed", {
      provider: "expo_notifications",
      lastErrorCode: "expo_push_token_failed",
      lastErrorMessage: String(error?.message || error),
    });
    return null;
  }
}

export async function getLastStepNotificationResponseAsync() {
  return Notifications.getLastNotificationResponseAsync();
}

export function addStepNotificationResponseListener(listener) {
  return Notifications.addNotificationResponseReceivedListener(listener);
}

export function addStepNotificationReceivedListener(listener) {
  return Notifications.addNotificationReceivedListener(listener);
}

async function ensureStepNotificationChannel() {
  if (Platform.OS !== "android") {
    return;
  }

  await Notifications.setNotificationChannelAsync(STEP_NOTIFICATION_CHANNEL, {
    name: "Prime Step Coach",
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 200, 120, 200],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

export async function clearStepCoachNotifications() {
  const scheduledIds = await readScheduledIds(STEP_NOTIFICATION_IDS_KEY);
  for (const id of scheduledIds) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch (error) {
      stepWarn("step_notification_cancel_failed", {
        provider: "expo_notifications",
        lastErrorCode: "step_notification_cancel_failed",
        lastErrorMessage: String(error?.message || error),
      });
    }
  }
  await writeScheduledIds(STEP_NOTIFICATION_IDS_KEY, []);
}

function buildCheckpointTrigger(now, checkpointHour) {
  const triggerDate = new Date(now);
  triggerDate.setHours(checkpointHour, 0, 0, 0);
  if (triggerDate <= now) {
    return null;
  }
  const seconds = Math.round((triggerDate - now) / 1000);
  return { type: 'timeInterval', seconds, repeats: false };
}

export async function scheduleStepCoachNotifications(coachState) {
  configureStepNotifications();
  const permission = await getStepNotificationPermissionState();
  if (permission.status !== "granted") {
    throw createStepError("step_notification_permission_missing", "Prime bildirimlerini acmadan zamanli mesaj kurulamiyor.", {
      permission,
    });
  }

  await ensureStepNotificationChannel();
  await clearStepCoachNotifications();

  const scheduledIds = [];
  const now = new Date();
  const futureCheckpoints = (coachState?.checkpointStatuses || []).filter((item) => item?.isUpcoming);

  for (const checkpoint of futureCheckpoints) {
    const trigger = buildCheckpointTrigger(now, checkpoint.hour);
    if (!trigger) {
      continue;
    }

    const copy = buildStepNotificationCopy(coachState, checkpoint);
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: copy.title,
        body: copy.body,
        data: {
          type: "step_coach",
          checkpoint: checkpoint.label,
          scenario: coachState.notificationScenario,
        },
      },
      trigger,
    });
    scheduledIds.push(notificationId);
  }

  await writeScheduledIds(STEP_NOTIFICATION_IDS_KEY, scheduledIds);
  stepInfo("step_notifications_scheduled", {
    provider: "expo_notifications",
    permissionStatus: permission.status,
  });

  return {
    scheduledIds,
    scheduledCount: scheduledIds.length,
  };
}

export async function clearSmartReminderNotifications() {
  const scheduledIds = await readScheduledIds(SMART_NOTIFICATION_IDS_KEY);
  for (const id of scheduledIds) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch (error) {
      stepWarn("smart_notification_cancel_failed", {
        provider: "expo_notifications",
        lastErrorCode: "smart_notification_cancel_failed",
        lastErrorMessage: String(error?.message || error),
      });
    }
  }
  await writeScheduledIds(SMART_NOTIFICATION_IDS_KEY, []);
}

export async function clearWalkSessionNotifications() {
  const scheduledIds = await readScheduledIds(WALK_SESSION_NOTIFICATION_IDS_KEY);
  for (const id of scheduledIds) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch (error) {
      stepWarn("walk_session_notification_cancel_failed", {
        provider: "expo_notifications",
        lastErrorCode: "walk_session_notification_cancel_failed",
        lastErrorMessage: String(error?.message || error),
      });
    }
  }
  await writeScheduledIds(WALK_SESSION_NOTIFICATION_IDS_KEY, []);
}

export async function scheduleWalkSessionNotifications(session) {
  configureStepNotifications();
  const permission = await getStepNotificationPermissionState();
  if (permission.status !== "granted") {
    throw createStepError("walk_session_notification_permission_missing", "Walk Session bildirimleri icin izin gerekli.", {
      permission,
    });
  }

  await ensureStepNotificationChannel();
  await clearWalkSessionNotifications();

  if (!session || session.status !== "active" || !session.startedAt) {
    return {
      scheduledIds: [],
      scheduledCount: 0,
    };
  }

  const now = new Date();
  const presetSeconds = Math.max(Math.round(Number(session.presetMinutes || 0) * 60), 60);
  const elapsedSeconds = Math.max(Math.floor(Number(session.elapsedSeconds || 0)), 0);
  const remainingSeconds = Math.max(presetSeconds - elapsedSeconds, 0);
  const scheduledIds = [];

  if (remainingSeconds > 120) {
    const inactivitySeconds = Math.max(Math.min(180, Math.max(remainingSeconds - 90, 90)), 90);
    const inactivityId = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Prime Walk Session",
        body: "Session acik. Kisa blok kapanmadan ritmi tekrar ac.",
        data: {
          type: "walk_session",
          triggerType: "inactivity_reminder",
        },
      },
      trigger: {
        type: "timeInterval",
        seconds: inactivitySeconds,
        repeats: false,
      },
    });
    scheduledIds.push(inactivityId);
  }

  if (remainingSeconds > 60) {
    const nearFinishId = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Prime Walk Session",
        body: "Son 1 dakika yaklasiyor. Bitirisi biraz daha canli gec.",
        data: {
          type: "walk_session",
          triggerType: "near_finish",
        },
      },
      trigger: {
        type: "timeInterval",
        seconds: Math.max(remainingSeconds - 60, 30),
        repeats: false,
      },
    });
    scheduledIds.push(nearFinishId);
  }

  await writeScheduledIds(WALK_SESSION_NOTIFICATION_IDS_KEY, scheduledIds);
  stepInfo("walk_session_notifications_scheduled", {
    provider: "expo_notifications",
    permissionStatus: permission.status,
  });

  return {
    scheduledIds,
    scheduledCount: scheduledIds.length,
  };
}

function buildSmartReminderTrigger(now) {
  const triggerDate = new Date(now);

  if (triggerDate.getHours() >= 21) {
    return null;
  }

  if (triggerDate.getHours() < 18) {
    triggerDate.setHours(19, 0, 0, 0);
  } else {
    triggerDate.setMinutes(triggerDate.getMinutes() + 1, 0, 0);
    if (triggerDate.getHours() >= 21) {
      return null;
    }
  }

  const seconds = Math.max(Math.round((triggerDate - now) / 1000), 60);
  return { type: "timeInterval", seconds, repeats: false };
}

export async function scheduleSmartReminderNotification(reminder) {
  configureStepNotifications();
  const permission = await getStepNotificationPermissionState();
  if (permission.status !== "granted") {
    throw createStepError(
      "smart_notification_permission_missing",
      "Akıllı hatırlatma için bildirim izni gerekli.",
      { permission }
    );
  }

  await ensureStepNotificationChannel();
  await clearSmartReminderNotifications();

  const trigger = buildSmartReminderTrigger(new Date());
  if (!trigger || !reminder?.body) {
    await writeScheduledIds(SMART_NOTIFICATION_IDS_KEY, []);
    return {
      scheduledIds: [],
      scheduledCount: 0,
    };
  }

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: reminder.title || "Akşam hatırlatması",
      body: reminder.body,
      data: {
        type: "smart_reminder",
        reminderType: reminder.type || "generic",
      },
    },
    trigger,
  });

  await writeScheduledIds(SMART_NOTIFICATION_IDS_KEY, [notificationId]);
  stepInfo("smart_notification_scheduled", {
    provider: "expo_notifications",
    permissionStatus: permission.status,
    reminderType: reminder.type || "generic",
  });

  return {
    scheduledIds: [notificationId],
    scheduledCount: 1,
  };
}
