/**
 * GoalEngine utility — Ported from app/services/goal_engine.py
 * Matches backend Mifflin-St Jeor and macro distribution logic 100%.
 */

const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const FAT_LOSS_ADJUSTMENTS = {
  sedentary: -300,
  light: -350,
  moderate: -400,
  active: -450,
  very_active: -500,
};

const MUSCLE_GAIN_ADJUSTMENTS = {
  sedentary: 200,
  light: 250,
  moderate: 300,
  active: 350,
  very_active: 400,
};

// V1 Optimization Modes Adjustment Factors
// aggressive: 30% more intense deficit/surplus, higher protein
// protective: 30% less intense deficit/surplus, lower protein
const OPTIMIZATION_ADJUSTMENTS = {
  balanced:   { multiplier: 1.0, proteinOffset: 0.0 },
  aggressive: { multiplier: 1.3, proteinOffset: 0.2 },
  protective: { multiplier: 0.7, proteinOffset: -0.1 },
};

export function calculateGoalsLocally(profile) {
  const { 
    weight_kg, 
    height_cm, 
    age, 
    gender, 
    activity_level, 
    goal, 
    training_frequency_per_week,
    optimization_mode = "balanced" 
  } = profile;

  const w = parseFloat(weight_kg);
  const h = parseFloat(height_cm);
  const a = parseInt(age, 10);
  const freq = parseInt(training_frequency_per_week || "3", 10);

  if (!w || !h || !a) return null;

  // 1. BMR (Mifflin-St Jeor)
  const genderOffset = gender === "male" ? 5 : -161;
  const bmr = (10 * w) + (6.25 * h) - (5 * a) + genderOffset;

  // 2. TDEE
  const multiplier = ACTIVITY_MULTIPLIERS[activity_level] || 1.2;
  const tdee = bmr * multiplier;

  // 3. Goal Adjustment & initial protein/fat ratios
  let baseAdjustment = 0;
  let proteinPerKg = 1.6;
  let fatPerKg = 0.8;

  if (goal === "fat_loss") {
    baseAdjustment = FAT_LOSS_ADJUSTMENTS[activity_level] || -300;
    proteinPerKg = 2.2;
    fatPerKg = 0.7;
  } else if (goal === "muscle_gain") {
    baseAdjustment = MUSCLE_GAIN_ADJUSTMENTS[activity_level] || 200;
    proteinPerKg = freq < 4 ? 1.8 : 1.9;
    fatPerKg = 0.8;
  } else if (goal === "recomposition") {
    baseAdjustment = freq >= 4 ? -100 : -150;
    proteinPerKg = 2.0;
    fatPerKg = 0.7;
  } else {
    // maintenance
    baseAdjustment = 0;
    proteinPerKg = 1.6;
    fatPerKg = 0.8;
  }

  // 3.1 Optimization Mode Application
  const opt = OPTIMIZATION_ADJUSTMENTS[optimization_mode] || OPTIMIZATION_ADJUSTMENTS.balanced;
  const finalAdjustment = baseAdjustment * opt.multiplier;
  const finalProteinPerKg = proteinPerKg + opt.proteinOffset;

  // 4. Calorie Target
  const minCal = gender === "male" ? 1500 : 1200;
  const calorieTarget = Math.max(tdee + finalAdjustment, minCal);

  // 5. Macros
  const proteinG = w * finalProteinPerKg;
  const fatG = w * fatPerKg;
  const proteinKcal = proteinG * 4;
  const fatKcal = fatG * 9;
  const carbKcal = Math.max(calorieTarget - proteinKcal - fatKcal, 0);
  const carbG = carbKcal / 4;

  // 6. Water
  const waterTarget = w * 35; // Standard 35ml per kg

  return {
    calorie_target_kcal: Math.round(calorieTarget),
    protein_target_g: Math.round(proteinG),
    fat_target_g: Math.round(fatG),
    carbs_target_g: Math.round(carbG),
    water_target_ml: Math.round(waterTarget),
    bmr_kcal: Math.round(bmr),
    tdee_kcal: Math.round(tdee),
  };
}

