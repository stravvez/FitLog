import { addDays, fromDisplayWeight, toDisplayWeight } from '../format';
import { bmr, dailyTargets, macrosFor, NutritionProfile, tdee } from '../nutrition';
import { mapOffProduct } from '../off';
import { bests, e1rm, findPRs, LoggedSet, volume } from '../strength';

const profile: NutritionProfile = {
  sex: 'male',
  age: 20,
  heightCm: 175,
  weightKg: 70,
  activity: 'light',
  goal: 'maintain',
  trainingBonusKcal: 250,
  proteinPerKg: 2,
  fatPct: 0.25,
};

describe('nutrition', () => {
  it('computes Mifflin-St Jeor BMR', () => {
    expect(bmr(profile)).toBeCloseTo(10 * 70 + 6.25 * 175 - 5 * 20 + 5); // 1698.75
    expect(bmr({ ...profile, sex: 'female' })).toBeCloseTo(1698.75 - 166);
  });

  it('applies activity factor', () => {
    expect(tdee(profile)).toBeCloseTo(1698.75 * 1.375);
  });

  it('adds training-day bonus and keeps macros consistent with calories', () => {
    const rest = dailyTargets(profile, false);
    const train = dailyTargets(profile, true);
    expect(train.kcal - rest.kcal).toBe(250);
    expect(rest.protein).toBe(140);
    for (const t of [rest, train]) {
      const fromMacros = t.protein * 4 + t.carbs * 4 + t.fat * 9;
      expect(Math.abs(fromMacros - t.kcal)).toBeLessThan(15);
    }
    // Extra training calories go to carbs.
    expect(train.carbs).toBeGreaterThan(rest.carbs);
  });

  it('applies goal adjustments and a floor', () => {
    expect(dailyTargets({ ...profile, goal: 'cut' }, false).kcal).toBe(dailyTargets(profile, false).kcal - 500);
    expect(dailyTargets({ ...profile, weightKg: 30, heightCm: 120, goal: 'cut' }, false).kcal).toBe(1200);
  });

  it('scales per-100g macros', () => {
    expect(macrosFor({ kcal: 389, protein: 16.9, carbs: 66.3, fat: 6.9 }, 50)).toEqual({
      kcal: 194.5,
      protein: 8.45,
      carbs: 33.15,
      fat: 3.45,
    });
  });
});

describe('strength', () => {
  const s = (weightKg: number, reps: number, type: LoggedSet['type'] = 'normal'): LoggedSet => ({ weightKg, reps, type });

  it('estimates 1RM with Epley', () => {
    expect(e1rm(100, 1)).toBe(100);
    expect(e1rm(100, 10)).toBeCloseTo(133.33, 1);
    expect(e1rm(0, 10)).toBe(0);
  });

  it('ignores warm-ups in volume and bests', () => {
    const sets = [s(40, 10, 'warmup'), s(60, 8), s(60, 6)];
    expect(volume(sets)).toBe(60 * 14);
    expect(bests(sets).maxWeight).toBe(60);
  });

  it('detects PRs against history', () => {
    const prev = [s(60, 8), s(60, 8)];
    expect(findPRs(prev, [s(62.5, 8)])).toEqual(['weight', 'e1rm', 'setVolume']);
    expect(findPRs(prev, [s(60, 10)])).toEqual(['e1rm', 'setVolume', 'reps']);
    expect(findPRs(prev, [s(55, 8)])).toEqual([]);
  });

  it('does not count the first session as a PR', () => {
    expect(findPRs([], [s(100, 5)])).toEqual([]);
  });
});

describe('Open Food Facts mapping', () => {
  it('maps a typical product', () => {
    const food = mapOffProduct({
      code: '8901063010031',
      product_name: 'Oats',
      brands: 'Saffola, Marico',
      serving_quantity: '40',
      nutriments: {
        'energy-kcal_100g': 389,
        proteins_100g: 13.6,
        carbohydrates_100g: 66.3,
        fat_100g: 6.9,
        fiber_100g: '10.1',
      },
    });
    expect(food).toEqual({
      barcode: '8901063010031',
      name: 'Oats',
      brand: 'Saffola',
      kcal: 389,
      protein: 13.6,
      carbs: 66.3,
      fat: 6.9,
      fiber: 10.1,
      servingG: 40,
      source: 'off',
    });
  });

  it('falls back to kJ and handles missing fields', () => {
    const food = mapOffProduct({ product_name_en: 'Juice', nutriments: { energy_100g: 418.4 } });
    expect(food?.kcal).toBe(100);
    expect(food?.protein).toBe(0);
    expect(food?.servingG).toBeNull();
    expect(food?.brand).toBe('');
  });

  it('rejects products with no name or no nutrition', () => {
    expect(mapOffProduct({ nutriments: { 'energy-kcal_100g': 100 } })).toBeNull();
    expect(mapOffProduct({ product_name: 'Mystery', nutriments: {} })).toBeNull();
    expect(mapOffProduct(null)).toBeNull();
  });
});

describe('format', () => {
  it('converts units round-trip', () => {
    expect(toDisplayWeight(100, 'lb')).toBe(220.5);
    expect(fromDisplayWeight(220.462, 'lb')).toBeCloseTo(100, 2);
    expect(toDisplayWeight(82.5, 'kg')).toBe(82.5);
  });

  it('adds days across month boundaries', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});
