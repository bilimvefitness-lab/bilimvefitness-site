/**
 * @file buildPostureHabitEngine.js
 * @description Layer 7 - Transforms daily coach tasks into habit loops via streaks and micro-rewards.
 */

const MEMORY_PREFIX = "[POSTURE_HABIT_ENGINE]";

export function buildPostureHabitEngine(coachOutput, actionLogs = {}, postureProfileState) {
  console.log(`${MEMORY_PREFIX} Building Habit Engine...`);

  const habit = {
    streak: {
      scanStreak: 0,
      habitStreak: 0,
      message: "Duruş farkındalığını bugün başlat.",
      urgency: null
    },
    completion: {
      primaryDone: false,
      secondaryDone: false,
      progress: 0,
      status: "pending" // "pending", "partial", "completed"
    },
    reward: {
      message: null
    }
  };

  if (!coachOutput || !postureProfileState?.postureProfile?.memoryMeta) return habit;

  const historyCount = postureProfileState.postureProfile.memoryMeta.historyCount || 0;
  
  // Example logic extrapolating streak from available history / action logs
  // In a real DB, actionLogs would track actual habit logs vs scan logs
  const scanStreak = actionLogs.scanStreak !== undefined ? actionLogs.scanStreak : Math.min(historyCount, 1);
  const habitStreak = actionLogs.habitStreak !== undefined ? actionLogs.habitStreak : 0;
  const missedHabitDays = actionLogs.missedHabitDays || 0;
  
  const primaryDone = actionLogs.primaryDone || false;
  const secondaryDone = actionLogs.secondaryDone || false;

  let progress = 0;
  if (primaryDone && secondaryDone) progress = 1;
  else if (primaryDone || secondaryDone) progress = 0.5;

  habit.completion.primaryDone = primaryDone;
  habit.completion.secondaryDone = secondaryDone;
  habit.completion.progress = progress;
  habit.completion.status = progress === 1 ? "completed" : progress > 0 ? "partial" : "pending";

  // 1. Streak Calculation & Urgency (Habit focused, not scan focused)
  habit.streak.scanStreak = scanStreak;
  habit.streak.habitStreak = habitStreak;

  if (habitStreak === 0) {
    habit.streak.message = "Farkındalığı bugün başlat.";
  } else {
    habit.streak.message = `${habitStreak} günlük tutarlı duruş pratiği.`;
    
    // Urgency check (Calmer, premium wording)
    if (habit.completion.status !== "completed") {
      if (missedHabitDays === 0) {
        habit.streak.urgency = "Günün odağını tamamlayarak ivmeni koru.";
      } else if (missedHabitDays === 1) {
        habit.streak.urgency = "Duruş rutinine geri dönmek için ideal bir gün.";
      }
    }
  }

  // 2. Reward Messaging (Expert, non-gimmicky)
  if (habit.completion.status === "completed") {
    const rewards = [
      "Tutarlı bir ilerleme.",
      "Duruş farkındalığı korundu.",
      "Gelişim stabil.",
      "Günlük odak başarıyla hizalandı.",
      "Disiplin korundu."
    ];
    habit.reward.message = rewards[Math.floor(Math.random() * rewards.length)];
  } else if (habit.completion.status === "partial") {
    habit.reward.message = "Pratik başladı, tamamlamak için devam et.";
  } else {
    habit.reward.message = "Günlük odak seni bekliyor.";
  }

  return habit;
}
