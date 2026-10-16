// Simulate the exact frontend storageService lifecycle
const API_BASE = 'http://localhost:3000/api';

class MockStorage {
  constructor() {
    this.store = {};
  }
  getItem(k) { return this.store[k] || null; }
  setItem(k, v) { this.store[k] = String(v); }
  removeItem(k) { delete this.store[k]; }
}

const localStorage = new MockStorage();

const STORAGE_KEYS = {
  STOCK: 'printflow_stock_v1',
  ORDERS: 'printflow_orders_v1',
  EXPENSES: 'printflow_expenses_v1'
};

const storageService = {
  _stockCache: null,
  _stockPromise: null,

  async loadStockFromServer() {
    console.log('[loadStockFromServer] called. promise exists?:', Boolean(this._stockPromise));
    if (this._stockPromise) {
      console.log('[loadStockFromServer] Returning existing pending promise!');
      return this._stockPromise;
    }

    this._stockPromise = (async () => {
      try {
        console.log('[loadStockFromServer] Fetching /api/stock?limit=2000...');
        const res = await fetch(`${API_BASE}/stock?limit=2000`);
        if (res.ok) {
          const json = await res.json();
          const items = Array.isArray(json.stock) ? json.stock : (Array.isArray(json) ? json : []);
          this._stockCache = items.map(s => ({ ...s, id: s._id || s.localId || s.id }));
          console.log('[loadStockFromServer] Success! Loaded items count:', this._stockCache.length);
        } else {
          if (!this._stockCache) this._stockCache = [];
        }
      } catch (e) {
        console.error('Failed to load stock:', e);
        if (!this._stockCache) this._stockCache = [];
      } finally {
        this._stockPromise = null;
        console.log('[loadStockFromServer] Finished. _stockPromise reset to null.');
      }
      return this._stockCache;
    })();

    return this._stockPromise;
  },

  getStock() {
    if (Array.isArray(this._stockCache)) {
      return this._stockCache;
    }
    if (localStorage.getItem('pg_migrated_to_mongodb')) {
      console.log('[getStock] pg_migrated_to_mongodb is set. _stockCache is null.');
      if (!this._stockPromise) {
        console.log('[getStock] Kicking off loadStockFromServer()...');
        this.loadStockFromServer();
      } else {
        console.log('[getStock] _stockPromise is active, waiting for it.');
      }
      return [];
    }
    return [];
  }
};

async function simulateMount(refreshNumber) {
  console.log(`\n================ SIMULATING REFRESH #${refreshNumber} ================`);
  storageService._stockCache = null;
  storageService._stockCacheLoading = false;
  localStorage.setItem('pg_migrated_to_mongodb', 'true');

  let uiRenderCount = 0;
  let lastUiStockCount = null;

  function renderUI(stage) {
    uiRenderCount++;
    const stock = storageService.getStock();
    const activeStock = stock.filter(x => !x.isArchived);
    const stockProducts = activeStock.filter(x => !x.parentId);
    lastUiStockCount = stockProducts.length;
    console.log(`[UI Render #${uiRenderCount} @ ${stage}] Total stock: ${stock.length}, Products: ${stockProducts.length}`);
  }

  // 1. Initial render (before useEffect)
  renderUI('initial render');

  // 2. useEffect kicks off
  let refreshTriggered = 0;
  const debouncedRefresh = () => {
    refreshTriggered++;
    console.log(`[debouncedRefresh triggered (#${refreshTriggered})]`);
    renderUI('debouncedRefresh');
  };

  const notify = debouncedRefresh;
  const wrap = (p) => Promise.resolve(p).then(notify, notify);

  // loadAllDataFromServer kicks off:
  console.log('[useEffect] Calling loadStockFromServer via wrap()...');
  const stockLoadPromise = wrap(storageService.loadStockFromServer());

  await stockLoadPromise;
  console.log('[useEffect] stockLoadPromise settled.');

  // Small delay to let any async tasks finish
  await new Promise(r => setTimeout(r, 100));

  console.log(`[Final State Refresh #${refreshNumber}] Last UI stock products visible: ${lastUiStockCount}`);
}

async function run() {
  await simulateMount(1);
  await simulateMount(2);
  await simulateMount(3);
}

run().catch(console.error);
