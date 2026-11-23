export type Sex = 'male' | 'female';
export type Activity = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type Goal = 'cut' | 'maintain' | 'bulk';

/** Multipliers for non-exercise activity. Training days add a separate bonus on top. */
export const ACTIVITY_FACTORS: Record<Activity, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const ACTIVITY_LABELS: Record<Activity, string> = {
  sedentary: 'Sedentary (desk job)',
  light: 'Lightly active',
  moderate: 'Moderately active',
  active: 'Very active',
  very_active: 'Extremely active',
};

export const GOAL_ADJUST: Record<Goal, number> = { cut: -500, maintain: 0, bulk: 300 };

export interface Macros {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface NutritionProfile {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: Activity;
  goal: Goal;
  trainingBonusKcal: number;
  proteinPerKg: number;
  /** Fraction of calories from fat, e.g. 0.25 */
  fatPct: number;
}

/** Mifflin-St Jeor */
export function bmr(p: Pick<NutritionProfile, 'sex' | 'weightKg' | 'heightCm' | 'age'>): number {
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age;
  return base + (p.sex === 'male' ? 5 : -161);
}

export function tdee(p: NutritionProfile): number {
  return bmr(p) * ACTIVITY_FACTORS[p.activity];
}

export function dailyTargets(p: NutritionProfile, isTrainingDay: boolean): Macros {
  const kcal = Math.max(
    1200,
    Math.round(tdee(p) + GOAL_ADJUST[p.goal] + (isTrainingDay ? p.trainingBonusKcal : 0)),
  );
  const protein = Math.round(p.proteinPerKg * p.weightKg);
  const fat = Math.round((kcal * p.fatPct) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { kcal, protein, carbs, fat };
}

/** Nutrients stored per 100 g → amount for the given grams. */
export function macrosFor(per100: Macros, grams: number): Macros {
  const f = grams / 100;
  return {
    kcal: per100.kcal * f,
    protein: per100.protein * f,
    carbs: per100.carbs * f,
    fat: per100.fat * f,
  };
}

export function sumMacros(items: Macros[]): Macros {
  return items.reduce(
    (a, b) => ({
      kcal: a.kcal + b.kcal,
      protein: a.protein + b.protein,
      carbs: a.carbs + b.carbs,
      fat: a.fat + b.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
}
