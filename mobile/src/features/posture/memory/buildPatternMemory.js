/**
 * @file buildPatternMemory.js
 * @description Analyzes recent history entries to build pattern memory (persistent, emerging, unstable signals).
 */

import { PostureApplicationMemorySchema } from "./postureApplicationMemorySchema";

const MEMORY_PREFIX = "[POSTURE_APPLICATION_MEMORY]";

export function buildPatternMemory(historyEntries = [], maxWindow = 5) {
  const patternMemory = PostureApplicationMemorySchema.createPatternMemory();
  
  if (!historyEntries || historyEntries.length === 0) {
    return patternMemory;
  }

  // Sort by timestamp descending (newest first) and take the window
  const recentEntries = [...historyEntries]
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, maxWindow);

  const windowSize = recentEntries.length;
  const signalHistory = {};

  // Build a timeline for each signal type
  // Timeline is an array where index 0 is newest, windowSize-1 is oldest
  recentEntries.forEach((entry, index) => {
    // Only process signals from non-failed analyses, but degraded/limited is okay
    if (entry.status === "fail") return;

    entry.signals.forEach(signal => {
      // Ignore 'none' or very low severity signals as actual signals
      if (signal.severity === "none") return;

      if (!signalHistory[signal.type]) {
        signalHistory[signal.type] = {
          seenInLast: 0,
          severityPattern: new Array(windowSize).fill(null),
        };
      }
      signalHistory[signal.type].seenInLast += 1;
      signalHistory[signal.type].severityPattern[index] = signal.severity;
    });
  });

  Object.keys(signalHistory).forEach(type => {
    const history = signalHistory[type];
    const seenCount = history.seenInLast;
    
    // Reverse pattern so newest is last, which reads more naturally: [oldest, ..., newest]
    const naturalPattern = [...history.severityPattern].reverse();

    const signalData = {
      seenInLast: seenCount,
      severityPattern: naturalPattern,
      persistence: "low"
    };

    // A. Persistent Signal Rule
    // Seen in >= 3 out of last 5 (or > 50% of available if fewer than 5)
    const persistenceThreshold = Math.max(2, Math.ceil(windowSize / 2));
    
    // B. Emerging Signal Rule
    // Seen in the last 1 or 2 entries, but NOT seen in the older entries
    const seenRecently = history.severityPattern[0] !== null || history.severityPattern[1] !== null;
    let seenHistorically = false;
    for (let i = 2; i < windowSize; i++) {
        if (history.severityPattern[i] !== null) seenHistorically = true;
    }

    // C. Unstable Signal Rule
    // Var/yok dalgalanıyorsa (flapping). At least 2 transitions (null->val->null->val).
    let transitions = 0;
    for (let i = 1; i < windowSize; i++) {
        const prev = history.severityPattern[i - 1] === null;
        const curr = history.severityPattern[i] === null;
        if (prev !== curr) transitions++;
    }

    if (seenCount >= persistenceThreshold) {
      signalData.persistence = seenCount === windowSize ? "high" : "medium";
      patternMemory.persistentSignals[type] = signalData;
    } else if (seenRecently && !seenHistorically && windowSize > 2) {
      signalData.persistence = "emerging";
      patternMemory.emergingSignals[type] = signalData;
    } else if (transitions > 2) {
      signalData.persistence = "unstable";
      patternMemory.unstableSignals[type] = signalData;
    } else {
      signalData.persistence = "intermittent";
      patternMemory.intermittentSignals[type] = signalData;
    }
  });

  console.log(`${MEMORY_PREFIX} pattern memory built`, {
    persistent: Object.keys(patternMemory.persistentSignals),
    emerging: Object.keys(patternMemory.emergingSignals),
    unstable: Object.keys(patternMemory.unstableSignals)
  });

  return patternMemory;
}
