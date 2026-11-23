/** Open Food Facts client. https://openfoodfacts.github.io/openfoodfacts-server/api/ */

export interface FoodInput {
  barcode: string | null;
  name: string;
  brand: string;
  /** All nutrients per 100 g */
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  servingG: number | null;
  source: 'off' | 'custom';
}

const BASE = 'https://world.openfoodfacts.org';
const FIELDS = 'code,product_name,product_name_en,generic_name,brands,nutriments,serving_quantity';
const HEADERS = { 'User-Agent': 'FitLog/0.1 (personal fitness app)' };

function num(v: unknown): number | null {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function mapOffProduct(p: any): FoodInput | null {
  if (!p) return null;
  const name = String(p.product_name || p.product_name_en || p.generic_name || '').trim();
  if (!name) return null;
  const n = p.nutriments ?? {};
  let kcal = num(n['energy-kcal_100g']);
  if (kcal === null) {
    const kj = num(n['energy-kj_100g']) ?? num(n['energy_100g']);
    if (kj !== null) kcal = kj / 4.184;
  }
  const protein = num(n['proteins_100g']);
  const carbs = num(n['carbohydrates_100g']);
  const fat = num(n['fat_100g']);
  if (kcal === null && protein === null && carbs === null && fat === null) return null;
  const serving = num(p.serving_quantity);
  return {
    barcode: p.code ? String(p.code) : null,
    name,
    brand: String(p.brands ?? '').split(',')[0].trim(),
    kcal: round1(kcal ?? (protein ?? 0) * 4 + (carbs ?? 0) * 4 + (fat ?? 0) * 9),
    protein: round1(protein ?? 0),
    carbs: round1(carbs ?? 0),
    fat: round1(fat ?? 0),
    fiber: round1(num(n['fiber_100g']) ?? 0),
    servingG: serving && serving > 0 ? serving : null,
    source: 'off',
  };
}

async function getJson(url: string, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: HEADERS, signal: ctrl.signal });
    if (!res.ok) throw new Error(`Open Food Facts returned ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

/** Returns null when the product is unknown or has no nutrition data. */
export async function fetchByBarcode(barcode: string): Promise<FoodInput | null> {
  const json = await getJson(
    `${BASE}/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${FIELDS}`,
  );
  if (json?.status !== 1) return null;
  const food = mapOffProduct(json.product);
  if (food && !food.barcode) food.barcode = barcode;
  return food;
}

export async function searchFoods(query: string): Promise<FoodInput[]> {
  const q = encodeURIComponent(query.trim());
  const json = await getJson(
    `${BASE}/cgi/search.pl?search_terms=${q}&search_simple=1&action=process&json=1&page_size=30&fields=${FIELDS}`,
  );
  const products: unknown[] = Array.isArray(json?.products) ? json.products : [];
  return products.map(mapOffProduct).filter((f): f is FoodInput => f !== null);
}
