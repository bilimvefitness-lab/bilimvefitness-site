import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useLanguage } from "../i18n";
import { useApp } from "../context/AppContext";
import { runPostureAnalysis } from "../features/posture/postureAnalysisEngine";
import { buildPostureResultViewModel } from "../features/posture/posturePresentation";
import { savePostureHistoryEntry } from "../features/posture/postureStorage";
import { completeActivePostureScanTask } from "../features/posture/postureTaskBridge";
import {
  PostureShareCard,
  captureAndSharePosture
} from "../features/posture/postureVisualEngine";
import { getPostureHistory } from "../features/posture/postureStorage";
import { buildPostureProfileState } from "../features/posture/memory/buildPostureProfileState";
import { buildPostureKnowledgeOutput } from "../features/posture/knowledge/buildPostureKnowledgeOutput";
import { buildPostureProductOutput } from "../features/posture/knowledge/buildPostureProductOutput";
import { 
  StoryVariant, 
  SocialProofVariant, 
  ReelsCoverVariant 
} from "../features/posture/postureShareVariants";

const STEPS = ["intro", "instructions", "capture", "result"];
const ANALYSIS_DELAY_MS = 1100;
const INITIAL_CAPTURES = {
  front: null,
  side: null,
  back: null,
};

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function PostureIllustration() {
  return (
    <View style={styles.illustrationMain}>
      {/* Stylized Silhouette */}
      <View style={styles.illuHead} />
      <View style={styles.illuShoulders} />
      <View style={styles.illuTorso}>
        <View style={styles.illuSpine} />
      </View>
      <View style={styles.illuGrid}>
        <View style={[styles.illuGridLine, { top: "30%" }]} />
        <View style={[styles.illuGridLine, { top: "60%" }]} />
        <View style={[styles.illuGridLineVertical, { left: "50%" }]} />
      </View>
    </View>
  );
}

function StepIndicator({ currentStep }) {
  const currentIndex = STEPS.indexOf(currentStep);

  return (
    <View style={styles.stepIndicator}>
      {STEPS.map((step, index) => {
        const active = index === currentIndex;
        const completed = index < currentIndex;

        return (
          <View
            key={step}
            style={[
              styles.stepDot,
              completed && styles.stepDotCompleted,
              active && styles.stepDotActive,
            ]}
          />
        );
      })}
    </View>
  );
}

function FlowScaffold({ step, title, subtitle, children, footer }) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <StepIndicator currentStep={step} />

        <View style={styles.heroCard}>
          <View style={styles.copyBlock}>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>

          <View style={styles.body}>{children}</View>
          <View style={styles.footer}>{footer}</View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PrimaryButton({ label, onPress, disabled }) {
  function handlePress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress?.();
  }

  return (
    <Pressable
      style={({ pressed }) => [
        styles.primaryButton,
        disabled && styles.primaryButtonDisabled,
        !disabled && pressed && styles.primaryButtonPressed
      ]}
      onPress={handlePress}
      disabled={disabled}
    >
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({ label, onPress }) {
  function handlePress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  }

  return (
    <Pressable 
      style={({ pressed }) => [
        styles.secondaryButton,
        pressed && styles.secondaryButtonPressed
      ]} 
      onPress={handlePress}
    >
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function TextBackButton({ label, onPress }) {
  function handlePress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  }
  return (
    <Pressable 
      style={({ pressed }) => [
        styles.backButton,
        pressed && { opacity: 0.6 }
      ]} 
      onPress={handlePress}
      hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}
    >
      <Text style={styles.backButtonText}>{label}</Text>
    </Pressable>
  );
}

function ChecklistItem({ label }) {
  return (
    <View style={styles.checkItem}>
      <View style={styles.checkIconWrap}>
        <Text style={styles.checkIcon}>{"\u2713"}</Text>
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </View>
  );
}

function GhostSilhouette({ type }) {
  const isSide = type === "side";
  
  return (
    <View style={styles.ghostContainer}>
      <View style={styles.ghostHead} />
      <View style={styles.ghostTorso} />
      {isSide ? (
         <View style={styles.ghostVerticalLine} />
      ) : (
        <View style={styles.ghostShoulderLine} />
      )}
    </View>
  );
}

function CaptureCoachingTip({ tip }) {
  return (
    <View style={styles.coachingRow}>
      <Text style={styles.coachingDot}>{"\u2022"}</Text>
      <Text style={styles.coachingText}>{tip}</Text>
    </View>
  );
}

