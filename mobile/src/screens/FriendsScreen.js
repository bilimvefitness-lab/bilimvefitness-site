/**
 * FriendsScreen — Social hub: leaderboard, challenges, requests + add.
 *
 * Tabs:
 *   Sıralama      — friends-only daily leaderboard; auto-submits score on focus
 *   Challenge'lar — active challenges; create / join / view ranking
 *   İstekler & Ekle — add friend by AG-ID + incoming/outgoing request management
 *
 * Score model (mirrors backend, max 145 pts):
 *   steps ≥ 10,000  → 40 pts
 *   water ≥ target  → 20 pts
 *   nutrition ≥ 1 meal → 20 pts
 *   sleep logged    → 20 pts
 *   all-four bonus  → 20 pts
 *   streak ≥ 7 days → +25  |  streak ≥ 3 days → +10
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useApp } from "../context/AppContext";
import { apiRequest } from "../api";
import { trackEvent } from "../utils/analytics";
import { STEP_GOAL } from "../steps/insights";
import { useLanguage } from "../i18n";

// ── Raw observation extraction ────────────────────────────────────────────────
// Frontend extracts raw numeric observations only.
// Backend applies ALL thresholds, derives completion flags, computes final score.
// Never send pre-computed booleans or a client-side score — backend rejects them.

// streak_days intentionally excluded — derived server-side from score history.
// Sending it would be ignored (model_config extra='ignore'), but omitting it
// makes the trust boundary explicit.
function extractRawObservations({ todaySteps, hydrationData, goals, dailySummary, sleepData }) {
  return {
    steps:             Math.max(0, Math.round(todaySteps ?? 0)),
    water_consumed_ml: Math.max(0, Math.round(hydrationData?.consumed_ml ?? 0)),
    // Prefer goals (profile-derived target) over hydration store fallback
    water_target_ml:   Math.max(1, Math.round(
      goals?.water_target_ml ?? hydrationData?.target_ml ?? 2500
    )),
    nutrition_meals:   Math.max(0, (dailySummary?.meals?.length ?? 0)),
    sleep_minutes:     Math.max(0, Math.round(sleepData?.duration_minutes ?? 0)),
  };
}

// Challenge-type progress value derived from same raw observations.
// Backend will clamp per type; this just selects the right raw field.
function extractProgressValue(challengeType, obs) {
  switch (challengeType) {
    case "steps-7day":        return obs.steps;
    case "water-7day":        return obs.water_consumed_ml;
    case "consistency-7day": {
      // 1.0 only if all four activities were completed (mirrors backend bonus logic)
      const allComplete = (
        obs.steps >= 10000 &&
        obs.water_consumed_ml >= obs.water_target_ml &&
        obs.nutrition_meals >= 1 &&
        obs.sleep_minutes > 0
      );
      return allComplete ? 1.0 : 0.0;
    }
    default: return 0;
  }
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function getTabs(t) {
  return [
    { key: "leaderboard", label: t("friends.tabs.leaderboard") },
    { key: "challenges",  label: t("friends.tabs.challenges") },
    { key: "social",      label: t("friends.tabs.requests") },
  ];
}

function Avatar({ name, size = 44 }) {
  const letter = (name || "?")[0].toUpperCase();
  return (
    <View style={[avStyles.circle, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[avStyles.letter, { fontSize: size * 0.42 }]}>{letter}</Text>
    </View>
  );
}
const avStyles = StyleSheet.create({
  circle: {
    backgroundColor: "#eef4e8", borderWidth: 2, borderColor: "#295c41",
    justifyContent: "center", alignItems: "center",
  },
  letter: { fontWeight: "900", color: "#295c41" },
});

function LoadingView() {
  return (
    <View style={sh.centered}>
      <ActivityIndicator size="large" color="#295c41" />
    </View>
  );
}

function EmptyView({ icon, title, sub }) {
  return (
    <View style={sh.centered}>
      <Text style={sh.emptyIcon}>{icon}</Text>
      <Text style={sh.emptyTitle}>{title}</Text>
      {sub ? <Text style={sh.emptySub}>{sub}</Text> : null}
    </View>
  );
}

// ── LEADERBOARD TAB ───────────────────────────────────────────────────────────

const SCORE_BADGES = [
  { key: "steps_complete",   emoji: "👟" },
  { key: "water_complete",   emoji: "💧" },
  { key: "nutrition_logged", emoji: "🥗" },
  { key: "sleep_logged",     emoji: "😴" },
];

function LeaderboardTab({ userId, deviceToken, focusVersion, scoreParamsRef }) {
  const { t } = useLanguage();
  const [rows, setRows]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing]     = useState(false);

  const submitAndFetch = useCallback(async (isRefresh = false) => {
    if (!userId || !deviceToken) { setLoading(false); return; }

    setSyncing(true);
    // Submit raw daily observations — backend derives score and completion flags.
    // Non-fatal: if backend is offline the leaderboard still shows cached values.
    try {
      const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD local
      const obs   = extractRawObservations(scoreParamsRef.current);
      await apiRequest("/social/score", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Device-Token": deviceToken },
        body: JSON.stringify({ user_id: userId, date: today, ...obs }),
      });
    } catch (_) { /* best-effort */ }
    setSyncing(false);

    // Fetch leaderboard
    try {
      const data = await apiRequest(
        `/social/leaderboard?user_id=${encodeURIComponent(userId)}`,
        { headers: { "X-Device-Token": deviceToken } },
      );
      setRows(Array.isArray(data) ? data : []);
    } catch (_) {
      if (!isRefresh) setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, deviceToken, scoreParamsRef]);

  useEffect(() => { submitAndFetch(); }, [submitAndFetch, focusVersion]);

  if (loading) return <LoadingView />;
  if (!rows.length) return (
    <EmptyView
      icon="🏅"
      title={t("friends.leaderboard.empty")}
      sub={t("friends.leaderboard.emptyHint")}
    />
  );

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); submitAndFetch(true); }}
          tintColor="#295c41"
        />
      }
    >
      {syncing && (
        <Text style={lbStyles.syncNote}>{t("friends.leaderboard.updating")}</Text>
      )}
      {rows.map((row) => (
        <View key={row.user_id} style={[lbStyles.row, row.is_self && lbStyles.rowSelf]}>
          {/* Rank */}
          <Text style={lbStyles.rankText}>
            {row.rank === 1 ? "🥇" : row.rank === 2 ? "🥈" : row.rank === 3 ? "🥉" : `#${row.rank}`}
          </Text>

          <Avatar name={row.display_name || row.public_user_id} size={42} />

          <View style={lbStyles.info}>
            <Text style={lbStyles.name} numberOfLines={1}>
              {row.display_name || t("common.unnamed")}{row.is_self ? t("friends.leaderboard.you") : ""}
            </Text>
            <View style={lbStyles.badgeRow}>
              {SCORE_BADGES.map((b) =>
                row[b.key]
                  ? <Text key={b.key} style={lbStyles.badge}>{b.emoji}</Text>
                  : null
              )}
              {!row.has_data && (
                <Text style={lbStyles.noDataNote}>{t("common.noData")}</Text>
              )}
            </View>
          </View>

          <View style={lbStyles.scoreBox}>
            <Text style={[lbStyles.score, row.is_self && lbStyles.scoreSelf]}>
              {row.score}
            </Text>
            <Text style={lbStyles.scoreLabel}>{t("friends.leaderboard.points")}</Text>
          </View>
        </View>
      ))}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const lbStyles = StyleSheet.create({
  syncNote: {
    textAlign: "center", fontSize: 12, fontWeight: "700",
    color: "#9ab09e", marginBottom: 10,
  },
  row: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#ffffff", borderRadius: 16,
    borderWidth: 1, borderColor: "#d8e9dc",
    padding: 12, marginBottom: 10,
  },
  rowSelf: { borderColor: "#295c41", borderWidth: 2, backgroundColor: "#f5fbf6" },
  rankText: { fontSize: 20, minWidth: 32, textAlign: "center" },
  info: { flex: 1, minWidth: 0 },
  name: { fontSize: 14, fontWeight: "800", color: "#14301f" },
  badgeRow: { flexDirection: "row", gap: 4, marginTop: 3, flexWrap: "wrap", alignItems: "center" },
  badge: { fontSize: 15 },
  noDataNote: { fontSize: 11, fontWeight: "700", color: "#c5c5c5" },
  scoreBox: { alignItems: "center", minWidth: 48 },
  score: { fontSize: 22, fontWeight: "900", color: "#4a6654" },
  scoreSelf: { color: "#295c41" },
  scoreLabel: { fontSize: 10, fontWeight: "700", color: "#9ab09e" },
});

