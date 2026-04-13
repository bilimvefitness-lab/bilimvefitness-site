/**
 * @file buildAnalysisHistoryEntry.js
 * @description Transforms a Layer 1 detection result into a Layer 2 application memory entry.
 */

import { PostureApplicationMemorySchema } from "./postureApplicationMemorySchema";

const MEMORY_PREFIX = "[POSTURE_APPLICATION_MEMORY]";

function extractSignals(findings) {
  if (!findings) return [];
  const signals = [];
  
  if (findings.forwardHead !== null && findings.forwardHead !== "unknown") {
    signals.push({ 
      type: "forward_head", 
      severity: findings.forwardHead ? "medium" : "none" 
    });
  }
  
  if (findings.shoulderAsymmetry && findings.shoulderAsymmetry !== "unknown" && findings.shoulderAsymmetry !== "none") {
    signals.push({ 
      type: "shoulder_asymmetry", 
      severity: "medium" 
    });
  }

  if (findings.kyphosis && findings.kyphosis !== "unknown") {
    signals.push({ 
      type: "kyphosis", 
      severity: findings.kyphosis 
    });
  }

  if (findings.spineAlignment && findings.spineAlignment !== "unknown") {
    signals.push({
      type: "spine_alignment",
      severity: findings.spineAlignment === "marked_deviation" ? "high" : (findings.spineAlignment === "slight_deviation" ? "medium" : "low")
    });
  }

  return signals;
}

function extractFeatureCoverageByView(measurements) {
  if (!measurements) return {};
  const coverage = {};
  
  ["front", "side", "back"].forEach(view => {
    if (measurements[view] && measurements[view].usable) {
      coverage[view] = {
        coverageRatio: measurements[view].reliability || 0,
        unusableReason: measurements[view].unusableReason || null
      };
    } else {
      coverage[view] = {
        coverageRatio: 0,
        unusableReason: measurements[view]?.unusableReason || "missing"
      };
    }
  });

  return coverage;
}

export function buildAnalysisHistoryEntry(layer1Result) {
  if (!layer1Result) return null;

  const entry = PostureApplicationMemorySchema.createAnalysisHistoryEntry();
  
  // Basic properties
  entry.id = `posture_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  entry.timestamp = new Date().toISOString();
  entry.status = layer1Result.status || "fail";
  entry.analysisMode = layer1Result.analysisMode || "ml";
  entry.score = layer1Result.score ?? null;
  entry.quality = layer1Result.qualityLevel || "low";
  entry.confidence = layer1Result.confidence || "low";
  entry.viewsUsed = layer1Result.viewsUsed || [];
  entry.limitedMode = entry.status === "degraded" || layer1Result.summary?.includes("platform_limited");

  // Signals
  entry.signals = extractSignals(layer1Result.findings);

  // Reliability
  if (layer1Result.reliabilityMemory) {
    entry.reliabilitySnapshot = {
      ...layer1Result.reliabilityMemory
    };
  } else {
    entry.reliabilitySnapshot = {
      captureQuality: layer1Result.qualityScore ? layer1Result.qualityScore / 100 : 0,
      landmarkReliability: 0,
      featureReliability: 0,
      signalReliability: 0,
      overall: entry.quality
    };
  }

  // Feature coverage
  entry.featureCoverageByView = extractFeatureCoverageByView(layer1Result.measurements);

  // Decision Memory Ref
  entry.detectionMemoryRef = {
    decisionStatus: layer1Result.decisionMemory?.finalStatus || entry.status,
    evidenceSummary: layer1Result.signalEvidence?.map(ev => ev.type) || [],
    reasonChain: layer1Result.decisionMemory?.reasonChain || [],
  };

  // Capture Issue Summary for this specific run
  const captureIssues = [];
  ["front", "side", "back"].forEach(view => {
    if (!entry.viewsUsed.includes(view) && view === "back") {
      captureIssues.push("back_missing");
    }
    const unusableReason = layer1Result.measurements?.[view]?.unusableReason;
    if (unusableReason) {
      captureIssues.push(`${view}_${unusableReason}`);
    }
  });
  entry.captureIssueSummary = captureIssues;

  console.log(`${MEMORY_PREFIX} history entry built`, {
    id: entry.id,
    score: entry.score,
    signalsCount: entry.signals.length
  });

  return entry;
}
