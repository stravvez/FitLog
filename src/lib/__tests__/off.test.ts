import { fetchByBarcode, OffHttpError, offErrorMessage, searchFoods } from '../off';

const product = {
  code: '3017624010701',
  product_name: 'Nutella',
  brands: 'Ferrero',
  nutriments: { 'energy-kcal_100g': 539, proteins_100g: 6.3, carbohydrates_100g: 57.5, fat_100g: 30.9 },
};

const json = (body: unknown, status = 200) =>
  Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) } as Response);

describe('Open Food Facts client', () => {
  const realFetch = globalThis.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    fetchMock = jest.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });
  afterEach(() => {
    jest.useRealTimers();
    globalThis.fetch = realFetch;
  });

  it('looks up a barcode', async () => {
    fetchMock.mockReturnValueOnce(json({ status: 1, product }));
    const food = await fetchByBarcode('3017624010701');
    expect(food).toMatchObject({ name: 'Nutella', brand: 'Ferrero', kcal: 539, barcode: '3017624010701' });
    expect(fetchMock.mock.calls[0][0]).toContain('/api/v2/product/3017624010701.json');
  });

  it('returns null for unknown barcodes', async () => {
    fetchMock.mockReturnValueOnce(json({ status: 0 }));
    await expect(fetchByBarcode('000')).resolves.toBeNull();
  });

  it('retries once when the server is overloaded', async () => {
    fetchMock.mockReturnValueOnce(json({}, 503)).mockReturnValueOnce(json({ products: [product, { code: 'x' }] }));
    const p = searchFoods('nutella');
    await jest.advanceTimersByTimeAsync(1500);
    const results = await p;
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(results).toHaveLength(1); // the nameless product is dropped
  });

  it('gives up after the retry and reports the status', async () => {
    fetchMock.mockReturnValue(json({}, 503));
    const p = searchFoods('nutella').catch((e) => e);
    await jest.advanceTimersByTimeAsync(1500);
    const err = await p;
    expect(err).toBeInstanceOf(OffHttpError);
    expect(offErrorMessage(err)).toMatch(/busy/);
  });

  it('does not retry client errors', async () => {
    fetchMock.mockReturnValue(json({}, 404));
    await expect(searchFoods('x')).rejects.toBeInstanceOf(OffHttpError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('describes network failures', () => {
    expect(offErrorMessage(new TypeError('Network request failed'))).toMatch(/connection/);
  });
});
