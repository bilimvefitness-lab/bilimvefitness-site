import { apiRequest } from "../api";

function localDateKey(dateValue = new Date()) {
  const date = new Date(dateValue);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildDefaultSocialDisplayName(userId) {
  const suffix = String(userId || "guest").slice(-4).toUpperCase();
  return `Prime ${suffix || "USER"}`;
}

export async function getStepSocialOverview(userId, dateKey = localDateKey()) {
  const params = new URLSearchParams({
    user_id: userId,
    date: dateKey,
  });
  return apiRequest(`/social/overview?${params.toString()}`);
}

export async function getStepSocialEvents(userId, dateKey = localDateKey(), limit = 20) {
  const params = new URLSearchParams({
    user_id: userId,
    date: dateKey,
    limit: String(limit),
  });
  return apiRequest(`/social/events?${params.toString()}`);
}

export async function createStepSocialGroup(userId, displayName, groupName) {
  return apiRequest("/social/groups", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: userId,
      display_name: String(displayName || "").trim(),
      group_name: String(groupName || "").trim(),
    }),
  });
}

export async function joinStepSocialGroup(userId, displayName, inviteToken) {
  return apiRequest("/social/groups/join", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: userId,
      display_name: String(displayName || "").trim(),
      invite_token: String(inviteToken || "").trim(),
    }),
  });
}

export async function syncStepSocialChallenges(userId, challenges) {
  return apiRequest("/social/challenges/sync", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: userId,
      challenges,
    }),
  });
}

export async function registerStepSocialPushToken(userId, expoPushToken, platform, deviceId) {
  return apiRequest("/social/push/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: userId,
      expo_push_token: String(expoPushToken || "").trim(),
      platform: String(platform || "unknown").trim(),
      device_id: String(deviceId || "").trim(),
    }),
  });
}

export async function createStepSocialDuel(challengerUserId, opponentUserId, dateKey = localDateKey()) {
  return apiRequest("/social/duels", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      challenger_user_id: challengerUserId,
      opponent_user_id: opponentUserId,
      date: dateKey,
    }),
  });
}

export function parseStepSocialInviteToken(value) {
  const rawValue = String(value || "").trim();
  if (!rawValue) {
    return null;
  }

  if (rawValue.startsWith("primewalk://invite/")) {
    return rawValue;
  }

  if (rawValue.includes("/invite/")) {
    const inviteCode = rawValue.split("/invite/").pop()?.split(/[?#]/)[0];
    return inviteCode ? `primewalk://invite/${inviteCode}` : null;
  }

  if (/^[A-Z0-9]{4,16}$/i.test(rawValue)) {
    return `primewalk://invite/${rawValue.toUpperCase()}`;
  }

  return null;
}

export function getStepSocialFocusFromPayload(payload) {
  const focus = String(payload?.focus || "").trim().toLowerCase();
  if (focus === "duel" || focus === "challenge" || focus === "social") {
    return focus;
  }

  const eventType = String(payload?.event_type || payload?.type || "").trim().toLowerCase();
  if (eventType.includes("duel")) {
    return "duel";
  }
  if (eventType.includes("challenge") || eventType.includes("streak")) {
    return "challenge";
  }
  return "social";
}
