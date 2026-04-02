import { View, Text } from "react-native";
import styles from "../styles/shared";
import {
  safeBackendText,
  decisionPriorityFallback,
  todayDecisionFallback,
  nextMealFallback,
  riskControlFallback,
} from "../utils/helpers";

export default function CoachPriorityCard({ decision, todayDecision, coach }) {
  return (
    <View style={styles.coachPriorityCard}>
      <Text style={styles.coachPriorityEyebrow}>Bugünün Önceliği</Text>
      <Text style={styles.coachPriorityTitle}>
        {safeBackendText(decision?.priority, decisionPriorityFallback(coach))}
      </Text>

      {todayDecision?.length ? (
        <View style={styles.actionPillRow}>
          {todayDecision.map((line) => (
            <View key={line} style={styles.actionPill}>
              <Text style={styles.actionPillText}>{safeBackendText(line, todayDecisionFallback(coach))}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {decision?.next_meal_action ? (
        <View style={styles.nextMealCard}>
          <Text style={styles.nextMealLabel}>Sonraki Öğün</Text>
          <Text style={styles.nextMealValue}>
            {safeBackendText(decision.next_meal_action, nextMealFallback(coach))}
          </Text>
        </View>
      ) : null}

      {decision?.risk_control ? (
        <View style={styles.riskControlRow}>
          <Text style={styles.riskControlLabel}>Bugün Kaçın</Text>
          <Text style={styles.riskControlValue}>
            {safeBackendText(decision.risk_control, riskControlFallback(coach))}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