// ── CHALLENGES TAB ────────────────────────────────────────────────────────────

function getChallengeTypes(t) {
  return [
    {
      key:   "steps-7day",
      emoji: "👟",
      label: t("friends.challenges.types.steps.title"),
      desc:  t("friends.challenges.types.steps.desc"),
    },
    {
      key:   "water-7day",
      emoji: "💧",
      label: t("friends.challenges.types.water.title"),
      desc:  t("friends.challenges.types.water.desc"),
    },
    {
      key:   "consistency-7day",
      emoji: "🔥",
      label: t("friends.challenges.types.consistency.title"),
      desc:  t("friends.challenges.types.consistency.desc"),
    },
  ];
}

function daysLeft(endDate, t) {
  try {
    const ms   = new Date(endDate + "T23:59:59") - Date.now();
    const days = Math.ceil(ms / 86_400_000);
    return days > 0
      ? t("friends.challenges.daysLeft", { days })
      : t("friends.challenges.done");
  } catch {
    return "";
  }
}

function ChallengesTab({ userId, deviceToken, focusVersion, scoreParamsRef }) {
  const { t } = useLanguage();
  const [challenges, setChallenges]       = useState([]);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [showCreate, setShowCreate]       = useState(false);
  const [selectedType, setSelectedType]   = useState("steps-7day");
  const [creating, setCreating]           = useState(false);
  const [openRankId, setOpenRankId]       = useState(null);
  const [ranking, setRanking]             = useState([]);
  const [loadingRank, setLoadingRank]     = useState(false);

  // Auto-submit today's progress for every active challenge the user participates in.
  // Uses raw observations (same source as leaderboard score).
  // Runs silently after each load — non-fatal.
  const submitDailyProgress = useCallback(async (activeChallenges) => {
    if (!deviceToken || !activeChallenges?.length) return;
    const today = new Date().toLocaleDateString("en-CA");
    const obs   = extractRawObservations(scoreParamsRef.current);

    const participating = activeChallenges.filter((ch) => ch.is_participant);
    await Promise.allSettled(
      participating.map((ch) =>
        apiRequest(`/social/challenges/${ch.id}/progress`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Device-Token": deviceToken },
          body: JSON.stringify({
            user_id: userId,
            date:    today,
            value:   extractProgressValue(ch.type, obs),
          }),
        })
      )
    );
  }, [userId, deviceToken, scoreParamsRef]);

  const load = useCallback(async () => {
    if (!userId || !deviceToken) { setLoading(false); return; }
    try {
      const data = await apiRequest(
        `/social/challenges?user_id=${encodeURIComponent(userId)}`,
        { headers: { "X-Device-Token": deviceToken } },
      );
      const list = Array.isArray(data) ? data : [];
      setChallenges(list);
      // Auto-submit progress after fetch — backend clamps/validates all values
      submitDailyProgress(list);
    } catch (_) {
      setChallenges([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, deviceToken, submitDailyProgress]);

  useEffect(() => { load(); }, [load, focusVersion]);

  async function handleCreate() {
    if (creating) return;
    setCreating(true);
    try {
      await apiRequest("/social/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Device-Token": deviceToken },
        body: JSON.stringify({ user_id: userId, type: selectedType, duration_days: 7 }),
      });
      setShowCreate(false);
      await load();
      trackEvent("challenge_created", { type: selectedType });
    } catch (err) {
      Alert.alert(t("common.error"), err?.message || t("friends.challenges.errors.createFailed"));
    } finally {
      setCreating(false);
    }
  }

  async function handleJoin(cid) {
    try {
      await apiRequest(`/social/challenges/${cid}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Device-Token": deviceToken },
        body: JSON.stringify({ user_id: userId }),
      });
      await load();
      trackEvent("challenge_joined");
    } catch (err) {
      Alert.alert(t("common.error"), err?.message || t("friends.challenges.errors.joinFailed"));
    }
  }

  async function toggleRanking(cid) {
    if (openRankId === cid) { setOpenRankId(null); return; }
    setOpenRankId(cid);
    setLoadingRank(true);
    setRanking([]);
    try {
      const data = await apiRequest(
        `/social/challenges/${cid}/ranking?user_id=${encodeURIComponent(userId)}`,
        { headers: { "X-Device-Token": deviceToken } },
      );
      setRanking(Array.isArray(data) ? data : []);
    } catch (_) {
      setRanking([]);
    } finally {
      setLoadingRank(false);
    }
  }

  const challengeTypes = getChallengeTypes(t);
  const typeInfo = (type) =>
    challengeTypes.find((ct) => ct.key === type) || { emoji: "🏆", label: type };

  if (loading) return <LoadingView />;

  return (
    <>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor="#295c41"
          />
        }
      >
        <Pressable style={chStyles.createBtn} onPress={() => setShowCreate(true)}>
          <Text style={chStyles.createBtnText}>{t("friends.challenges.createButton")}</Text>
        </Pressable>

        {!challenges.length && (
          <EmptyView
            icon="🏆"
            title={t("friends.challenges.empty")}
            sub={t("friends.challenges.emptyHint")}
          />
        )}

        {challenges.map((ch) => {
          const info          = typeInfo(ch.type);
          const isParticipant = ch.is_participant;
          const isOpen        = openRankId === ch.id;

          return (
            <View key={ch.id} style={chStyles.card}>
              <View style={chStyles.cardHeader}>
                <Text style={chStyles.typeEmoji}>{info.emoji}</Text>
                <View style={chStyles.cardInfo}>
                  <Text style={chStyles.cardTitle}>{ch.title}</Text>
                  <Text style={chStyles.cardMeta}>
                    {t("friends.challenges.participants", { count: ch.participant_count })} · {daysLeft(ch.end_date, t)}
                  </Text>
                </View>
                {isParticipant ? (
                  <Pressable
                    style={[chStyles.actionBtn, isOpen && chStyles.actionBtnActive]}
                    onPress={() => toggleRanking(ch.id)}
                  >
                    <Text style={[chStyles.actionBtnText, isOpen && chStyles.actionBtnTextActive]}>
                      {isOpen ? t("friends.challenges.close") : t("friends.challenges.ranking")}
                    </Text>
                  </Pressable>
                ) : (
                  <Pressable style={chStyles.joinBtn} onPress={() => handleJoin(ch.id)}>
                    <Text style={chStyles.joinBtnText}>{t("friends.challenges.join")}</Text>
                  </Pressable>
                )}
              </View>

              {isOpen && (
                <View style={chStyles.rankSection}>
                  {loadingRank ? (
                    <ActivityIndicator size="small" color="#295c41" style={{ marginVertical: 10 }} />
                  ) : ranking.length === 0 ? (
                    <Text style={chStyles.rankEmpty}>{t("friends.challenges.noProgress")}</Text>
                  ) : (
                    ranking.map((r) => (
                      <View
                        key={r.user_id}
                        style={[chStyles.rankRow, r.is_self && chStyles.rankRowSelf]}
                      >
                        <Text style={chStyles.rankNum}>#{r.rank}</Text>
                        <Text style={chStyles.rankName} numberOfLines={1}>
                          {r.display_name || t("common.unnamed")}{r.is_self ? t("friends.leaderboard.you") : ""}
                        </Text>
                        <Text style={chStyles.rankVal}>
                          {Math.round(r.total_value).toLocaleString()}
                        </Text>
                      </View>
                    ))
                  )}
                </View>
              )}
            </View>
          );
        })}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Create challenge modal */}
      <Modal
        visible={showCreate}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCreate(false)}
      >
        <Pressable style={chStyles.backdrop} onPress={() => setShowCreate(false)}>
          {/* Inner View (not Pressable) so taps on sheet don't close the modal */}
          <View style={chStyles.sheet}>
            <Text style={chStyles.sheetTitle}>{t("friends.challenges.modalTitle")}</Text>
            <Text style={chStyles.sheetSub}>{t("friends.challenges.modalSubtitle")}</Text>

            {challengeTypes.map((ct) => (
              <Pressable
                key={ct.key}
                style={[chStyles.typeRow, selectedType === ct.key && chStyles.typeRowSelected]}
                onPress={() => setSelectedType(ct.key)}
              >
                <Text style={chStyles.typeEmoji}>{ct.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={chStyles.typeLabel}>{ct.label}</Text>
                  <Text style={chStyles.typeDesc}>{ct.desc}</Text>
                </View>
                {selectedType === ct.key && (
                  <Text style={chStyles.typeCheck}>✓</Text>
                )}
              </Pressable>
            ))}

            <Pressable
              style={[chStyles.confirmBtn, creating && { opacity: 0.5 }]}
              onPress={handleCreate}
              disabled={creating}
            >
              {creating
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={chStyles.confirmBtnText}>{t("friends.challenges.startButton")}</Text>}
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const chStyles = StyleSheet.create({
  createBtn: {
    backgroundColor: "#295c41", borderRadius: 14,
    paddingVertical: 14, alignItems: "center", marginBottom: 16,
  },
  createBtnText: { color: "#fff", fontWeight: "900", fontSize: 15 },

  card: {
    backgroundColor: "#ffffff", borderRadius: 16,
    borderWidth: 1, borderColor: "#d8e9dc",
    padding: 14, marginBottom: 10,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  typeEmoji: { fontSize: 26 },
  cardInfo: { flex: 1, minWidth: 0 },
  cardTitle: { fontSize: 15, fontWeight: "800", color: "#14301f" },
  cardMeta: { fontSize: 12, fontWeight: "700", color: "#9ab09e", marginTop: 2 },

  joinBtn: {
    backgroundColor: "#295c41", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  joinBtnText: { color: "#fff", fontWeight: "900", fontSize: 13 },
  actionBtn: {
    backgroundColor: "#eef4e8", borderRadius: 10,
    borderWidth: 1, borderColor: "#295c41",
    paddingHorizontal: 14, paddingVertical: 8,
  },
  actionBtnActive: { backgroundColor: "#295c41" },
  actionBtnText: { color: "#295c41", fontWeight: "900", fontSize: 13 },
  actionBtnTextActive: { color: "#fff" },

  rankSection: { marginTop: 12, borderTopWidth: 1, borderTopColor: "#eef4e8", paddingTop: 8 },
  rankRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6, gap: 10 },
  rankRowSelf: { backgroundColor: "#f5fbf6", borderRadius: 8, paddingHorizontal: 6 },
  rankNum: { fontSize: 13, fontWeight: "900", color: "#9ab09e", width: 28 },
  rankName: { flex: 1, fontSize: 14, fontWeight: "800", color: "#14301f" },
  rankVal: { fontSize: 14, fontWeight: "900", color: "#295c41" },
  rankEmpty: { fontSize: 13, fontWeight: "700", color: "#c0c0c0", textAlign: "center", paddingVertical: 8 },

  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, gap: 12,
  },
  sheetTitle: { fontSize: 20, fontWeight: "900", color: "#14301f" },
  sheetSub: { fontSize: 13, fontWeight: "700", color: "#9ab09e", marginBottom: 4 },
  typeRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 14, borderRadius: 14, borderWidth: 1.5, borderColor: "#d8e9dc",
  },
  typeRowSelected: { borderColor: "#295c41", backgroundColor: "#f5fbf6" },
  typeLabel: { fontSize: 15, fontWeight: "800", color: "#14301f" },
  typeDesc: { fontSize: 12, fontWeight: "700", color: "#9ab09e", marginTop: 2 },
  typeCheck: { fontSize: 18, color: "#295c41", fontWeight: "900" },
  confirmBtn: {
    backgroundColor: "#295c41", borderRadius: 14,
    paddingVertical: 16, alignItems: "center", marginTop: 4,
  },
  confirmBtnText: { color: "#fff", fontWeight: "900", fontSize: 16 },
});

// ── SOCIAL TAB (İstekler + Ekle merged) ──────────────────────────────────────

// Maps status codes to i18n keys + colors; text resolved at render time via t()
const STATUS_KEYS = {
  sent:             { key: "friends.social.requestSent",     color: "#295c41" },
  not_found:        { key: "friends.errors.userNotFound",    color: "#9d3636" },
  self:             { key: "friends.errors.selfRequest",     color: "#8a6a00" },
  already:          { key: "friends.errors.alreadyFriends",  color: "#295c41" },
  pending:          { key: "friends.errors.pendingExists",   color: "#8a6a00" },
  reverse_pending:  { key: "friends.errors.reverseRequest",  color: "#8a6a00" },
  connection_error: { key: "friends.errors.connectionError", color: "#9d3636" },
  error:            { key: "friends.errors.requestFailed",   color: "#9d3636" },
};

function SocialTab({ userId, publicUserId, deviceToken, onAccepted, focusVersion }) {
  const { t } = useLanguage();
  // Add-friend state
  const [input, setInput]       = useState("");
  const [found, setFound]       = useState(null);
  const [searching, setSearching] = useState(false);
  const [sending, setSending]   = useState(false);
  const [status, setStatus]     = useState(null);

  // Requests state
  const [incoming, setIncoming]         = useState([]);
  const [outgoing, setOutgoing]         = useState([]);
  const [loadingReqs, setLoadingReqs]   = useState(true);
  const [processing, setProcessing]     = useState(null);

  const { profileForm } = useApp();

  const loadRequests = useCallback(async () => {
    if (!userId) return;
    const authHeaders = deviceToken ? { "X-Device-Token": deviceToken } : {};
    const [inc, out] = await Promise.allSettled([
      apiRequest(`/friends/incoming?user_id=${encodeURIComponent(userId)}`, { headers: authHeaders }),
      apiRequest(`/friends/outgoing?user_id=${encodeURIComponent(userId)}`, { headers: authHeaders }),
    ]);
    setIncoming(inc.status === "fulfilled" && Array.isArray(inc.value) ? inc.value : []);
    setOutgoing(out.status === "fulfilled" && Array.isArray(out.value) ? out.value : []);
    setLoadingReqs(false);
  }, [userId, deviceToken]);

  useEffect(() => { loadRequests(); }, [loadRequests, focusVersion]);

  async function handleSearch() {
    const id = input.trim().toUpperCase();
    if (!id) return;
    if (id === publicUserId) { setStatus("self"); return; }
    setSearching(true);
    setFound(null);
    setStatus(null);
    try {
      const user = await apiRequest(`/friends/find?public_id=${encodeURIComponent(id)}`);
      setFound(user);
    } catch {
      setStatus("not_found");
    } finally {
      setSearching(false);
    }
  }

  async function handleSend() {
    if (!found || sending) return;
    setSending(true);
    setStatus(null);
    const body = JSON.stringify({
      from_user_id:  userId,
      from_public_id: publicUserId || "",
      from_name:     profileForm?.name || "",
      to_public_id:  found.public_user_id,
    });
    const headers = {
      "Content-Type": "application/json",
      ...(deviceToken ? { "X-Device-Token": deviceToken } : {}),
    };
    async function attempt() {
      return apiRequest("/friends/request", { method: "POST", headers, body });
    }
    try {
      try {
        await attempt();
      } catch (e) {
        if (e?.category === "network") {
          await new Promise((r) => setTimeout(r, 2000));
          await attempt();
        } else {
          throw e;
        }
      }
      setStatus("sent");
      setFound(null);
      setInput("");
      trackEvent("friend_request_sent");
    } catch (err) {
      const msg = String(err?.message || "");
      if (msg.includes("Zaten arkadaş"))             setStatus("already");
      else if (msg.includes("zaten istek gönderdi")) setStatus("reverse_pending");
      else if (msg.includes("bekleyen bir istek"))   setStatus("pending");
      else if (msg.includes("Kullanıcı bulunamadı")) setStatus("not_found");
      else if (msg.includes("Kendinize"))            setStatus("self");
      else if (err?.category === "network")          setStatus("connection_error");
      else                                           setStatus("error");
    } finally {
      setSending(false);
    }
  }

  async function handleRespond(req, accept) {
    if (processing) return;
    setProcessing(req.id);
    try {
      await apiRequest("/friends/respond", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(deviceToken ? { "X-Device-Token": deviceToken } : {}),
        },
        body: JSON.stringify({ request_id: req.id, user_id: userId, accept }),
      });
      setIncoming((prev) => prev.filter((r) => r.id !== req.id));
      trackEvent("friend_request_responded", { accept });
      if (accept) {
        onAccepted?.();
        Alert.alert(
          t("friends.social.accepted"),
          t("friends.social.nowFriend", { name: req.from_name || req.from_public_id }),
        );
      }
    } catch (err) {
      Alert.alert(t("common.error"), err?.message || t("common.operationFailed"));
    } finally {
      setProcessing(null);
    }
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      {/* ── Add friend ── */}
      <View style={soStyles.addSection}>
        <Text style={soStyles.sectionTitle}>{t("friends.social.addById")}</Text>
        <Text style={soStyles.sectionSub}>{t("friends.social.addHint")}</Text>
        <View style={soStyles.inputRow}>
          <TextInput
            style={soStyles.idInput}
            placeholder="AG-000000"
            placeholderTextColor="#9ab09e"
            value={input}
            onChangeText={(t) => { setInput(t); setStatus(null); setFound(null); }}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <Pressable
            style={[soStyles.searchBtn, (!input.trim() || searching) && soStyles.searchBtnDisabled]}
            onPress={handleSearch}
            disabled={!input.trim() || searching}
          >
            {searching
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={soStyles.searchBtnText}>{t("common.search")}</Text>}
          </Pressable>
        </View>

        {found && (
          <View style={soStyles.foundCard}>
            <Avatar name={found.display_name || found.public_user_id} size={52} />
            <View style={soStyles.foundInfo}>
              <Text style={soStyles.foundName}>{found.display_name || t("common.unnamed")}</Text>
              <Text style={soStyles.foundId}>{found.public_user_id}</Text>
            </View>
            <Pressable
              style={[soStyles.sendBtn, sending && soStyles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={sending}
            >
              {sending
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={soStyles.sendBtnText}>{t("common.add")}</Text>}
            </Pressable>
          </View>
        )}

        {status && STATUS_KEYS[status] && (
          <View style={[soStyles.statusMsg, { borderColor: STATUS_KEYS[status].color }]}>
            <Text style={[soStyles.statusText, { color: STATUS_KEYS[status].color }]}>
              {t(STATUS_KEYS[status].key)}
            </Text>
          </View>
        )}
      </View>

      {/* ── Requests ── */}
      {loadingReqs ? (
        <ActivityIndicator size="small" color="#295c41" style={{ marginTop: 8, marginBottom: 20 }} />
      ) : (
        <>
          {incoming.length > 0 && (
            <>
              <Text style={soStyles.reqLabel}>{t("friends.social.incoming")}</Text>
              {incoming.map((req) => (
                <View key={req.id} style={soStyles.reqRow}>
                  <Avatar name={req.from_name || req.from_public_id} size={46} />
                  <View style={soStyles.reqInfo}>
                    <Text style={soStyles.reqName}>{req.from_name || t("common.unnamed")}</Text>
                    <Text style={soStyles.reqId}>{req.from_public_id}</Text>
                  </View>
                  <View style={soStyles.reqActions}>
                    <Pressable
                      style={soStyles.acceptBtn}
                      onPress={() => handleRespond(req, true)}
                      disabled={!!processing}
                    >
                      {processing === req.id
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Text style={soStyles.acceptBtnText}>{t("common.accept")}</Text>}
                    </Pressable>
                    <Pressable
                      style={soStyles.rejectBtn}
                      onPress={() => handleRespond(req, false)}
                      disabled={!!processing}
                    >
                      <Text style={soStyles.rejectBtnText}>{t("common.reject")}</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </>
          )}

          {outgoing.length > 0 && (
            <>
              <Text style={soStyles.reqLabel}>{t("friends.social.outgoing")}</Text>
              {outgoing.map((req) => (
                <View key={req.id} style={[soStyles.reqRow, { opacity: 0.8 }]}>
                  <Avatar name={req.to_public_id} size={44} />
                  <View style={soStyles.reqInfo}>
                    <Text style={soStyles.reqName}>{req.to_public_id}</Text>
                    <Text style={soStyles.reqId}>{t("friends.social.waitingResponse")}</Text>
                  </View>
                  <View style={soStyles.pendingBadge}>
                    <Text style={soStyles.pendingBadgeText}>{t("common.pending")}</Text>
                  </View>
                </View>
              ))}
            </>
          )}

          {!incoming.length && !outgoing.length && (
            <View style={[sh.centered, { paddingTop: 20 }]}>
              <Text style={sh.emptyIcon}>📬</Text>
              <Text style={sh.emptyTitle}>{t("friends.social.noPendingRequests")}</Text>
            </View>
          )}
        </>
      )}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const soStyles = StyleSheet.create({
  addSection: { paddingTop: 4, marginBottom: 16 },
  sectionTitle: { fontSize: 17, fontWeight: "900", color: "#14301f", marginBottom: 4 },
  sectionSub: { fontSize: 13, fontWeight: "700", color: "#9ab09e", marginBottom: 16 },
  inputRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  idInput: {
    flex: 1, borderWidth: 1.5, borderColor: "#d8e9dc",
    borderRadius: 14, backgroundColor: "#ffffff",
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, fontWeight: "800", color: "#14301f", letterSpacing: 2,
  },
  searchBtn: {
    backgroundColor: "#295c41", borderRadius: 14,
    justifyContent: "center", paddingHorizontal: 18,
  },
  searchBtnDisabled: { opacity: 0.4 },
  searchBtnText: { color: "#fff", fontWeight: "900", fontSize: 14 },

  foundCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: "#ffffff", borderRadius: 16,
    borderWidth: 2, borderColor: "#295c41",
    padding: 16, marginBottom: 12,
  },
  foundInfo: { flex: 1 },
  foundName: { fontSize: 16, fontWeight: "900", color: "#14301f" },
  foundId: { fontSize: 13, fontWeight: "700", color: "#295c41", marginTop: 2 },
  sendBtn: {
    backgroundColor: "#295c41", borderRadius: 12,
    paddingHorizontal: 18, paddingVertical: 10,
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { color: "#fff", fontWeight: "900", fontSize: 14 },

  statusMsg: {
    borderWidth: 1.5, borderRadius: 12, padding: 14,
    backgroundColor: "#f7fcf8", marginBottom: 12,
  },
  statusText: { fontSize: 14, fontWeight: "800", textAlign: "center" },

  reqLabel: {
    fontSize: 11, fontWeight: "900", color: "#9ab09e",
    letterSpacing: 1.2, textTransform: "uppercase",
    marginBottom: 8, marginTop: 4, marginLeft: 4,
  },
  reqRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#ffffff", borderRadius: 16,
    borderWidth: 1, borderColor: "#d8e9dc",
    padding: 14, marginBottom: 10,
  },
  reqInfo: { flex: 1 },
  reqName: { fontSize: 15, fontWeight: "800", color: "#14301f" },
  reqId: { fontSize: 12, fontWeight: "700", color: "#9ab09e", marginTop: 2 },
  reqActions: { flexDirection: "row", gap: 8 },
  acceptBtn: {
    backgroundColor: "#295c41", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 8,
    minWidth: 60, alignItems: "center",
  },
  acceptBtnText: { color: "#fff", fontWeight: "900", fontSize: 13 },
  rejectBtn: {
    backgroundColor: "#fff", borderRadius: 10,
    borderWidth: 1.5, borderColor: "#c9d8ca",
    paddingHorizontal: 14, paddingVertical: 8,
    minWidth: 60, alignItems: "center",
  },
  rejectBtnText: { color: "#7fa88a", fontWeight: "800", fontSize: 13 },
  pendingBadge: {
    backgroundColor: "#f0f7f1", borderRadius: 8,
    borderWidth: 1, borderColor: "#d8e9dc",
    paddingHorizontal: 10, paddingVertical: 5,
  },
  pendingBadgeText: { fontSize: 11, fontWeight: "800", color: "#9ab09e" },
});

// ── MAIN SCREEN ───────────────────────────────────────────────────────────────

export default function FriendsScreen() {
  const {
    userId,
    publicUserId,
    deviceToken,
    todaySteps,
    hydrationData,
    goals,
    dailySummary,
    sleepData,
    // streakState intentionally not destructured — streak is now backend-derived.
    // Frontend no longer sends or uses streak_days for score submission.
  } = useApp();

  const { t } = useLanguage();

  const [activeTab, setActiveTab]     = useState("leaderboard");
  const [listVersion, setListVersion] = useState(0);
  const [focusVersion, setFocusVersion] = useState(0);

  // scoreParamsRef: always-current raw observations, stable ref so
  // LeaderboardTab's submitAndFetch doesn't re-run on every AppContext update.
  // streak_days excluded — derived server-side from score history.
  const scoreParamsRef = useRef({ todaySteps, hydrationData, goals, dailySummary, sleepData });
  scoreParamsRef.current = { todaySteps, hydrationData, goals, dailySummary, sleepData };

  useFocusEffect(
    useCallback(() => { setFocusVersion((v) => v + 1); }, [])
  );

  const bumpList = useCallback(() => setListVersion((v) => v + 1), []);

  useEffect(() => { trackEvent("friends_opened"); }, []);

  // leaderboard tab re-fetches on: screen focus OR after accepting a request
  const leaderboardVersion = focusVersion + listVersion;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("friends.title")}</Text>
        {publicUserId
          ? <Text style={styles.myId}>{t("friends.yourId", { id: publicUserId })}</Text>
          : null}
      </View>

      <View style={styles.tabBar}>
        {getTabs(t).map((tab) => (
          <Pressable
            key={tab.key}
            style={[styles.tabItem, activeTab === tab.key && styles.tabItemActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.content}>
        {activeTab === "leaderboard" && (
          <LeaderboardTab
            userId={userId}
            deviceToken={deviceToken}
            focusVersion={leaderboardVersion}
            scoreParamsRef={scoreParamsRef}
          />
        )}
        {activeTab === "challenges" && (
          <ChallengesTab
            userId={userId}
            deviceToken={deviceToken}
            focusVersion={focusVersion}
            scoreParamsRef={scoreParamsRef}
          />
        )}
        {activeTab === "social" && (
          <SocialTab
            userId={userId}
            publicUserId={publicUserId}
            deviceToken={deviceToken}
            onAccepted={bumpList}
            focusVersion={focusVersion}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

// ── SHARED STYLES ─────────────────────────────────────────────────────────────

const sh = StyleSheet.create({
  centered: {
    flex: 1, justifyContent: "center", alignItems: "center",
    paddingTop: 60, gap: 12,
  },
  emptyIcon: { fontSize: 44 },
  emptyTitle: { fontSize: 17, fontWeight: "800", color: "#4a6654" },
  emptySub: {
    fontSize: 13, color: "#9ab09e",
    textAlign: "center", paddingHorizontal: 24, fontWeight: "600",
  },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#eef4e8" },
  header: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 12 },
  title: { fontSize: 26, fontWeight: "900", color: "#14301f" },
  myId: { fontSize: 12, fontWeight: "800", color: "#7fa88a", marginTop: 3, letterSpacing: 1 },
  tabBar: {
    flexDirection: "row", marginHorizontal: 22,
    backgroundColor: "#ffffff", borderRadius: 14,
    borderWidth: 1, borderColor: "#d8e9dc",
    padding: 4, marginBottom: 12,
  },
  tabItem: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10 },
  tabItemActive: { backgroundColor: "#295c41" },
  tabLabel: { fontSize: 12, fontWeight: "800", color: "#7fa88a" },
  tabLabelActive: { color: "#ffffff" },
  content: { flex: 1, paddingHorizontal: 22 },
});