function CaptureCard({
  title,
  helper,
  asset,
  buttonLabel,
  badgeLabel,
  emptyLabel,
  readyLabel,
  removeLabel,
  coachingTips,
  onPress,
  onRemove,
  disabled,
  type,
}) {
  const completed = Boolean(asset?.uri);

  function handlePress() {
    if (disabled) return;
    Haptics.selectionAsync();
    onPress?.();
  }

  return (
    <View style={[styles.captureCard, completed && styles.captureCardCompleted]}>
      <View style={styles.captureHeader}>
        <View style={styles.captureCopy}>
          <Text style={styles.captureTitle}>{title}</Text>
          <Text style={styles.captureHelper}>{helper}</Text>
        </View>
        {completed ? (
          <View style={styles.captureBadge}>
            <Text style={styles.captureBadgeText}>{badgeLabel}</Text>
          </View>
        ) : null}
      </View>

      {!completed && coachingTips?.length ? (
        <View style={styles.coachingBlock}>
          {coachingTips.map((tip, index) => (
            <CaptureCoachingTip key={`${type}-tip-${index}`} tip={tip} />
          ))}
        </View>
      ) : null}

      {completed ? (
        <View style={[styles.capturePlaceholder, styles.capturePlaceholderCompleted]}>
          <Image source={{ uri: asset.uri }} style={styles.capturePreviewImage} />
          <View style={styles.capturePreviewOverlay}>
            <Text style={styles.capturePlaceholderText}>{readyLabel}</Text>
          </View>
        </View>
      ) : (
        <View style={styles.capturePlaceholder}>
          <GhostSilhouette type={type} />
          <View style={styles.placeholderLabelWrap}>
            <Text style={styles.capturePlaceholderIcon}>+</Text>
            <Text style={styles.capturePlaceholderText}>{emptyLabel}</Text>
          </View>
        </View>
      )}

      <View style={styles.captureActions}>
        <Pressable
          style={({ pressed }) => [
            styles.slotButton, 
            completed && styles.slotButtonCompleted,
            pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }
          ]}
          onPress={handlePress}
          disabled={disabled}
        >
          <Text style={[styles.slotButtonText, completed && styles.slotButtonTextCompleted]}>
            {buttonLabel}
          </Text>
        </Pressable>

        {completed ? (
          <Pressable 
            style={({ pressed }) => [
              styles.removeButton,
              pressed && { opacity: 0.5 }
            ]} 
            onPress={onRemove} 
            disabled={disabled}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.removeButtonText}>{removeLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function PickerSheet({
  visible,
  title,
  subtitle,
  cameraLabel,
  galleryLabel,
  cancelLabel,
  onCamera,
  onGallery,
  onClose,
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.sheetBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.sheetCard}>
          <View style={styles.sheetCopy}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <Text style={styles.sheetSubtitle}>{subtitle}</Text>
          </View>

          <View style={styles.sheetActions}>
            <Pressable 
              style={({ pressed }) => [
                styles.sheetPrimaryAction,
                pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }
              ]} 
              onPress={onCamera}
            >
              <Text style={styles.sheetPrimaryActionText}>{cameraLabel}</Text>
            </Pressable>

            <Pressable 
              style={({ pressed }) => [
                styles.sheetSecondaryAction,
                pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }
              ]} 
              onPress={onGallery}
            >
              <Text style={styles.sheetSecondaryActionText}>{galleryLabel}</Text>
            </Pressable>

            <Pressable 
              style={({ pressed }) => [
                styles.sheetCancelAction,
                pressed && { opacity: 0.5 }
              ]} 
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.sheetCancelActionText}>{cancelLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function AnalysisOverlay({ visible, title, subtitle }) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {}}
    >
      <View style={styles.analysisBackdrop}>
        <View style={styles.analysisCard}>
          <ActivityIndicator size="small" color="#295c41" />
          <View style={styles.analysisCopy}>
            <Text style={styles.analysisTitle}>{title}</Text>
            <Text style={styles.analysisSubtitle}>{subtitle}</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ResultFinding({ label }) {
  return (
    <View style={styles.findingRow}>
      <View style={styles.findingDot} />
      <Text style={styles.findingText}>{label}</Text>
    </View>
  );
}

function ExplanationItem({ title, description }) {
  return (
    <View style={styles.explanationRow}>
      <Text style={styles.explanationRowTitle}>{title}</Text>
      <Text style={styles.explanationRowText}>{description}</Text>
    </View>
  );
}

function PreviewCard({ title, uri, badges }) {
  return (
    <View style={styles.previewCard}>
      <View style={styles.previewFrame}>
        <Image 
          source={{ uri }} 
          style={styles.previewImage} 
          resizeMode="contain" 
        />
        <View style={styles.previewLabelBadge}>
          <Text style={styles.previewLabelBadgeText}>{title}</Text>
        </View>
      </View>

      <View style={styles.previewBadgeList}>
        {badges.map((badge) => (
          <View key={`${title}-${badge}`} style={styles.previewMetaBadge}>
            <Text style={styles.previewMetaBadgeText}>{badge}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function ShareFormatSelector({ visible, onSelect, onClose, t }) {
  const formats = [
    { id: "story", icon: "\uD83D\uDcf1", label: t("posture.share.variants.story") },
    { id: "card", icon: "\uD83D\uDcb3", label: t("posture.share.variants.card") },
    { id: "cover", icon: "\uD83D\uDcf9", label: t("posture.share.variants.cover") },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <View style={styles.selectorContent}>
          <Text style={styles.selectorTitle}>{t("posture.share.title")}</Text>
          <View style={styles.selectorGrid}>
            {formats.map((f) => (
              <Pressable 
                key={f.id} 
                style={({ pressed }) => [
                  styles.selectorItem,
                  pressed && { opacity: 0.7, transform: [{ scale: 0.96 }] }
                ]} 
                onPress={() => onSelect(f.id)}
              >
                <Text style={styles.selectorIcon}>{f.icon}</Text>
                <Text style={styles.selectorLabel}>{f.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

function ConfidenceNote({ title, body, hint }) {
  return (
    <View style={styles.confidenceNoteCard}>
      <Text style={styles.confidenceNoteTitle}>{title}</Text>
      <Text style={styles.confidenceNoteText}>{body}</Text>
      <Text style={styles.confidenceNoteHint}>{hint}</Text>
    </View>
  );
}

function CheckpointCard({ view }) {
  if (!view) {
    return null;
  }

  const trendGlyph = view.trend === "up"
    ? "\u2191"
    : view.trend === "down"
      ? "\u2193"
      : "\u2192";

  const isPositiveTrend = view.trend === "up";

  return (
    <View style={[styles.checkpointCard, isPositiveTrend && styles.checkpointCardHighlight]}>
      <View style={styles.checkpointHeader}>
        <Text style={styles.sectionLabel}>{view.title}</Text>
        <View style={styles.checkpointLevelBadge}>
          <Text style={styles.checkpointLevelText}>
            {view.levelLabelCaption}: {view.levelNumber}. {view.levelLabel}
          </Text>
        </View>
      </View>

      <View style={styles.checkpointHeadlineRow}>
        <Text style={styles.checkpointTrendGlyph}>{trendGlyph}</Text>
        <Text style={styles.checkpointHeadline}>{view.headline}</Text>
      </View>

      <Text style={styles.checkpointMessage}>{view.message}</Text>
    </View>
  );
}

function ProgressCard({ view, onHistoryPress }) {
  if (!view) return null;

  const trendGlyph = view.trend === "up"
    ? "\u2191"
    : view.trend === "down"
      ? "\u2193"
      : "\u2192";

  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionLabel}>{view.title}</Text>

      <View style={styles.progressMetrics}>
        {view.previousScoreText ? (
          <View style={styles.progressMetricCard}>
            <Text style={styles.progressMetricLabel}>{view.previousScoreLabel}</Text>
            <Text style={styles.progressMetricValue}>{view.previousScoreText}</Text>
          </View>
        ) : null}

        <View style={styles.progressMetricCard}>
          <Text style={styles.progressMetricLabel}>{view.currentScoreLabel}</Text>
          <Text style={styles.progressMetricValue}>{view.currentScoreText}</Text>
        </View>
      </View>

      <View style={styles.progressSummaryRow}>
        <View style={styles.progressTrendBadge}>
          <Text style={styles.progressTrendGlyph}>{trendGlyph}</Text>
          <Text style={styles.progressTrendText}>{view.diffText}</Text>
        </View>
        <Text style={styles.progressTrendLabel}>{view.trendLabel}</Text>
      </View>

      <Text style={styles.progressSummaryText}>{view.summaryText}</Text>

      <Pressable 
        style={({ pressed }) => [
          styles.historyLinkButton,
          pressed && { opacity: 0.5 }
        ]} 
        onPress={onHistoryPress}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={styles.historyLinkText}>{view.historyButtonLabel}</Text>
      </Pressable>
    </View>
  );
}

function TrustScorecard({ view }) {
  if (!view) return null;

  const levelColors = {
    high: { bg: "#e6f0e8", text: "#295c41" },
    medium: { bg: "#fff8e6", text: "#8a6633" },
    low: { bg: "#fff3f0", text: "#c67b7b" },
  };

  return (
    <View style={styles.trustCard}>
      <Text style={styles.sectionLabel}>{view.title}</Text>
      <View style={styles.trustSignals}>
        {view.signals.map((signal) => {
          const color = levelColors[signal.level] || levelColors.low;
          return (
            <View key={signal.key} style={styles.trustSignalRow}>
              <Text style={styles.trustSignalLabel}>{signal.label}</Text>
              <View style={[styles.trustSignalBadge, { backgroundColor: color.bg }]}>
                <Text style={[styles.trustSignalBadgeText, { color: color.text }]}>
                  {signal.level === "high" ? "\u2713" : signal.level === "medium" ? "\u25CB" : "\u25CB"}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function ProtocolCard({ title, desc, emoji, children }) {
  return (
    <View style={styles.protocolCard}>
      <View style={styles.protocolCardHeader}>
        <View style={styles.protocolEmojiBox}>
          <Text style={styles.protocolEmoji}>{emoji}</Text>
        </View>
        <View style={styles.protocolTitleBox}>
          <Text style={styles.protocolTitle}>{title}</Text>
          <Text style={styles.protocolDesc}>{desc}</Text>
        </View>
      </View>
      {children}
    </View>
  );
}

function ValidationChecklistItem({ label, checked, onPress }) {
  return (
    <Pressable 
      style={({ pressed }) => [
        styles.validationItem, 
        checked && styles.validationItemChecked,
        pressed && styles.validationItemPressed
      ]} 
      onPress={onPress}
    >
      <View style={[styles.validationCheckbox, checked && styles.validationCheckboxChecked]}>
        {checked && <Text style={styles.validationCheckIcon}>{"\u2713"}</Text>}
      </View>
      <Text style={[styles.validationItemLabel, checked && styles.validationItemLabelChecked]}>{label}</Text>
    </Pressable>
  );
}

function RepeatabilityGuidance({ view }) {
  if (!view) return null;

  return (
    <View style={styles.repeatabilityCard}>
      <Text style={styles.repeatabilityTitle}>{view.title}</Text>
      {view.tips.map((tip, index) => (
        <View key={`rg-${index}`} style={styles.repeatabilityRow}>
          <Text style={styles.repeatabilityDot}>{"\u2022"}</Text>
          <Text style={styles.repeatabilityText}>{tip}</Text>
        </View>
      ))}
    </View>
  );
}

function RecommendationCard({ card }) {
  return (
    <View style={styles.recommendationCard}>
      <View style={styles.recommendationCardHeader}>
        <Text style={styles.recommendationCardTitle}>{card.title}</Text>
        <Text style={styles.recommendationCardPurpose}>{card.purpose}</Text>
      </View>

      <View style={styles.recommendationCardItems}>
        {card.items.map((item) => (
          <View key={`${card.id}-${item.name}`} style={styles.recommendationItemRow}>
            <View style={styles.recommendationItemDot} />
            <View style={styles.recommendationItemCopy}>
              <Text style={styles.recommendationItemName}>{item.name}</Text>
              <Text style={styles.recommendationItemDose}>{item.dose}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function CoachingView({ coaching }) {
  if (!coaching) return null;

  return (
    <View style={styles.coachingCard}>
      <View style={styles.coachingHeader}>
        <Text style={styles.sectionLabel}>{coaching.title}</Text>
        {coaching.streakText && (
          <View style={styles.streakBadge}>
            <Text style={styles.streakText}>{coaching.streakText}</Text>
          </View>
        )}
      </View>
      
      {/* V2: Progress Bar */}
      {coaching.issueProgress !== undefined && (
        <View style={styles.coachingProgressContainer}>
          <View style={styles.coachingProgressTrack}>
            <View style={[styles.coachingProgressFill, { width: `${coaching.issueProgress}%` }]} />
          </View>
          <Text style={styles.coachingProgressLabel}>
            {coaching.issueProgress}% {coaching.issueStatusLabel || ""}
          </Text>
        </View>
      )}

      <View style={styles.directiveRow}>
        <View style={styles.directiveIcon}>
          <Text style={styles.directiveEmoji}>{"\u2728"}</Text>
        </View>
        <Text style={styles.directiveText}>{coaching.directive.command}</Text>
      </View>
      <Text style={styles.directiveFeedback}>{coaching.directive.feedback}</Text>
      
      {/* V2: Anticipation Hint */}
      {coaching.directive.hint && (
        <Text style={styles.coachingHint}>
          {coaching.directive.hint}
        </Text>
      )}
    </View>
  );
}

function resolveSpecificErrorMessage(t, result) {
  const diagnostics = result?.diagnostics ?? {};
  const frontDiag = diagnostics?.front ?? {};
  const sideDiag = diagnostics?.side ?? {};
  const alertReason = diagnostics?.alertReason ?? "unknown";

  // No landmarks at all — generic body detection failure
  if (diagnostics.noLandmarksDetected) {
    // Check for specific sub-reasons
    if (frontDiag.unusableReason === "side_like_orientation" || sideDiag.unusableReason === "front_like_orientation") {
      return t("posture.analyzing.wrongAspectRatio");
    }

    if ((frontDiag.averageConfidence ?? 0) < 0.15 && (sideDiag.averageConfidence ?? 0) < 0.15) {
      return t("posture.analyzing.contrastLow");
    }

    return t("posture.analyzing.noLandmarks");
  }

  // Side view specifically unusable — neck/ear not visible
  if (!sideDiag.usable && sideDiag.unusableReason === "missing_torso_signal") {
    return t("posture.analyzing.sideNeckNotVisible");
  }

  // Low confidence across the board
  if (result?.confidence === "low" && (result?.qualityScore ?? 0) < 25) {
    return t("posture.analyzing.landmarkConfidenceLow");
  }

  // Front has some landmarks but not enough
  if ((frontDiag.landmarkCount ?? 0) > 0 && (frontDiag.landmarkCount ?? 0) < 4) {
    return t("posture.analyzing.feetNotVisible");
  }

  return t("posture.analyzing.noLandmarks");
}

function HeuristicModeBanner({ t, visible }) {
  if (!visible) return null;

  return (
    <View style={styles.heuristicBanner}>
      <Text style={styles.heuristicBannerTitle}>
        {t("posture.analyzing.heuristicMode")}
      </Text>
      <Text style={styles.heuristicBannerHint}>
        {t("posture.analyzing.heuristicHint")}
      </Text>
    </View>
  );
}

export default function PostureScreen() {
  const navigation = useNavigation();
  const { t } = useLanguage();
  const { completeDay } = useApp();
  const [step, setStep] = useState("intro");
  const [captures, setCaptures] = useState(INITIAL_CAPTURES);
  const [pickerTarget, setPickerTarget] = useState(null);
  const [validationItems, setValidationItems] = useState({
    fullBody: false,
    background: false,
    visibility: false,
    clothing: false,
  });
  const shareRef = React.useRef(null);
  const [shareVariant, setShareVariant] = useState("card");
  const [showShareSelector, setShowShareSelector] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [historyContext, setHistoryContext] = useState({
    currentEntry: null,
    previousEntry: null,
  });

  const canAnalyze = Boolean(captures.front?.uri && captures.side?.uri);

  const [fullHistory, setFullHistory] = useState([]);
  React.useEffect(() => {
    getPostureHistory().then(entries => setFullHistory(entries || [])).catch(() => {});
  }, [step]);

  const productOutput = useMemo(() => {
    if (!analysisResult) return null;
    const memoryHistory = [...fullHistory, analysisResult].sort((a,b) => new Date(b.date || Date.now()) - new Date(a.date || Date.now()));
    const profileState = buildPostureProfileState(memoryHistory);
    const knowledgeOutput = buildPostureKnowledgeOutput(analysisResult, profileState);
    return buildPostureProductOutput(knowledgeOutput, analysisResult);
  }, [analysisResult, fullHistory]);
  const resultView = useMemo(
    () => buildPostureResultViewModel(t, analysisResult, captures, historyContext),
    [analysisResult, captures, historyContext, t],
  );

  const pickerTargetTitle = pickerTarget === "side"
    ? t("posture.capture.sideTitle")
    : t("posture.capture.frontTitle");

  function normalizePickedAsset(asset, source) {
    if (!asset?.uri) {
      return asset ?? null;
    }

    return {
      ...asset,
      source,
      capturedAt: asset?.capturedAt ?? new Date().toISOString(),
      aspectRatio:
        Number.isFinite(Number(asset?.width)) &&
        Number.isFinite(Number(asset?.height)) &&
        Number(asset.height) > 0
          ? Number(asset.width) / Number(asset.height)
          : null,
    };
  }

  function updateCapture(slot, asset) {
    setCaptures((current) => ({
      ...current,
      [slot]: asset,
    }));
    setAnalysisResult(null);
  }

  function removeCapture(slot) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    updateCapture(slot, null);
  }

  function openPicker(slot) {
    setPickerTarget(slot);
  }

  function closePicker() {
    setPickerTarget(null);
  }

  function showPermissionAlert(kind) {
    const title = kind === "camera"
      ? t("posture.capture.permissions.cameraTitle")
      : t("posture.capture.permissions.galleryTitle");
    const message = kind === "camera"
      ? t("posture.capture.permissions.cameraMessage")
      : t("posture.capture.permissions.galleryMessage");

    Alert.alert(title, message, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.settings"),
        onPress: () => Linking.openSettings().catch(() => {}),
      },
    ]);
  }

  async function ensurePermission(kind) {
    const response = kind === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (response.status !== "granted") {
      showPermissionAlert(kind);
      return false;
    }

    return true;
  }

  async function handleLaunchCamera() {
    const target = pickerTarget;
    if (!target) return;

    const hasPermission = await ensurePermission("camera");
    if (!hasPermission) {
      closePicker();
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.7,
      });

      closePicker();

      if (result.canceled || !result.assets?.length) return;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      updateCapture(target, normalizePickedAsset(result.assets[0], "camera"));
    } catch (_) {
      closePicker();
      Alert.alert(
        t("common.error"),
        t("posture.capture.errors.cameraOpen"),
      );
    }
  }

  async function handleLaunchGallery() {
    const target = pickerTarget;
    if (!target) return;

    const hasPermission = await ensurePermission("gallery");
    if (!hasPermission) {
      closePicker();
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.7,
      });

      closePicker();

      if (result.canceled || !result.assets?.length) return;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      updateCapture(target, normalizePickedAsset(result.assets[0], "gallery"));
    } catch (_) {
      closePicker();
      Alert.alert(
        t("common.error"),
        t("posture.capture.errors.galleryOpen"),
      );
    }
  }

  async function handleShare() {
    const consistency = historyContext.currentEntry?.consistency;
    const consistencyLevel = consistency?.consistencyLevel ?? (consistency?.isConsistent === false ? "low" : "high");

    if (consistencyLevel === "low") {
      Alert.alert(
        t("posture.result.accuracy.consistency.label"),
        t("posture.result.accuracy.consistency.hints.low"),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("posture.result.shareProgress"),
            onPress: () => setShowShareSelector(true),
          },
        ],
      );
      return;
    }

    setShowShareSelector(true);
  }

  async function performShare(variant) {
    setShowShareSelector(false);
    setShareVariant(variant);
    
    // Tiny delay to allow variant render
    setTimeout(async () => {
      if (!shareRef.current) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      await captureAndSharePosture(shareRef.current, t);
    }, 100);
  }

  async function handleAnalyze() {
    if (!canAnalyze || analyzing) return;

    closePicker();
    setAnalyzing(true);

    try {
      await wait(ANALYSIS_DELAY_MS);

      // Load previous entry so consistency (scale/angle drift) check is meaningful
      let previousEntryForConsistency = null;
      try {
        const existingHistory = await getPostureHistory();
        previousEntryForConsistency = existingHistory[0] ?? null;
      } catch (_) {}

      const result = await runPostureAnalysis({
        frontImage: captures.front,
        sideImage: captures.side,
        backImage: captures.back,
        previousEntry: previousEntryForConsistency,
        validationItems,
      });
      const fallbackEntry = {
        id: `local-${Date.now()}`,
        date: Date.now(),
        score: Number.isFinite(Number(result?.score)) ? Number(result.score) : null,
        findings: result?.findings ?? {},
        confidence: result?.confidence ?? "low",
        frontImageUri: captures.front?.uri ?? "",
        sideImageUri: captures.side?.uri ?? "",
        backImageUri: captures.back?.uri ?? "",
        summary: Array.isArray(result?.summary) ? result.summary : [],
        recommendation: result?.recommendation ?? "retake_guidance",
      };

      try {
        if (result?.persistable) {
          const saved = await savePostureHistoryEntry({
            analysisResult: result,
            captures,
          });

          setHistoryContext({
            currentEntry: saved.savedEntry,
            previousEntry: saved.previousEntry,
          });
        } else {
          setHistoryContext({ currentEntry: null, previousEntry: null });
        }
      } catch (_) {
        if (result?.persistable) {
          setHistoryContext({
            currentEntry: fallbackEntry,
            previousEntry: null,
          });
        } else {
          setHistoryContext({ currentEntry: null, previousEntry: null });
        }
      }

      try {
        const completedScanTask = result?.persistable
          ? await completeActivePostureScanTask()
          : null;
        if (completedScanTask?.countsTowardConsistency) {
          await completeDay();
        }
      } catch (_) {
      }

      setAnalysisResult(result);

      const noLandmarksDetected = Boolean(result?.diagnostics?.noLandmarksDetected);
      const shouldShowResult = result?.status === "ready" || result?.status === "degraded";
      const shouldShowAlert = result?.status === "fail";

      console.log("[POSTURE_FIX_DEBUG] STEP 3 Final decision", {
        angle: "ui",
        finalStatus: result?.status ?? "unknown",
        ready: result?.status === "ready",
        degraded: result?.status === "degraded",
        fail: result?.status === "fail",
        limitedButUsable: Boolean(result?.diagnostics?.limitedButUsable),
        noLandmarksDetected,
        confidence: result?.confidence ?? "low",
        score: result?.score ?? null,
        whyAlertIsTriggered: result?.diagnostics?.alertReason ?? "unknown",
        alertTriggered: shouldShowAlert,
        heuristicMode: result?.uiMeta?.heuristicMode ?? false,
      });

      if (shouldShowResult) {
        setStep("result");
        if (
          result?.persistable &&
          Number.isFinite(Number(result?.score)) &&
          Number(result.score) > Number(historyContext.previousEntry?.score ?? 0)
        ) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          setTimeout(() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          }, 150);
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
      } else if (shouldShowAlert) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        const specificMessage = resolveSpecificErrorMessage(t, result);
        Alert.alert(
          t("common.error"),
          specificMessage,
          [{ text: t("common.retry"), onPress: restartAnalysis }, { text: t("common.ok") }]
        );
      } else {
        setStep("result");
      }
    } catch (_) {
      Alert.alert(
        t("common.error"),
        t("posture.analyzing.error"),
      );
    } finally {
      setAnalyzing(false);
    }
  }

  function resetToIntro() {
    setCaptures(INITIAL_CAPTURES);
    setAnalysisResult(null);
    setHistoryContext({ currentEntry: null, previousEntry: null });
    setAnalyzing(false);
    closePicker();
    setStep("intro");
  }

  function restartAnalysis() {
    setCaptures(INITIAL_CAPTURES);
    setAnalysisResult(null);
    setHistoryContext({ currentEntry: null, previousEntry: null });
    setAnalyzing(false);
    closePicker();
    setStep("capture");
  }

  if (step === "intro") {
    return (
      <FlowScaffold
        step={step}
        title={t("posture.intro.title")}
        subtitle={t("posture.intro.subtitle")}
        footer={
          <>
            <PrimaryButton
              label={t("posture.intro.primary")}
              onPress={() => setStep("instructions")}
            />
            {!historyContext.currentEntry && (
              <SecondaryButton
                label={t("posture.history.link")}
                onPress={() => navigation.navigate("PostureHistory")}
              />
            )}
          </>
        }
      >
        <View style={styles.introIllustration}>
          <View style={styles.introCircle}>
             <PostureIllustration />
          </View>
        </View>
      </FlowScaffold>
    );
  }

  if (step === "instructions") {
    return (
      <FlowScaffold
        step={step}
        title={t("posture.instructions.title")}
        footer={
          <>
            <PrimaryButton
              label={t("posture.instructions.primary")}
              onPress={() => setStep("capture")}
            />
            <TextBackButton label={t("common.back")} onPress={() => setStep("intro")} />
          </>
        }
      >
        <View style={styles.protocolContainer}>
          <ProtocolCard 
            title={t("posture.protocol.hair_title")} 
            desc={t("posture.protocol.hair_desc")} 
            emoji={"\u2702\ufe0f"}
          />
          <ProtocolCard 
            title={t("posture.protocol.outfit_title")} 
            desc={t("posture.protocol.outfit_desc")} 
            emoji={"\u1f455"}
          />
          <ProtocolCard 
            title={t("posture.protocol.env_title")} 
            desc={t("posture.protocol.env_desc")} 
            emoji={"\u1f4a1"}
          />
          <ProtocolCard 
            title={t("posture.protocol.camera_title")} 
            desc={t("posture.protocol.camera_desc")} 
            emoji={"\u1f4f1"}
          />
        </View>
      </FlowScaffold>
    );
  }

  if (step === "validation") {
    const allChecked = Object.values(validationItems).every(Boolean);
    
    return (
      <FlowScaffold
        step={step}
        title={t("posture.validation.title")}
        subtitle={t("posture.validation.subtitle")}
        footer={
          <>
            <PrimaryButton
              label={t("posture.validation.confirm")}
              onPress={handleAnalyze}
              disabled={!allChecked || analyzing}
            />
            <Pressable 
              style={({ pressed }) => [
                styles.retakeButton,
                pressed && styles.retakeButtonPressed
              ]} 
              onPress={() => setStep("capture")}
              disabled={analyzing}
            >
              <Text style={styles.retakeButtonText}>{t("posture.validation.retake")}</Text>
            </Pressable>
          </>
        }
      >
        <View style={styles.validationGrid}>
          <View style={styles.previewChecklistRow}>
            <View style={styles.miniPreviewCard}>
              <Image source={{ uri: captures.front?.uri }} style={styles.miniPreviewImage} resizeMode="cover" />
              <View style={styles.miniPreviewLabel}><Text style={styles.miniPreviewLabelText}>{t("posture.angles.front")}</Text></View>
            </View>
            <View style={styles.miniPreviewCard}>
              <Image source={{ uri: captures.side?.uri }} style={styles.miniPreviewImage} resizeMode="cover" />
              <View style={styles.miniPreviewLabel}><Text style={styles.miniPreviewLabelText}>{t("posture.angles.side")}</Text></View>
            </View>
            {captures.back?.uri && (
              <View style={styles.miniPreviewCard}>
                <Image source={{ uri: captures.back?.uri }} style={styles.miniPreviewImage} resizeMode="cover" />
                <View style={styles.miniPreviewLabel}><Text style={styles.miniPreviewLabelText}>{t("posture.angles.back")}</Text></View>
              </View>
            )}
          </View>

          <View style={styles.validationList}>
            <ValidationChecklistItem 
              label={t("posture.validation.item_full_body")} 
              checked={validationItems.fullBody}
              onPress={() => setValidationItems(v => ({...v, fullBody: !v.fullBody}))}
            />
            <ValidationChecklistItem 
              label={t("posture.validation.item_background")} 
              checked={validationItems.background}
              onPress={() => setValidationItems(v => ({...v, background: !v.background}))}
            />
            <ValidationChecklistItem 
              label={t("posture.validation.item_visibility")} 
              checked={validationItems.visibility}
              onPress={() => setValidationItems(v => ({...v, visibility: !v.visibility}))}
            />
            <ValidationChecklistItem 
              label={t("posture.validation.item_clothing")} 
              checked={validationItems.clothing}
              onPress={() => setValidationItems(v => ({...v, clothing: !v.clothing}))}
            />
          </View>
        </View>
      </FlowScaffold>
    );
  }

  if (step === "capture") {
    return (
      <>
        <FlowScaffold
          step={step}
          title={t("posture.capture.title")}
          subtitle={t("posture.capture.subtitle")}
          footer={
            <>
              <PrimaryButton
                label={t("posture.capture.primary")}
                onPress={() => setStep("validation")}
                disabled={!canAnalyze || analyzing}
              />
              <TextBackButton label={t("common.back")} onPress={() => setStep("instructions")} />
            </>
          }
        >
          <View style={styles.captureStack}>
            <CaptureCard
              title={t("posture.capture.frontTitle")}
              helper={t("posture.capture.frontHelper")}
              asset={captures.front}
              buttonLabel={t(captures.front ? "posture.capture.replace" : "posture.capture.add")}
              badgeLabel={t("posture.capture.badge")}
              emptyLabel={t("posture.capture.placeholderEmpty")}
              readyLabel={t("posture.capture.placeholderReady")}
              removeLabel={t("posture.capture.remove")}
              coachingTips={[
                t("posture.capture.coaching.frontDistance"),
                t("posture.capture.coaching.frontStance"),
              ]}
              onPress={() => openPicker("front")}
              onRemove={() => removeCapture("front")}
              disabled={Boolean(pickerTarget) || analyzing}
              type="front"
            />

            <CaptureCard
              title={t("posture.capture.sideTitle")}
              helper={t("posture.capture.sideHelper")}
              asset={captures.side}
              buttonLabel={t(captures.side ? "posture.capture.replace" : "posture.capture.add")}
              badgeLabel={t("posture.capture.badge")}
              emptyLabel={t("posture.capture.placeholderEmpty")}
              readyLabel={t("posture.capture.placeholderReady")}
              removeLabel={t("posture.capture.remove")}
              coachingTips={[
                t("posture.capture.coaching.sideProfile"),
                t("posture.capture.coaching.sideArms"),
              ]}
              onPress={() => openPicker("side")}
              onRemove={() => removeCapture("side")}
              disabled={Boolean(pickerTarget) || analyzing}
              type="side"
            />

            <CaptureCard
              title={t("posture.capture.backTitle")}
              helper={t("posture.capture.backHelper")}
              asset={captures.back}
              buttonLabel={t(captures.back ? "posture.capture.replace" : "posture.capture.add")}
              badgeLabel={t("posture.capture.badge")}
              emptyLabel={t("posture.capture.placeholderEmpty")}
              readyLabel={t("posture.capture.placeholderReady")}
              removeLabel={t("posture.capture.remove")}
              coachingTips={[
                t("posture.capture.coaching.backDistance"),
              ]}
              onPress={() => openPicker("back")}
              onRemove={() => removeCapture("back")}
              disabled={Boolean(pickerTarget) || analyzing}
              type="back"
            />
          </View>
        </FlowScaffold>

        <PickerSheet
          visible={Boolean(pickerTarget) && !analyzing}
          title={t("posture.capture.chooserTitle", { target: pickerTargetTitle })}
          subtitle={t("posture.capture.chooserSubtitle")}
          cameraLabel={t("posture.capture.camera")}
          galleryLabel={t("posture.capture.gallery")}
          cancelLabel={t("posture.capture.cancel")}
          onCamera={handleLaunchCamera}
          onGallery={handleLaunchGallery}
          onClose={closePicker}
        />

        <AnalysisOverlay
          visible={analyzing}
          title={t("posture.analyzing.title")}
          subtitle={t("posture.analyzing.subtitle")}
        />
      </>
    );
  }

  return (
    <FlowScaffold
      step={step}
      title={t("posture.result.title")}
      footer={
        <>
          <PrimaryButton label={t("posture.result.primary")} onPress={restartAnalysis} />
          <SecondaryButton label={t("posture.result.secondary")} onPress={resetToIntro} />
        </>
      }
    >
      <View style={styles.resultStack}>
        {productOutput ? (
          <>
            {/* HEURISTIC MODE BANNER */}
            <HeuristicModeBanner
              t={t}
              visible={analysisResult?.uiMeta?.heuristicMode === true}
            />

            {/* 1. HERO BLOCK */}
            <View style={styles.productHeroBlock}>
              <Text style={styles.productHeroTitle}>{productOutput.hero.title}</Text>
              <Text style={styles.productHeroSubtitle}>{productOutput.hero.subtitle}</Text>
            </View>
            
            {/* 2. ACTION BLOCK */}
            <View style={styles.productActionBlock}>
              <Text style={styles.productActionMain}>{productOutput.action.primaryAction}</Text>
              <Text style={styles.productActionSecondary}>{productOutput.action.secondaryAction}</Text>
            </View>
            
            {/* 3. STATUS BLOCK */}
            {productOutput.heuristicMode ? (
              <View style={styles.productStatusRow}>
                <View style={[styles.productStatusBadge, styles.productStatusBadgeHeuristic]}>
                  <Text style={styles.productStatusBadgeText}>{productOutput.status.confidenceLabel}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.productStatusRow}>
                <View style={styles.productStatusBadge}>
                  <Text style={styles.productStatusBadgeText}>{productOutput.status.confidenceLabel}</Text>
                </View>
                {productOutput.status.scoreAvailable ? (
                  <Text style={styles.productStatusValueLabel}>Skor: {productOutput.status.score}</Text>
                ) : null}
              </View>
            )}
            
            {/* 4. EXPLAINABILITY BLOCK */}
            {productOutput.explainability.text ? (
              <View style={styles.productExplainBlock}>
                <Text style={styles.productExplainText}>{productOutput.explainability.text}</Text>
              </View>
            ) : null}
            
            {/* 5. TREND BLOCK */}
            {productOutput.trend.message ? (
              <View style={styles.productTrendBlock}>
                <Text style={styles.productTrendIcon}>{"\u2197"}</Text>
                <Text style={styles.productTrendText}>{productOutput.trend.message}</Text>
              </View>
            ) : null}
            
            {/* 6. HABIT BLOCK */}
            <View style={styles.productHabitBlock}>
              <Text style={styles.productHabitStreak}>{productOutput.habit.streakMessage}</Text>
              {productOutput.habit.urgencyMessage ? (
                <Text style={styles.productHabitUrgency}>{productOutput.habit.urgencyMessage}</Text>
              ) : null}
            </View>

            {/* 7. DEBUG OVERLAY BLOCK */}
            {(productOutput.debug?.frontImageUri || productOutput.debug?.sideImageUri) ? (
              <View style={styles.productDebugBlock}>
                <Text style={styles.productDebugTitle}>Debug Skeleton Overlay</Text>
                <View style={styles.productDebugGrid}>
                  {productOutput.debug?.frontImageUri ? (
                    <Image source={{ uri: productOutput.debug.frontImageUri }} style={styles.productDebugImage} resizeMode="contain" />
                  ) : null}
                  {productOutput.debug?.sideImageUri ? (
                    <Image source={{ uri: productOutput.debug.sideImageUri }} style={styles.productDebugImage} resizeMode="contain" />
                  ) : null}
                </View>
              </View>
            ) : null}
          </>
        ) : (
        <>
        <View style={styles.scoreCard}>
          <Text style={styles.scoreLabel}>{t("posture.result.scoreLabel")}</Text>
          <Text style={styles.scoreValue}>
            {resultView.scoreText}
            {resultView.hasScore && resultView.score >= 60 ? (
              <Text style={styles.scoreCheckmark}> {"\u2713"}</Text>
            ) : null}
          </Text>
          <View style={styles.confidenceBadge}>
            <Text style={styles.confidenceBadgeText}>
              {t("posture.result.confidenceLabel")}: {resultView.confidenceLabel}
            </Text>
          </View>
          {resultView.analysisMode === "heuristic" ? (
            <View style={[styles.confidenceBadge, styles.heuristicBadge]}>
              <Text style={[styles.confidenceBadgeText, styles.heuristicBadgeText]}>
                {resultView.analysisModeLabel}
              </Text>
            </View>
          ) : null}
        </View>

        {resultView.accuracyView ? (
          <View style={styles.accuracyCard}>
            <View style={styles.accuracyRow}>
              <Text style={styles.accuracyLabel}>{resultView.accuracyView.label}</Text>
              <View style={styles.accuracyLevelBadge}>
                <Text style={styles.accuracyLevelText}>{resultView.accuracyView.levelLabel}</Text>
              </View>
            </View>
            {resultView.accuracyView.showHint ? (
              <Text style={styles.accuracyHint}>{resultView.accuracyView.hint}</Text>
            ) : null}
            {resultView.accuracyView.consistencyLabel ? (
              <View style={styles.accuracyRow}>
                <Text style={styles.accuracyLabel}>{resultView.accuracyView.consistencyLabel}</Text>
                <View style={[
                  styles.accuracyLevelBadge,
                  resultView.accuracyView.consistencyLevel === "low" && styles.accuracyLevelBadgeWarn,
                  resultView.accuracyView.consistencyLevel === "medium" && styles.accuracyLevelBadgeCaution,
                ]}>
                  <Text style={[
                    styles.accuracyLevelText,
                    resultView.accuracyView.consistencyLevel === "low" && styles.accuracyLevelTextWarn,
                    resultView.accuracyView.consistencyLevel === "medium" && styles.accuracyLevelTextCaution,
                  ]}>
                    {resultView.accuracyView.consistencyLevelLabel}
                  </Text>
                </View>
              </View>
            ) : null}
            {resultView.accuracyView.consistencyHint ? (
              <Text style={styles.accuracyHint}>{resultView.accuracyView.consistencyHint}</Text>
            ) : null}
          </View>
        ) : null}

        <TrustScorecard view={resultView.trustScorecard} />

        <CheckpointCard view={resultView.checkpoint} />

        <CoachingView coaching={resultView.coaching} />

        <ProgressCard
          view={resultView.progress}
          onHistoryPress={() => navigation.navigate("PostureHistory")}
        />

        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>{t("posture.result.findingsTitle")}</Text>
          <View style={styles.findingsList}>
            {resultView.findings.map((finding) => (
              <ResultFinding key={finding} label={finding} />
            ))}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>{resultView.explanationTitle}</Text>

          {resultView.previewCards.length ? (
            <View style={styles.previewGrid}>
              {resultView.previewCards.map((previewCard) => (
                <PreviewCard
                  key={previewCard.key}
                  title={previewCard.title}
                  uri={previewCard.uri}
                  badges={previewCard.badges}
                />
              ))}
            </View>
          ) : null}

          <View style={styles.explanationList}>
            {resultView.explanationItems.map((item) => (
              <ExplanationItem
                key={item.key}
                title={item.title}
                description={item.description}
              />
            ))}
          </View>
        </View>

        {resultView.lowConfidenceNote ? (
          <ConfidenceNote
            title={resultView.lowConfidenceNote.title}
            body={resultView.lowConfidenceNote.body}
            hint={resultView.lowConfidenceNote.hint}
          />
        ) : null}

        <ProgressCard
          view={resultView.progress}
          onHistoryPress={() => navigation.navigate("PostureHistory")}
        />

        <RepeatabilityGuidance view={resultView.repeatabilityGuidance} />

        {!resultView.hasScore && (
          <Pressable 
            style={({ pressed }) => [
              styles.retakeButton,
              pressed && { opacity: 0.7 }
            ]} 
            onPress={restartAnalysis}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.retakeButtonText}>{t("posture.trust.retake")}</Text>
          </Pressable>
        )}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>{resultView.recommendationsTitle}</Text>

          <View style={styles.recommendationCardList}>
            {resultView.recommendationCards.map((card) => (
              <RecommendationCard key={card.id} card={card} />
            ))}
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.historyLinkButton,
              pressed && { opacity: 0.5 }
            ]}
            onPress={() => navigation.navigate("PostureRecommendations", { analysisResult })}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.historyLinkText}>{resultView.recommendationsButtonLabel}</Text>
          </Pressable>
        </View>
        </>
        )}

        {/* Hidden Share Visual Generator */}
        <View style={styles.hiddenShareContainer} pointerEvents="none">
          {shareVariant === "story" && (
            <StoryVariant ref={shareRef} view={resultView} previous={historyContext.previousEntry} t={t} />
          )}
          {shareVariant === "card" && (
            <SocialProofVariant ref={shareRef} view={resultView} previous={historyContext.previousEntry} t={t} />
          )}
          {shareVariant === "cover" && (
            <ReelsCoverVariant ref={shareRef} view={resultView} previous={historyContext.previousEntry} t={t} />
          )}
        </View>

        <ShareFormatSelector 
          visible={showShareSelector}
          onSelect={performShare}
          onClose={() => setShowShareSelector(false)}
          t={t}
        />
      </View>
    </FlowScaffold>
  );
}

const styles = StyleSheet.create({
  heuristicBanner: {
    backgroundColor: "#fef3cd",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#f0d060",
  },
  heuristicBannerTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#856404",
    marginBottom: 4,
  },
  heuristicBannerHint: {
    fontSize: 12,
    color: "#856404",
    lineHeight: 17,
  },
  safe: {
    flex: 1,
    backgroundColor: "#eef4e8",
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingVertical: 24,
    justifyContent: "center",
    gap: 18,
  },
  stepIndicator: {
    flexDirection: "row",
    alignSelf: "center",
    gap: 8,
  },
  stepDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: "#d4e2d4",
  },
  stepDotCompleted: {
    backgroundColor: "#7fa88a",
  },
  stepDotActive: {
    width: 28,
    backgroundColor: "#295c41",
  },
  heroCard: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    backgroundColor: "#ffffff",
    borderRadius: 28,
    paddingHorizontal: 28,
    paddingVertical: 32,
    gap: 24,
    shadowColor: "#295c41",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  introIllustration: {
    paddingVertical: 40,
    alignItems: "center",
    gap: 16,
  },
  placeholderLabelWrap: {
    alignItems: "center",
    position: "absolute",
    bottom: 24,
  },
  ghostContainer: {
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.15,
  },
  ghostHead: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#295c41",
    marginBottom: 4,
  },
  ghostTorso: {
    width: 32,
    height: 48,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#295c41",
  },
  ghostShoulderLine: {
    position: "absolute",
    top: 28,
    width: 60,
    height: 1.5,
    backgroundColor: "#295c41",
    opacity: 0.5,
  },
  ghostVerticalLine: {
    position: "absolute",
    top: 10,
    width: 1.5,
    height: 70,
    backgroundColor: "#295c41",
    opacity: 0.5,
  },
  introCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "#f4faf5",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#d8e9dc",
    shadowColor: "#295c41",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  introEmoji: {
    fontSize: 40,
  },
  introTag: {
    backgroundColor: "#295c41",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },
  introTagText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },
  copyBlock: {
    gap: 10,
  },
  body: {
    gap: 18,
  },
  footer: {
    gap: 12,
  },
  title: {
    fontSize: 30,
    fontWeight: "900",
    color: "#14301f",
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "700",
    color: "#7fa88a",
  },
  checklist: {
    gap: 14,
  },
  checkItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#f7fbf7",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: "#d8e9dc",
  },
  checkIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#295c41",
  },
  checkIcon: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
  checkLabel: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "800",
    color: "#14301f",
  },
  captureStack: {
    gap: 16,
  },
  captureCard: {
    backgroundColor: "#f7fbf7",
    borderRadius: 22,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: "#d8e9dc",
  },
  captureCardCompleted: {
    backgroundColor: "#f2f8f3",
    borderColor: "#b8d0bc",
  },
  captureHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  captureCopy: {
    flex: 1,
    gap: 6,
  },
  captureTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#14301f",
  },
  captureHelper: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    color: "#7fa88a",
  },
  captureBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#295c41",
  },
  captureBadgeText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  capturePlaceholder: {
    minHeight: 126,
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#c8d7ca",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 20,
  },
  capturePlaceholderCompleted: {
    borderStyle: "solid",
    borderColor: "#b8d0bc",
    backgroundColor: "#eef6ef",
    overflow: "hidden",
  },
  capturePlaceholderIcon: {
    fontSize: 28,
    lineHeight: 30,
    fontWeight: "400",
    color: "#295c41",
  },
  capturePlaceholderText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
    color: "#4a6654",
    textAlign: "center",
  },
  capturePreviewImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
    resizeMode: "contain",
  },
  capturePreviewOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "rgba(20, 48, 31, 0.55)",
  },
  captureActions: {
    gap: 10,
  },
  slotButton: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: "#295c41",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  slotButtonCompleted: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#b8d0bc",
  },
  slotButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
  },
  slotButtonTextCompleted: {
    color: "#295c41",
  },
  removeButton: {
    alignSelf: "center",
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  removeButtonText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#8b2020",
    letterSpacing: 0.2,
  },
  sheetBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.24)",
    padding: 18,
  },
  sheetCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 8,
  },
  sheetCopy: {
    gap: 6,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#14301f",
    letterSpacing: -0.3,
  },
  sheetSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    color: "#7fa88a",
  },
  sheetActions: {
    gap: 10,
  },
  sheetPrimaryAction: {
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: "#295c41",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  sheetPrimaryActionText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },
  sheetSecondaryAction: {
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: "#f4faf5",
    borderWidth: 1,
    borderColor: "#d8e9dc",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  sheetSecondaryActionText: {
    color: "#295c41",
    fontSize: 16,
    fontWeight: "900",
  },
  sheetCancelAction: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetCancelActionText: {
    color: "#7fa88a",
    fontSize: 14,
    fontWeight: "900",
  },
  analysisBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(20, 48, 31, 0.12)",
    padding: 24,
  },
  analysisCard: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingVertical: 24,
    alignItems: "center",
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 6,
  },
  analysisCopy: {
    alignItems: "center",
    gap: 6,
  },
  analysisTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#14301f",
    textAlign: "center",
  },
  analysisSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    color: "#7fa88a",
    textAlign: "center",
  },
  resultStack: {
    gap: 16,
  },
  scoreCard: {
    backgroundColor: "#f4faf5",
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 22,
    gap: 8,
    borderWidth: 1,
    borderColor: "#d8e9dc",
  },
  scoreLabel: {
    fontSize: 12,
    fontWeight: "900",
    color: "#7fa88a",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  scoreValue: {
    fontSize: 34,
    fontWeight: "900",
    color: "#14301f",
    letterSpacing: -0.6,
  },
  scoreCheckmark: {
    fontSize: 22,
    color: "#295c41",
    fontWeight: "900",
  },
  confidenceBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d8e9dc",
  },
  confidenceBadgeText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#4a6654",
    letterSpacing: 0.5,
  },
  heuristicBadge: {
    backgroundColor: "#e0f2fe",
    borderColor: "#bae6fd",
    marginTop: 6,
  },
  heuristicBadgeText: {
    color: "#0369a1",
  },
  accuracyCard: {
    backgroundColor: "#f9fbf9",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: "#e1ebe2",
  },
  accuracyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  accuracyLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#4a6654",
  },
  accuracyLevelBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#e6f0e8",
  },
  accuracyLevelBadgeWarn: {
    backgroundColor: "#fff3f0",
  },
  accuracyLevelBadgeCaution: {
    backgroundColor: "#fff8e6",
  },
  accuracyLevelText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#295c41",
    letterSpacing: 0.5,
  },
  accuracyLevelTextWarn: {
    color: "#c67b7b",
  },
  accuracyLevelTextCaution: {
    color: "#8a6633",
  },
  accuracyHint: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9ab09e",
    lineHeight: 17,
  },
  checkpointCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: "#d8e9dc",
    shadowColor: "#295c41",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  checkpointCardHighlight: {
    backgroundColor: "#f4faf5",
    borderColor: "#b8d0bc",
  },
  checkpointHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  },
  checkpointLevelBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#f7fbf7",
    borderWidth: 1,
    borderColor: "#d8e9dc",
  },
  checkpointLevelText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#295c41",
    letterSpacing: 0.4,
  },
  checkpointHeadlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  checkpointTrendGlyph: {
    fontSize: 16,
    fontWeight: "900",
    color: "#295c41",
  },
  checkpointHeadline: {
    flex: 1,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "900",
    color: "#14301f",
    letterSpacing: -0.3,
  },
  checkpointMessage: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "700",
    color: "#4a6654",
  },
  sectionCard: {
    backgroundColor: "#f7fbf7",
    borderRadius: 20,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: "#d8e9dc",
  },
  protocolContainer: {
    gap: 16,
    paddingTop: 10,
  },
  protocolCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e1ebe2",
    gap: 12,
  },
  protocolCardHeader: {
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
  },
  protocolEmojiBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#f4faf5",
    alignItems: "center",
    justifyContent: "center",
  },
  protocolEmoji: {
    fontSize: 22,
  },
  protocolTitleBox: {
    flex: 1,
    gap: 2,
  },
  protocolTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#14301f",
  },
  protocolDesc: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    color: "#4a6654",
  },
  validationGrid: {
    gap: 24,
  },
  previewChecklistRow: {
    flexDirection: "row",
    gap: 10,
  },
  miniPreviewCard: {
    flex: 1,
    aspectRatio: 3/4,
    borderRadius: 14,
    backgroundColor: "#edf5ee",
    borderWidth: 1,
    borderColor: "#d8e9dc",
    overflow: "hidden",
  },
  miniPreviewImage: {
    width: "100%",
    height: "100%",
  },
  miniPreviewLabel: {
    position: "absolute",
    bottom: 6,
    left: 6,
    right: 6,
    backgroundColor: "rgba(20, 48, 31, 0.6)",
    paddingVertical: 4,
    borderRadius: 6,
    alignItems: "center",
  },
  miniPreviewLabelText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "900",
  },
  validationList: {
    gap: 12,
  },
  validationItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
    borderWidth: 1.5,
    borderColor: "#e1ebe2",
  },
  validationItemChecked: {
    borderColor: "#295c41",
    backgroundColor: "#f4faf5",
  },
  validationCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#b8c8ba",
    alignItems: "center",
    justifyContent: "center",
  },
  validationCheckboxChecked: {
    backgroundColor: "#295c41",
    borderColor: "#295c41",
  },
  validationCheckIcon: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
  validationItemLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: "#4a6654",
  },
  validationItemLabelChecked: {
    color: "#14301f",
    fontWeight: "800",
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "900",
    color: "#7fa88a",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  findingsList: {
    gap: 12,
  },
  findingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  findingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#295c41",
  },
  illustrationMain: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  illuHead: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#295c41",
    marginBottom: 4,
  },
  illuShoulders: {
    width: 60,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#295c41",
    opacity: 0.8,
  },
  illuTorso: {
    width: 40,
    height: 50,
    backgroundColor: "#295c41",
    opacity: 0.6,
    marginTop: 2,
    borderRadius: 4,
    alignItems: "center",
  },
  illuSpine: {
    width: 2,
    height: "100%",
    backgroundColor: "#ffffff",
    opacity: 0.4,
  },
  illuGrid: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.1,
  },
  illuGridLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "#295c41",
  },
  illuGridLineVertical: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "#295c41",
  },
  findingText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "800",
    color: "#14301f",
  },
  recommendationText: {
    fontSize: 15,
    lineHeight: 24,
    fontWeight: "700",
    color: "#4a6654",
  },
  recommendationCardList: {
    gap: 12,
  },
  recommendationCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: "#e1ebe2",
  },
  recommendationCardHeader: {
    gap: 4,
  },
  recommendationCardTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#14301f",
    letterSpacing: -0.2,
  },
  recommendationCardPurpose: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "700",
    color: "#4a6654",
  },
  recommendationCardItems: {
    gap: 10,
  },
  recommendationItemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  recommendationItemDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#295c41",
    marginTop: 7,
  },
  recommendationItemCopy: {
    flex: 1,
    gap: 2,
  },
  recommendationItemName: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
    color: "#14301f",
  },
  recommendationItemDose: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
    color: "#7fa88a",
  },
  previewGrid: {
    flexDirection: "row",
    gap: 12,
  },
  previewCard: {
    flex: 1,
    gap: 10,
  },
  previewFrame: {
    minHeight: 132,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#edf5ee",
    borderWidth: 1,
    borderColor: "#d8e9dc",
    position: "relative",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  previewLabelBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(20, 48, 31, 0.78)",
  },
  previewLabelBadgeText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  previewBadgeList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  previewMetaBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d8e9dc",
  },
  previewMetaBadgeText: {
    color: "#4a6654",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  explanationList: {
    gap: 10,
  },
  explanationRow: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 4,
    borderWidth: 1,
    borderColor: "#e1ebe2",
  },
  explanationRowTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: "#295c41",
    letterSpacing: 0.3,
  },
  explanationRowText: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "700",
    color: "#4a6654",
  },
  confidenceNoteCard: {
    backgroundColor: "#fffaf0",
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 8,
    borderWidth: 1,
    borderColor: "#f1dec1",
  },
  confidenceNoteTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: "#8a6633",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  confidenceNoteText: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "700",
    color: "#6b5431",
  },
  confidenceNoteHint: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "800",
    color: "#7c5f35",
  },
  progressMetrics: {
    flexDirection: "row",
    gap: 12,
  },
  progressMetricCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 4,
    borderWidth: 1,
    borderColor: "#e1ebe2",
  },
  progressMetricLabel: {
    fontSize: 11,
    fontWeight: "900",
    color: "#7fa88a",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  progressMetricValue: {
    fontSize: 24,
    fontWeight: "900",
    color: "#14301f",
    letterSpacing: -0.4,
  },
  progressSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  progressTrendBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d8e9dc",
  },
  progressTrendGlyph: {
    fontSize: 14,
    fontWeight: "900",
    color: "#295c41",
  },
  progressTrendText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#295c41",
    letterSpacing: 0.4,
  },
  progressTrendLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#4a6654",
  },
  progressSummaryText: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "700",
    color: "#4a6654",
  },
  historyLinkButton: {
    alignSelf: "flex-start",
    paddingVertical: 4,
  },
  historyLinkText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#295c41",
    letterSpacing: 0.3,
  },
  primaryButton: {
    backgroundColor: "#295c41",
    borderRadius: 22,
    paddingVertical: 22,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
  },
  primaryButtonDisabled: {
    backgroundColor: "#b8c8ba",
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  primaryButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  secondaryButton: {
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#cddccd",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: "#295c41",
    fontSize: 16,
    fontWeight: "900",
  },
  secondaryButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
    backgroundColor: "#f4faf5",
  },
  backButton: {
    alignSelf: "center",
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#7fa88a",
    letterSpacing: 0.4,
  },
  shareRowButton: {
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: "#295c41",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 12,
  },
  shareRowButtonText: {
    color: "#295c41",
    fontSize: 15,
    fontWeight: "900",
  },
  hiddenShareContainer: {
    position: "absolute",
    left: -2000,
    top: 0,
    opacity: 0,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(20, 48, 31, 0.4)",
    justifyContent: "flex-end",
  },
  selectorContent: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
    gap: 20,
  },
  selectorTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#14301f",
    textAlign: "center",
  },
  selectorGrid: {
    flexDirection: "row",
    gap: 12,
  },
  selectorItem: {
    flex: 1,
    backgroundColor: "#f4faf5",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: "#e1ebe2",
  },
  selectorIcon: {
    fontSize: 28,
  },
  selectorLabel: {
    fontSize: 13,
    fontWeight: "900",
    color: "#295c41",
    textAlign: "center",
  },
  coachingBlock: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
    borderWidth: 1,
    borderColor: "#e1ebe2",
  },
  coachingRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  coachingDot: {
    fontSize: 12,
    color: "#7fa88a",
    lineHeight: 18,
  },
  coachingText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
    color: "#4a6654",
  },
  trustCard: {
    backgroundColor: "#f7fbf7",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: "#d8e9dc",
  },
  trustSignals: {
    gap: 6,
  },
  trustSignalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  trustSignalLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#4a6654",
  },
  trustSignalBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  trustSignalBadgeText: {
    fontSize: 12,
    fontWeight: "900",
  },
  repeatabilityCard: {
    backgroundColor: "#fffff5",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: "#ede8d0",
  },
  repeatabilityTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: "#8a6633",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  repeatabilityRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  repeatabilityDot: {
    fontSize: 12,
    color: "#b89a5a",
    lineHeight: 18,
  },
  repeatabilityText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
    color: "#6b5431",
  },
  retakeButton: {
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: "#295c41",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  retakeButtonText: {
    color: "#295c41",
    fontSize: 15,
    fontWeight: "900",
  },
  coachingCard: {
    backgroundColor: "#14301f",
    borderRadius: 24,
    padding: 24,
    gap: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  coachingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  streakBadge: {
    backgroundColor: "#7fa88a",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  streakText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: 0.5,
  },
  directiveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  directiveIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(127, 168, 138, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  directiveEmoji: {
    fontSize: 20,
  },
  directiveText: {
    flex: 1,
    fontSize: 18,
    fontWeight: "800",
    color: "#ffffff",
    lineHeight: 24,
  },
  directiveFeedback: {
    fontSize: 14,
    fontWeight: "600",
    color: "#7fa88a",
    fontStyle: "italic",
    opacity: 0.9,
  },
  coachingProgressContainer: {
    gap: 8,
    marginBottom: 4,
  },
  coachingProgressTrack: {
    height: 8,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 4,
    overflow: "hidden",
  },
  coachingProgressFill: {
    height: "100%",
    backgroundColor: "#7fa88a",
    borderRadius: 4,
  },
  coachingProgressLabel: {
    fontSize: 12,
    fontWeight: "900",
    color: "#7fa88a",
    letterSpacing: 0.5,
  },
  coachingHint: {
    fontSize: 13,
    fontWeight: "600",
    color: "#7fa88a",
    fontStyle: "italic",
    opacity: 0.8,
    marginTop: 4,
  },
  validationItemPressed: {
    opacity: 0.7,
    backgroundColor: "#f4faf5",
  },
  retakeButtonPressed: {
    opacity: 0.7,
    backgroundColor: "#edf5ee",
  },
  productHeroBlock: {
    backgroundColor: "#14301f",
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingVertical: 32,
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  productHeroTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#ffffff",
    textAlign: "center",
  },
  productHeroSubtitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#7fa88a",
    textAlign: "center",
  },
  productActionBlock: {
    backgroundColor: "#f4faf5",
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderWidth: 1,
    borderColor: "#b8d0bc",
    gap: 12,
  },
  productActionMain: {
    fontSize: 18,
    fontWeight: "900",
    color: "#14301f",
    lineHeight: 25,
  },
  productActionSecondary: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4a6654",
  },
  productStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f9fbf9",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#e1ebe2",
  },
  productStatusBadge: {
    backgroundColor: "#e6f0e8",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  productStatusBadgeHeuristic: {
    backgroundColor: "#fff3cd",
  },
  productStatusBadgeText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#295c41",
    letterSpacing: 0.5,
  },
  productStatusValueLabel: {
    fontSize: 14,
    fontWeight: "900",
    color: "#4a6654",
  },
  productExplainBlock: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  productExplainText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#7fa88a",
    lineHeight: 18,
    fontStyle: "italic",
  },
  productTrendBlock: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#e1ebe2",
    gap: 10,
  },
  productTrendIcon: {
    fontSize: 16,
    fontWeight: "900",
    color: "#295c41",
  },
  productTrendText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: "#4a6654",
  },
  productHabitBlock: {
    backgroundColor: "#fff8e6",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: "#f1dec1",
    gap: 6,
    alignItems: "center",
  },
  productHabitStreak: {
    fontSize: 14,
    fontWeight: "900",
    color: "#8a6633",
  },
  productHabitUrgency: {
    fontSize: 13,
    fontWeight: "700",
    color: "#a37b3f",
  },
  productDebugBlock: {
    backgroundColor: "#1a1a1a",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    gap: 12,
  },
  productDebugTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
    opacity: 0.8,
  },
  productDebugGrid: {
    flexDirection: "row",
    gap: 8,
    width: "100%",
    justifyContent: "space-between",
  },
  productDebugImage: {
    flex: 1,
    height: 180,
    borderRadius: 8,
    backgroundColor: "#000000",
  }
});
