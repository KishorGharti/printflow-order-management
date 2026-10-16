import { Customer, MasterProduct, CustomerPricing, Order, AppSettings, OrderStatus, PaymentMethod, UnitType, Expense, FinancialLedgerEntry, FinancialLedgerData } from '../types';
import { apiService } from './apiService';

const STORAGE_KEYS = {
  CUSTOMERS: 'printflow_customers_v1',
  PRODUCTS: 'printflow_products_v1',
  PRICING: 'printflow_customer_pricing_v1',
  ORDERS: 'printflow_orders_v1',
  SETTINGS: 'printflow_settings_v1',
  EXPENSES: 'printflow_expenses_v1',
  DEMO_V5: 'printflow_demo_5month_designghar_v1',
};



// Initial Seed Data
const INITIAL_PRODUCTS: MasterProduct[] = [
  {
    id: 'prod-1',
    name: 'Business Cards (500 Pack)',
    category: 'Stationery',
    defaultPrice: 60.00,
    unit: 'set',
    description: '16pt Heavyweight Cardstock with Premium Matte or Gloss Finish.',
    isActive: true,
    createdAt: '2026-01-10T10:00:00Z',
  },
  {
    id: 'prod-2',
    name: 'Vinyl Banner (13oz)',
    category: 'Large Format',
    defaultPrice: 8.00,
    unit: 'sq.ft',
    description: 'Heavy duty indoor/outdoor vinyl banner with reinforced hems and grommets.',
    isActive: true,
    createdAt: '2026-01-10T10:00:00Z',
  },
  {
    id: 'prod-3',
    name: 'Flyers (1000 Pack - 8.5x11)',
    category: 'Marketing',
    defaultPrice: 75.00,
    unit: 'set',
    description: 'Full color 100lb Gloss Book paper print.',
    isActive: true,
    createdAt: '2026-01-10T10:00:00Z',
  },
  {
    id: 'prod-4',
    name: 'DTF Shirt Transfer Print',
    category: 'Apparel',
    defaultPrice: 10.00,
    unit: 'pcs',
    description: 'Direct-to-Film transfer print ready for heat press.',
    isActive: true,
    createdAt: '2026-01-10T10:00:00Z',
  },
];

const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: 'cust-1',
    name: 'Alex Rivers',
    businessName: 'Apex Marketing Group',
    phone: '(555) 234-5678',
    whatsapp: '+15552345678',
    email: 'alex@apexmarketing.com',
    address: '742 Evergreen Terrace, Suite 100',
    notes: 'VIP Customer. Prefers matte finish on banners. Always orders in bulk.',
    createdAt: '2026-01-15T09:00:00Z',
  },
  {
    id: 'cust-2',
    name: 'Sarah Jenkins',
    businessName: 'Bright Start Daycare',
    phone: '(555) 876-5432',
    whatsapp: '+15558765432',
    email: 'sarah@brightstart.org',
    address: '123 Sunshine Blvd, Building B',
    notes: 'Needs design approval first before sending to print.',
    createdAt: '2026-02-01T11:30:00Z',
  },
  {
    id: 'cust-design-ghar-demo',
    name: 'Design Ghar',
    businessName: 'Design Ghar',
    phone: '9866989166',
    whatsapp: '+9779866989166',
    email: '',
    address: 'Nepal',
    notes: '5-month demo client • monthly due reminder enabled for Nepali 25 gate.',
    createdAt: new Date().toISOString(),
  },
];

const INITIAL_PRICING: CustomerPricing[] = [
  {
    id: 'cp-1',
    customerId: 'cust-1',
    productId: 'prod-2',
    customPrice: 6.50,
    updatedAt: '2026-02-01T10:00:00Z',
  },
];

const today = new Date().toISOString().split('T')[0];
const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
const demoMonthDate = (monthsAgo: number, day = 5) => {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() - monthsAgo);
  date.setDate(day);
  return date.toISOString().split('T')[0];
};
const designGharProducts = [
  ['prod-1', 'Business Cards (500 Pack)', 'set', 2, 3500, 'Credit'],
  ['prod-2', 'Vinyl Banner (13oz)', 'sq.ft', 120, 180, 'Pay'],
  ['prod-4', 'DTF Shirt Transfer Print', 'pcs', 80, 250, 'Online'],
  ['prod-3', 'Flyers (1000 Pack - 8.5x11)', 'set', 3, 5500, 'Pay'],
  ['prod-1', 'Business Cards (500 Pack)', 'set', 4, 3200, 'Online'],
] as const;
const DESIGN_GHAR_DEMO_ORDERS: Order[] = designGharProducts.map((item, index) => {
  const total = item[3] * item[4];
  const completedAt = new Date(`${demoMonthDate(index, 7)}T10:30:00+05:45`).toISOString();
  return {
    id: `demo-design-ghar-m${index}`, orderNumber: `JOB-${1035-index}`, customerId: 'cust-design-ghar-demo', customerName: 'Design Ghar', customerPhone: '9866989166', customerEmail: '', customerWhatsapp: '+9779866989166',
    items: [{ id:`demo-design-item-${index}`, productId:item[0], productName:item[1], unit:item[2], itemDescription:index === 0 ? '25 gate monthly due reminder demo.' : 'Five-month business history demo.', quantity:item[3], unitPrice:item[4], defaultPrice:item[4], lineTotal:total }],
    totalAmount:total, orderDate:demoMonthDate(index,5), dueDate:demoMonthDate(index,7), dueTime:'17:00', status:'Ready', paymentMethod:item[5], notes:index === 0 ? '25 gate monthly due reminder demo.' : 'Five-month business history demo.', createdAt:new Date(`${demoMonthDate(index,5)}T09:15:00+05:45`).toISOString(), updatedAt:completedAt, completedAt,
  };
});

const INITIAL_ORDERS: Order[] = [
  ...DESIGN_GHAR_DEMO_ORDERS,
  {
    id: 'ord-1042',
    orderNumber: 'JOB-1042',
    customerId: 'cust-1',
    customerName: 'Apex Marketing Group',
    customerPhone: '(555) 234-5678',
    customerEmail: 'alex@apexmarketing.com',
    customerWhatsapp: '+15552345678',
    items: [
      {
        id: 'item-1',
        productId: 'prod-2',
        productName: 'Vinyl Banner (13oz)',
        unit: 'sq.ft',
        itemDescription: 'Matte finish with heavy duty hems and brass grommets every 2ft.',
        width: 4,
        height: 8,
        quantity: 1,
        unitPrice: 6.50,
        defaultPrice: 8.00,
        customerPrice: 6.50,
        lineTotal: 208.00,
      },
    ],
    totalAmount: 208.00,
    orderDate: today,
    dueDate: today,
    status: 'Printing',
    notes: 'Hem and grommets every 2 feet. Matte finish.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ord-1041',
    orderNumber: 'JOB-1041',
    customerId: 'cust-2',
    customerName: 'Bright Start Daycare',
    customerPhone: '(555) 876-5432',
    customerEmail: 'sarah@brightstart.org',
    customerWhatsapp: '+15558765432',
    items: [
      {
        id: 'item-2',
        productId: 'prod-3',
        productName: 'Flyers (1000 Pack - 8.5x11)',
        unit: 'set',
        itemDescription: 'Gloss paper stock with double-sided full color print.',
        quantity: 1,
        unitPrice: 60.00,
        defaultPrice: 75.00,
        customerPrice: 60.00,
        lineTotal: 60.00,
      },
    ],
    totalAmount: 60.00,
    orderDate: yesterday,
    dueDate: yesterday,
    status: 'In Design',
    notes: 'Waiting for customer approval on revised logo design.',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
  },
];

const INITIAL_EXPENSES: Expense[] = [
  {
    id: 'exp-1',
    title: 'Vinyl Roll Stock (13oz 54")',
    category: 'Material Stock',
    amount: 120.00,
    date: today,
    notes: '2 rolls of white 13oz banner vinyl',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'exp-2',
    title: 'Eco-Solvent Ink Cartridges (CMYK)',
    category: 'Ink & Toner',
    amount: 85.00,
    date: yesterday,
    notes: 'Cyan and Magenta ink replacement',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
];

const DEFAULT_SETTINGS: AppSettings = {
  shopName: 'PrintFlow Pro Shop',
  shopPhone: '(555) 100-PRINT',
  shopEmail: 'owner@printflowshop.com',
  openingBalance: 2500.00, // Initial cash/bank balance
  currencySymbol: 'Rs.',
  currencyCode: 'NPR',
  dateMode: 'AD',
  whatsappApiToken: '',
  whatsappPhoneId: '',
  whatsappApiVersion: 'v23.0',
  whatsappMode: 'manual',
  brandPrimary: '#4f46e5',
  brandAccent: '#06b6d4',
  brandSidebar: '#0f172a',
  brandSurface: '#f8fafc',
  whatsappTemplate: 'Hello {{customer_name}},\n\nUpdate for Order {{order_number}}:\nStatus: {{status}}\nTotal: {{total}}\n\nThank you for choosing PrintFlow!',
  emailSender: 'orders@printflowshop.com',
  emailApiKey: '',
  emailTemplate: 'Hi {{customer_name}},\n\nYour order {{order_number}} status has been updated to: {{status}}.\n\nTotal: {{total}}\n\nBest regards,\nPrintFlow Team',
  useFirebase: false,
  appearance: 'light',
};

function initStorage() {
  if (!localStorage.getItem(STORAGE_KEYS.CUSTOMERS)) {
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(INITIAL_CUSTOMERS));
  }
  try {
    const customers: Customer[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.CUSTOMERS) || '[]');
    let changed = false;
    const migrated = customers.map((customer) => {
      if (!customer.businessName?.trim()) {
        changed = true;
        return { ...customer, businessName: customer.name?.trim() || 'Unnamed Company' };
      }
      return customer;
    });
    if (changed) localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(migrated));
  } catch (error) {
    console.warn('Customer company-name migration skipped.', error);
  }

  if (!localStorage.getItem(STORAGE_KEYS.PRODUCTS)) {
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(INITIAL_PRODUCTS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.PRICING)) {
    localStorage.setItem(STORAGE_KEYS.PRICING, JSON.stringify(INITIAL_PRICING));
  }
  if (!localStorage.getItem(STORAGE_KEYS.ORDERS)) {
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(INITIAL_ORDERS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.SETTINGS)) {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
  }
  if (!localStorage.getItem(STORAGE_KEYS.EXPENSES)) {
    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(INITIAL_EXPENSES));
  }
  if (!localStorage.getItem(STORAGE_KEYS.DEMO_V5)) {
    const clients: Customer[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.CUSTOMERS) || '[]');
    let designGhar = clients.find((client) => String(client.phone || '').replace(/\D/g, '') === '9866989166' || String(client.businessName || '').toLowerCase() === 'design ghar');
    if (!designGhar) {
      designGhar = INITIAL_CUSTOMERS.find((client) => client.id === 'cust-design-ghar-demo')!;
      clients.unshift(designGhar);
      localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(clients));
    }
    const orders: Order[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.ORDERS) || '[]');
    const ids = new Set(orders.map((order) => order.id));
    const missing = DESIGN_GHAR_DEMO_ORDERS.filter((order) => !ids.has(order.id)).map((order) => ({ ...order, customerId: designGhar!.id }));
    if (missing.length) localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify([...missing, ...orders]));
    localStorage.setItem(STORAGE_KEYS.DEMO_V5, 'done');
  }
}

initStorage();

export const storageService = {
  getADandBSDate(adDateStr: string) {
    if (!adDateStr) return { ad: '', bs: '', bsFormatted: '' };
    const dateObj = new Date(`${adDateStr}T12:00:00`);
    if (isNaN(dateObj.getTime())) return { ad: adDateStr, bs: adDateStr, bsFormatted: adDateStr };

    try {
      const moduleValue = (window as any).NepaliDate;
      const NepaliDate = typeof moduleValue === 'function' ? moduleValue : moduleValue?.default;
      if (NepaliDate) {
        const nepaliDate = new NepaliDate(dateObj);
        const bs = nepaliDate.format('YYYY-MM-DD');
        return {
          ad: adDateStr,
          bs: `${bs} BS`,
          bsFormatted: `${nepaliDate.format('D MMMM YYYY')} BS`,
        };
      }
    } catch (error) {
      console.warn('Nepali date conversion unavailable; using fallback.', error);
    }

    const year = dateObj.getFullYear();
    const month = dateObj.getMonth() + 1;
    const day = dateObj.getDate();
    let bsYear = year + 56;
    let bsMonth = month + 8;
    let bsDay = day + 15;
    if (bsDay > 30) { bsDay -= 30; bsMonth += 1; }
    if (bsMonth > 12) { bsMonth -= 12; bsYear += 1; }
    const bsMonthNames = ['Baisakh', 'Jestha', 'Asar', 'Shrawan', 'Bhadra', 'Aswin', 'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'];
    const bsMonthName = bsMonthNames[bsMonth - 1] || 'Baisakh';
    return {
      ad: adDateStr,
      bs: `${bsYear}-${String(bsMonth).padStart(2, '0')}-${String(bsDay).padStart(2, '0')} BS`,
      bsFormatted: `${bsDay} ${bsMonthName} ${bsYear} BS`,
    };
  },

  displayDate(adDateStr: string): string {
    const mode = this.getSettings().dateMode || 'AD';
    if (mode === 'BS') return this.getADandBSDate(adDateStr).bsFormatted || adDateStr;
    return adDateStr;
  },

  formatDateForMode(adDateStr: string, mode?: 'AD' | 'BS'): string {
    const activeMode = mode || this.getSettings().dateMode || 'AD';
    if (!adDateStr) return '—';
    if (activeMode === 'BS') return this.getADandBSDate(adDateStr).bsFormatted || adDateStr;
    return adDateStr;
  },

  dateInputValue(adDateStr: string): string {
    const mode = this.getSettings().dateMode || 'AD';
    return this.dateInputValueForMode(adDateStr, mode);
  },

  dateInputValueForMode(adDateStr: string, mode?: 'AD' | 'BS'): string {
    const activeMode = mode || this.getSettings().dateMode || 'AD';
    if (activeMode !== 'BS' || !adDateStr) return adDateStr || '';
    try {
      const moduleValue = (window as any).NepaliDate;
      const NepaliDate = typeof moduleValue === 'function' ? moduleValue : moduleValue?.default;
      if (NepaliDate) return new NepaliDate(new Date(`${adDateStr}T12:00:00`)).format('YYYY-MM-DD');
    } catch (error) {
      console.warn('BS input formatting failed', error);
    }
    return (this.getADandBSDate(adDateStr).bs || '').replace(' BS', '');
  },

  dateInputToAD(inputValue: string): string {
    const mode = this.getSettings().dateMode || 'AD';
    return this.dateInputToADForMode(inputValue, mode);
  },

  dateInputToADForMode(inputValue: string, mode?: 'AD' | 'BS'): string {
    const activeMode = mode || this.getSettings().dateMode || 'AD';
    if (activeMode !== 'BS') return inputValue;
    try {
      const moduleValue = (window as any).NepaliDate;
      const NepaliDate = typeof moduleValue === 'function' ? moduleValue : moduleValue?.default;
      if (!NepaliDate) throw new Error('Nepali date converter not loaded');
      const match = String(inputValue || '').trim().match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/);
      if (!match) throw new Error('Use BS date format YYYY-MM-DD');
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      if (month < 1 || month > 12 || day < 1 || day > 32) throw new Error('Invalid BS date fields');
      const nepaliDate = new NepaliDate(year, month - 1, day);
      const jsDate: Date = nepaliDate.toJsDate();
      if (!(jsDate instanceof Date) || Number.isNaN(jsDate.getTime())) throw new Error('Invalid BS date');
      if (nepaliDate.getYear() !== year || nepaliDate.getMonth() !== month - 1 || nepaliDate.getDate() !== day) throw new Error('Invalid day for selected BS month');
      const y = jsDate.getFullYear();
      const m = String(jsDate.getMonth() + 1).padStart(2, '0');
      const d = String(jsDate.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    } catch (error) {
      console.error('BS to AD conversion failed', error);
      return inputValue;
    }
  },

  resetToDemoData(): void {
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(INITIAL_CUSTOMERS));
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(INITIAL_PRODUCTS));
    localStorage.setItem(STORAGE_KEYS.PRICING, JSON.stringify(INITIAL_PRICING));
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(INITIAL_ORDERS));
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(INITIAL_EXPENSES));
    window.location.reload();
  },

  getSettings(): AppSettings {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      const merged = data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : { ...DEFAULT_SETTINGS };
      return { ...merged, currencySymbol: 'Rs.', currencyCode: 'NPR' };
    } catch (e) {
      return { ...DEFAULT_SETTINGS, currencySymbol: 'Rs.', currencyCode: 'NPR' };
    }
  },

  saveSettings(settings: AppSettings): void {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify({ ...settings, currencySymbol: 'Rs.', currencyCode: 'NPR' }));
  },

  getCompanyName(customerId: string, fallback = 'Unnamed Company'): string {
    const customer = this.getCustomerById(customerId);
    return customer?.businessName?.trim() || fallback || 'Unnamed Company';
  },

  formatCurrency(amount: number): string {
    return `Rs.${Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  },

  calculateLineTotal(
    unit: UnitType,
    width: number | undefined,
    height: number | undefined,
    quantity: number,
    unitPrice: number
  ): number {
    void unit;
    void width;
    void height;
    return Math.max(0, quantity || 0) * Math.max(0, unitPrice || 0);
  },

  // Financial Calculations
  getTotalIncome(): number {
    return this.getOrders().filter((o) => o.status !== 'Cancelled').reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
  },

  async getTotalExpenses(): Promise<number> {
    const expenses = await this.getExpenses();
    return expenses.reduce((sum, e) => sum + e.amount, 0);
  },

  async getPaidExpenses(): Promise<number> {
    const expenses = await this.getExpenses();
    return expenses.reduce((sum, e) => sum + Number(e.paidAmount || 0), 0);
  },

  async getNetBalance(): Promise<number> {
    const opening = Number(this.getSettings().openingBalance || 0);
    const paidExpenses = await this.getPaidExpenses();
    return opening + this.getTotalIncome() - paidExpenses;
  },

  // ─── Expenses CRUD (Node.js API + database Primary Source of Truth) ─────────

  /**
   * Fetch expenses from database via Node.js API.
   * database is the single source of truth; localStorage is not used for financial data.
   */
  async getExpenses(
    filters?: { fromDate?: string; toDate?: string; category?: string; paymentStatus?: string; search?: string }
  ): Promise<Expense[]> {
    const serverExpenses = await apiService.getExpenses(filters);
    return serverExpenses.map((raw: any) => {
      const amount = Math.max(0, Number(raw.amount || 0));
      let paymentHistory = Array.isArray(raw.paymentHistory) ? raw.paymentHistory : [];
      const wasLegacyCredit = raw.paymentStatus === 'Credit';
      if (!paymentHistory.length && raw.paidAt && (raw.paymentMethod === 'Credit' || wasLegacyCredit)) {
        paymentHistory = [{
          id: `legacy-${raw.id || raw._id}`,
          reference: `CP-${String(raw.id || raw._id).replace(/\D/g, '').slice(-4).padStart(4, '0')}`,
          amount,
          method: 'Cash' as const,
          paidAt: raw.paidAt,
          notes: 'Migrated vendor credit settlement'
        }];
      }
      const isCredit = raw.paymentMethod === 'Credit' || wasLegacyCredit || raw.paymentStatus === 'Partial' || raw.paymentStatus === 'Unpaid' || paymentHistory.length > 0;
      const paidAmount = isCredit
        ? Math.min(amount, paymentHistory.reduce((sum: number, p: any) => sum + Math.max(0, Number(p.amount || 0)), 0))
        : (raw.paidAmount != null ? Number(raw.paidAmount) : amount);
      const outstandingAmount = Math.max(0, amount - paidAmount);
      const paymentStatus: Expense['paymentStatus'] = outstandingAmount <= 0 ? 'Paid' : paidAmount > 0 ? 'Partial' : 'Unpaid';

      return {
        ...raw,
        id: raw.id || raw._id,
        _mongoId: raw._id || raw.id,
        expenseNumber: raw.expenseNumber || `EXP-${String(raw.id || raw._id || Date.now()).slice(-4)}`,
        createdAt: raw.createdAt || new Date().toISOString(),
        paymentMethod: (isCredit ? 'Credit' : (raw.paymentMethod || 'Cash')) as Expense['paymentMethod'],
        paymentHistory,
        paidAmount,
        outstandingAmount,
        paymentStatus,
      };
    });
  },

  /**
   * Loads all expenses from database.
   */
  async loadExpensesFromServer(): Promise<Expense[]> {
    return this.getExpenses();
  },

  /**
   * One-time migration: sends all localStorage expenses to database.
   * Safe to call multiple times — backend skips already-migrated records.
   */
  async migrateExpensesTodatabase(): Promise<{ inserted: number; skipped: number } | null> {
    const localExpenses = (() => {
      try {
        const data = localStorage.getItem(STORAGE_KEYS.EXPENSES);
        return data ? JSON.parse(data) : [];
      } catch { return []; }
    })();

    if (!localExpenses.length) {
      console.info('[storageService] No local expenses to migrate.');
      return { inserted: 0, skipped: 0 };
    }

    const result = await apiService.bulkUpsertExpenses(localExpenses);
    if (result) {
      console.info(`[storageService] 📦 Migration complete: ${result.inserted} inserted, ${result.skipped} skipped.`);
      localStorage.setItem('pg_expenses_migrated', new Date().toISOString());
      // Remove migrated local expenses so localStorage is not used as duplicate storage
      localStorage.removeItem(STORAGE_KEYS.EXPENSES);
    }
    return result;
  },

  /**
   * Save (create or update) an expense in database.
   * Data flow: Frontend -> Node.js API -> database
   */
  async saveExpense(expenseData: Omit<Expense, 'id' | 'createdAt'> & { id?: string }): Promise<Expense> {
    const amount = Math.max(0, Number(expenseData.amount || 0));
    const history = Array.isArray(expenseData.paymentHistory) ? expenseData.paymentHistory : [];
    const isCredit = expenseData.paymentMethod === 'Credit' || expenseData.paymentStatus === 'Credit' || expenseData.paymentStatus === 'Partial' || expenseData.paymentStatus === 'Unpaid' || history.length > 0;
    const paidAmount = isCredit ? Math.min(amount, history.reduce((sum, payment) => sum + Math.max(0, Number(payment.amount || 0)), 0)) : amount;
    const outstandingAmount = Math.max(0, amount - paidAmount);
    const paymentStatus: Expense['paymentStatus'] = outstandingAmount <= 0 ? 'Paid' : paidAmount > 0 ? 'Partial' : 'Unpaid';

    const payload = {
      ...expenseData,
      amount,
      paidAmount,
      outstandingAmount,
      paymentMethod: isCredit ? 'Credit' : (expenseData.paymentMethod || 'Cash'),
      paymentStatus,
    };

    if (expenseData.id) {
      const mongoId = (expenseData as any)._mongoId || expenseData.id;
      const updated = await apiService.updateExpense(mongoId, payload);
      return {
        ...updated,
        id: updated.id || updated._id || expenseData.id,
        _mongoId: updated._id || mongoId,
      };
    }

    const newPayload = {
      ...payload,
      expenseNumber: expenseData.expenseNumber || `EXP-${String(Date.now()).slice(-4)}`,
      createdAt: new Date().toISOString(),
    };
    const created = await apiService.createExpense(newPayload);
    return {
      ...created,
      id: created.id || created._id,
      _mongoId: created._id,
    };
  },

  /**
   * Record a payment against an expense in database.
   */
  async recordExpensePayment(
    expenseId: string,
    paymentData: {
      amount: number;
      method: 'Cash' | 'Online' | 'Bank';
      paidAt: string;
      notes?: string;
      paidBy?: string;
      receipt?: { id: string; name: string; type: string; size: number }
    }
  ): Promise<Expense> {
    const amount = Math.max(0, Number(paymentData.amount || 0));
    if (!amount) throw new Error('Enter an amount greater than zero.');
    const updated = await apiService.recordExpensePayment(expenseId, paymentData);
    return {
      ...updated,
      id: updated.id || updated._id || expenseId,
      _mongoId: updated._id,
    };
  },

  /**
   * Delete an expense from database.
   */
  async deleteExpense(id: string): Promise<boolean> {
    return apiService.deleteExpense(id);
  },

  _customerCache: null as Customer[] | null,
  _customerCacheLoading: false,

  async loadCustomersFromServer(): Promise<Customer[]> {
    if (this._customerCacheLoading) return this._customerCache || [];
    this._customerCacheLoading = true;
    try {
      await this.migrateCustomersTodatabase();
      const serverCustomers = await apiService.getCustomers({ limit: 2000 });
      this._customerCache = serverCustomers.map((raw: any) => ({
        ...raw,
        id: raw._id || raw.localId || raw.id,
      }));
    } catch (e) {
      console.error('Failed to load customers from database:', e);
      if (!this._customerCache) this._customerCache = [];
    } finally {
      this._customerCacheLoading = false;
    }
    return this._customerCache;
  },

  async migrateCustomersTodatabase(): Promise<{ inserted: number; updated: number } | null> {
    const localCustomers = (() => {
      try {
        const data = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
        return data ? JSON.parse(data) : [];
      } catch { return []; }
    })();
    if (!localCustomers.length) return { inserted: 0, updated: 0 };
    const result = await apiService.bulkUpsertCustomers(localCustomers);
    if (result) {
      localStorage.setItem('pg_customers_migrated', new Date().toISOString());
      localStorage.removeItem(STORAGE_KEYS.CUSTOMERS);
    }
    return result;
  },

  // Customers CRUD
  getCustomers(): Customer[] {
    if (Array.isArray(this._customerCache)) {
      return this._customerCache;
    }
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this._customerCache = parsed;
          this.loadCustomersFromServer();
          return this._customerCache;
        }
      }
    } catch (e) {}
    this.loadCustomersFromServer();
    return [];
  },

  getCustomerById(id: string): Customer | undefined {
    return this.getCustomers().find((c) => c.id === id || (c as any)._id === id);
  },

  saveCustomer(customerData: Omit<Customer, 'id' | 'createdAt'> & { id?: string }): Customer {
    const customers = this.getCustomers();
    const now = new Date().toISOString();
    let targetCustomer: Customer;
    if (customerData.id) {
      const index = customers.findIndex((c) => c.id === customerData.id || (c as any)._id === customerData.id);
      if (index !== -1) {
        const updated = { ...customers[index], ...customerData, updatedAt: now };
        customers[index] = updated;
        this._customerCache = customers;
        targetCustomer = updated;
      } else {
        targetCustomer = {
          ...customerData,
          id: customerData.id,
          createdAt: now,
          updatedAt: now,
        } as Customer;
        customers.unshift(targetCustomer);
        this._customerCache = customers;
      }
    } else {
      const newCustomer: Customer = {
        ...customerData,
        id: 'cust-' + Date.now(),
        createdAt: now,
        updatedAt: now,
      } as Customer;
      customers.unshift(newCustomer);
      this._customerCache = customers;
      targetCustomer = newCustomer;
    }

    const syncId = (targetCustomer as any)._id || (targetCustomer.id && !targetCustomer.id.startsWith('cust-') ? targetCustomer.id : null);
    if (syncId) {
      apiService.updateCustomer(syncId, targetCustomer).catch(err => {
        console.error('Backend offline: Failed to save customer to database:', err);
        if (typeof window !== 'undefined' && window.alert) {
          window.alert('Backend is offline. Unable to save customer to database.');
        }
      });
    } else {
      const payload = { ...targetCustomer, localId: targetCustomer.id };
      delete (payload as any)._id;
      delete (payload as any).id;
      apiService.createCustomer(payload).then(saved => {
        if (saved && (saved._id || saved.id)) {
          const normalized = { ...saved, id: saved._id || saved.localId || saved.id };
          if (Array.isArray(this._customerCache)) {
            const idx = this._customerCache.findIndex(x => (normalized as any)._id === (x as any)._id || x.id === normalized.id);
            if (idx !== -1) {
              this._customerCache[idx] = { ...this._customerCache[idx], ...normalized };
            }
          }
        }
      }).catch(err => {
        console.error('Backend offline: Failed to save customer to database:', err);
        if (typeof window !== 'undefined' && window.alert) {
          window.alert('Backend is offline. Unable to save customer to database.');
        }
      });
    }

    return targetCustomer;
  },

  deleteCustomer(id: string): void {
    const target = this.getCustomerById(id);
    const targetId = (target as any)?._id || target?.id || id;
    this._customerCache = this.getCustomers().filter((c) => c.id !== id && (c as any)._id !== id);
    if (this._pricingCache) {
      this._pricingCache = this._pricingCache.filter((p) => p.customerId !== id);
    }
    apiService.deleteCustomer(targetId).catch(err => {
      console.error('Backend offline: Failed to delete customer from database:', err);
    });
    apiService.deleteCustomerPrice({ customerId: id }).catch(console.warn);
  },

  _productCache: null as MasterProduct[] | null,
  _productCacheLoading: false,

  async loadProductsFromServer(): Promise<MasterProduct[]> {
    if (this._productCacheLoading) return this._productCache || [];
    this._productCacheLoading = true;
    try {
      await this.migrateProductsTodatabase();
      const serverProducts = await apiService.getProducts({ limit: 2000 });
      this._productCache = serverProducts.map((raw: any) => ({
        ...raw,
        id: raw._id || raw.localId || raw.id,
      }));
    } catch (e) {
      console.error('Failed to load products from database:', e);
      if (!this._productCache) this._productCache = [];
    } finally {
      this._productCacheLoading = false;
    }
    return this._productCache;
  },

  async migrateProductsTodatabase(): Promise<{ inserted: number; updated: number } | null> {
    const localProducts = (() => {
      try {
        const data = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
        return data ? JSON.parse(data) : [];
      } catch { return []; }
    })();
    if (!localProducts.length) return { inserted: 0, updated: 0 };
    const result = await apiService.bulkUpsertProducts(localProducts);
    if (result) {
      localStorage.setItem('pg_products_migrated', new Date().toISOString());
      localStorage.removeItem(STORAGE_KEYS.PRODUCTS);
    }
    return result;
  },

  // Master Products CRUD
  getProducts(): MasterProduct[] {
    if (Array.isArray(this._productCache)) {
      return this._productCache;
    }
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this._productCache = parsed;
          this.loadProductsFromServer();
          return this._productCache;
        }
      }
    } catch (e) {}
    this.loadProductsFromServer();
    return [];
  },

  getProductById(id: string): MasterProduct | undefined {
    return this.getProducts().find((p) => p.id === id || (p as any)._id === id);
  },

  saveProduct(productData: Omit<MasterProduct, 'id' | 'createdAt'> & { id?: string }): MasterProduct {
    const products = this.getProducts();
    const now = new Date().toISOString();
    let targetProduct: MasterProduct;
    if (productData.id) {
      const index = products.findIndex((p) => p.id === productData.id || (p as any)._id === productData.id);
      if (index !== -1) {
        const updated = { ...products[index], ...productData, updatedAt: now };
        products[index] = updated;
        this._productCache = products;
        targetProduct = updated;
      } else {
        targetProduct = {
          ...productData,
          id: productData.id,
          createdAt: now,
          updatedAt: now,
        } as MasterProduct;
        products.unshift(targetProduct);
        this._productCache = products;
      }
    } else {
      const newProduct: MasterProduct = {
        ...productData,
        id: 'prod-' + Date.now(),
        createdAt: now,
        updatedAt: now,
      } as MasterProduct;
      products.unshift(newProduct);
      this._productCache = products;
      targetProduct = newProduct;
    }

    const syncId = (targetProduct as any)._id || (targetProduct.id && !targetProduct.id.startsWith('prod-') ? targetProduct.id : null);
    if (syncId) {
      apiService.updateProduct(syncId, targetProduct).catch(err => {
        console.error('Backend offline: Failed to save product to database:', err);
        if (typeof window !== 'undefined' && window.alert) {
          window.alert('Backend is offline. Unable to save product to database.');
        }
      });
    } else {
      const payload = { ...targetProduct, localId: targetProduct.id };
      delete (payload as any)._id;
      delete (payload as any).id;
      apiService.createProduct(payload).then(saved => {
        if (saved && (saved._id || saved.id)) {
          const normalized = { ...saved, id: saved._id || saved.localId || saved.id };
          if (Array.isArray(this._productCache)) {
            const idx = this._productCache.findIndex(x => (normalized as any)._id === (x as any)._id || x.id === normalized.id);
            if (idx !== -1) {
              this._productCache[idx] = { ...this._productCache[idx], ...normalized };
            }
          }
        }
      }).catch(err => {
        console.error('Backend offline: Failed to save product to database:', err);
        if (typeof window !== 'undefined' && window.alert) {
          window.alert('Backend is offline. Unable to save product to database.');
        }
      });
    }

    return targetProduct;
  },

  deleteProduct(id: string): void {
    const target = this.getProductById(id);
    const targetId = (target as any)?._id || target?.id || id;
    this._productCache = this.getProducts().filter((p) => p.id !== id && (p as any)._id !== id);
    if (this._pricingCache) {
      this._pricingCache = this._pricingCache.filter((p) => p.productId !== id);
    }
    apiService.deleteProduct(targetId).catch(err => {
      console.error('Backend offline: Failed to delete product from database:', err);
    });
    apiService.deleteCustomerPrice({ productId: id }).catch(console.warn);
  },

  _pricingCache: null as CustomerPricing[] | null,
  _pricingCacheLoading: false,

  async loadPricingFromServer(): Promise<CustomerPricing[]> {
    if (this._pricingCacheLoading) return this._pricingCache || [];
    this._pricingCacheLoading = true;
    try {
      await this.migratePricingTodatabase();
      const serverPricing = await apiService.getPricing({ limit: 5000 });
      this._pricingCache = serverPricing.map((raw: any) => ({
        ...raw,
        id: raw._id || raw.id,
      }));
    } catch (e) {
      console.error('Failed to load pricing from database:', e);
      if (!this._pricingCache) this._pricingCache = [];
    } finally {
      this._pricingCacheLoading = false;
    }
    return this._pricingCache;
  },

  async migratePricingTodatabase(): Promise<{ inserted: number; updated: number } | null> {
    const localPricing = (() => {
      try {
        const data = localStorage.getItem(STORAGE_KEYS.PRICING);
        return data ? JSON.parse(data) : [];
      } catch { return []; }
    })();
    if (!localPricing.length) return { inserted: 0, updated: 0 };
    const result = await apiService.bulkUpsertPricing(localPricing);
    if (result) {
      localStorage.setItem('pg_pricing_migrated', new Date().toISOString());
      localStorage.removeItem(STORAGE_KEYS.PRICING);
    }
    return result;
  },

  // Customer Specific Pricing
  getAllCustomerPricing(): CustomerPricing[] {
    if (Array.isArray(this._pricingCache)) {
      return this._pricingCache;
    }
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PRICING);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this._pricingCache = parsed;
          this.loadPricingFromServer();
          return this._pricingCache;
        }
      }
    } catch (e) {}
    this.loadPricingFromServer();
    return [];
  },

  getCustomerPricingMap(customerId: string): Map<string, number> {
    const list = this.getAllCustomerPricing().filter((p) => p.customerId === customerId);
    const map = new Map<string, number>();
    list.forEach((item) => {
      map.set(item.productId, item.customPrice);
    });
    return map;
  },

  setCustomerPrice(customerId: string, productId: string, customPrice: number): CustomerPricing {
    const pricingList = this.getAllCustomerPricing();
    const existingIndex = pricingList.findIndex(
      (p) => p.customerId === customerId && p.productId === productId
    );

    let savedItem: CustomerPricing;
    if (existingIndex !== -1) {
      pricingList[existingIndex].customPrice = customPrice;
      pricingList[existingIndex].updatedAt = new Date().toISOString();
      savedItem = pricingList[existingIndex];
    } else {
      const newItem: CustomerPricing = {
        id: 'cp-' + Date.now(),
        customerId,
        productId,
        customPrice,
        updatedAt: new Date().toISOString(),
      };
      pricingList.push(newItem);
      savedItem = newItem;
    }
    this._pricingCache = pricingList;

    apiService.setCustomerPrice({ customerId, productId, customPrice }).catch(err => {
      console.error('Backend offline: Failed to save customer price to database:', err);
      if (typeof window !== 'undefined' && window.alert) {
        window.alert('Backend is offline. Unable to save pricing override.');
      }
    });

    return savedItem;
  },

  removeCustomerPrice(customerId: string, productId: string): void {
    if (Array.isArray(this._pricingCache)) {
      this._pricingCache = this._pricingCache.filter(
        (p) => !(p.customerId === customerId && p.productId === productId)
      );
    }
    apiService.deleteCustomerPrice({ customerId, productId }).catch(err => {
      console.error('Backend offline: Failed to delete pricing override from database:', err);
    });
  },

  getEffectiveProductPrice(productId: string, customerId?: string): { price: number; isCustom: boolean } {
    const product = this.getProductById(productId);
    if (!product) return { price: 0, isCustom: false };

    if (customerId) {
      const pricingMap = this.getCustomerPricingMap(customerId);
      if (pricingMap.has(productId)) {
        return {
          price: pricingMap.get(productId)!,
          isCustom: true,
        };
      }
    }

    return {
      price: product.defaultPrice,
      isCustom: false,
    };
  },

  _orderCache: null as Order[] | null,
  _orderCacheLoading: false,

  normalizeOrder(raw: any): Order {
    if (!raw) return raw;
    const id = raw._id || raw.id || raw.localId;
    let next: Order = {
      ...raw,
      id,
      _id: raw._id || id,
      localId: raw.localId || raw.id || id,
    };
    if ((next.status as string) === 'Waiting for Customer') next.status = 'In Design';
    if ((next.status as string) === 'Completed') next.status = 'Ready';
    if (next.paymentMethod === 'Cash') next.paymentMethod = 'Pay';
    if (/^ORD-\d+$/i.test(next.orderNumber || '')) {
      next.orderNumber = String(next.orderNumber).replace(/^ORD-/i, 'JOB-');
    }
    return next;
  },

  async loadAllDataFromServer(): Promise<any[]> {
    const results = await Promise.allSettled([
      this.loadCustomersFromServer(),
      this.loadProductsFromServer(),
      this.loadPricingFromServer(),
      this.loadOrdersFromServer(),
      this.loadExpensesFromServer(),
    ]);
    localStorage.setItem('pg_migrated_to_mongodb', 'true');
    return results;
  },

  async migrateAllDataTodatabase(): Promise<void> {
    await Promise.allSettled([
      this.migrateCustomersTodatabase(),
      this.migrateProductsTodatabase(),
      this.migratePricingTodatabase(),
      this.migrateOrdersTodatabase(),
      this.migrateExpensesTodatabase(),
    ]);
    localStorage.setItem('pg_migrated_to_mongodb', 'true');
  },

  async loadOrdersFromServer(): Promise<Order[]> {
    if (this._orderCacheLoading) return this._orderCache || [];
    this._orderCacheLoading = true;

    // 1. One-time migration of any legacy orders in localStorage to database
    try {
      const d = localStorage.getItem(STORAGE_KEYS.ORDERS);
      const localOrders = d ? JSON.parse(d) : [];
      if (Array.isArray(localOrders) && localOrders.length > 0) {
        await apiService.bulkUpsertOrders(localOrders);
        localStorage.removeItem(STORAGE_KEYS.ORDERS);
      }
    } catch (e) {
      console.warn('Orders migration error:', e);
    }

    // 2. Fetch all orders from database
    try {
      const serverOrders = await apiService.getOrders({ limit: 1000 });
      this._orderCache = serverOrders.map((raw: any) => this.normalizeOrder(raw));
    } catch (e) {
      console.error('Failed to load orders from database:', e);
      if (!this._orderCache) this._orderCache = [];
    } finally {
      this._orderCacheLoading = false;
    }

    return this._orderCache;
  },

  async migrateOrdersTodatabase(): Promise<{ inserted: number; updated: number } | null> {
    const localOrders = (() => {
      try {
        const data = localStorage.getItem(STORAGE_KEYS.ORDERS);
        return data ? JSON.parse(data) : [];
      } catch { return []; }
    })();

    if (!localOrders.length) {
      return { inserted: 0, updated: 0 };
    }

    const result = await apiService.bulkUpsertOrders(localOrders);
    if (result) {
      localStorage.setItem('pg_orders_migrated', new Date().toISOString());
      localStorage.removeItem(STORAGE_KEYS.ORDERS);
    }
    return result;
  },

  // Orders CRUD
  getOrders(): Order[] {
    if (Array.isArray(this._orderCache)) {
      return this._orderCache;
    }
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ORDERS);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this._orderCache = parsed.map((o: any) => this.normalizeOrder(o));
          void this.loadOrdersFromServer();
          return this._orderCache;
        }
      }
    } catch (e) {}
    void this.loadOrdersFromServer();
    return [];
  },

  getOrderById(id: string): Order | undefined {
    return this.getOrders().find((o) => o.id === id || (o as any)._id === id);
  },

  getOrdersByCustomerId(customerId: string): Order[] {
    return this.getOrders().filter((o) => o.customerId === customerId);
  },

  generateNextOrderNumber(): string {
    const orders = this.getOrders();
    const settings = this.getSettings();
    const prefix = settings.jobPrefix || 'JOB-';
    let maxNum = 1042;
    orders.forEach((o) => {
      const match = o.orderNumber.match(/(?:ORD|JOB)-(\d+)/i);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    });
    return `${prefix}${maxNum + 1}`;
  },

  generateNextInvoiceNumber(): string {
    const orders = this.getOrders();
    const settings = this.getSettings();
    const prefix = settings.invoicePrefix || 'INV-';
    let maxNum = settings.invoiceStartNumber || 1000;
    orders.forEach((o) => {
      const match = (o.invoiceNumber || '').match(/INV-(\d+)/i);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    });
    return `${prefix}${maxNum + 1}`;
  },

  getTeam() {
    const settings = this.getSettings();
    return settings.team || [
      { id: 'tm-1', name: 'Rabin Bista', jobTitle: 'Super Admin' },
      { id: 'tm-2', name: 'Dipak Sharma', jobTitle: 'Designer' },
      { id: 'tm-3', name: 'Pooja Dahal', jobTitle: 'Printer' },
      { id: 'tm-4', name: 'Laxman Giri', jobTitle: 'Logistics' }
    ];
  },

  saveOrder(orderData: Omit<Order, 'id' | 'createdAt' | 'updatedAt' | 'orderNumber'> & { id?: string; orderNumber?: string; _id?: string }): Order {
    const orders = this.getOrders();
    const now = new Date().toISOString();
    let targetOrder: Order;

    if (orderData.id || orderData._id) {
      const targetId = orderData.id || orderData._id;
      const index = orders.findIndex((o) => o.id === targetId || (o as any)._id === targetId || (o.orderNumber && o.orderNumber === orderData.orderNumber));
      if (index !== -1) {
        const existing = orders[index];
        const updated: Order = {
          ...existing,
          ...orderData,
          updatedAt: now,
        };
        orders[index] = updated;
        this._orderCache = orders;
        targetOrder = updated;
      } else {
        targetOrder = {
          ...orderData,
          id: orderData.id || 'ord-' + Date.now(),
          orderNumber: orderData.orderNumber || this.generateNextOrderNumber(),
          createdAt: now,
          updatedAt: now,
        } as Order;
        orders.unshift(targetOrder);
        this._orderCache = orders;
      }
    } else {
      const clientOrdId = 'ord-' + Date.now();
      const newOrder: Order = {
        ...orderData,
        id: clientOrdId,
        orderNumber: orderData.orderNumber || this.generateNextOrderNumber(),
        createdAt: now,
        updatedAt: now,
      } as Order;
      orders.unshift(newOrder);
      this._orderCache = orders;
      targetOrder = newOrder;
    }

    // Sync to database
    const syncId = (targetOrder as any)._id || (targetOrder.id && !targetOrder.id.startsWith('ord-') ? targetOrder.id : null);
    if (!syncId) {
      const payload = { ...targetOrder, localId: targetOrder.id };
      delete (payload as any)._id;
      delete (payload as any).id;
      apiService.createOrder(payload).then(saved => {
        if (saved && (saved._id || saved.id)) {
          const normalized = this.normalizeOrder(saved);
          if (Array.isArray(this._orderCache)) {
            const idx = this._orderCache.findIndex(x => (normalized as any)._id === (x as any)._id || x.id === normalized.id || x.orderNumber === normalized.orderNumber);
            if (idx !== -1) {
              this._orderCache[idx] = { ...this._orderCache[idx], ...normalized };
            }
          }
        }
      }).catch(console.warn);
    } else {
      apiService.updateOrder(syncId, targetOrder).catch(console.warn);
    }

    return targetOrder;
  },

  deleteOrder(orderId: string): void {
    const remaining = this.getOrders().filter((order) => order.id !== orderId && (order as any)._id !== orderId);
    this._orderCache = remaining;
    apiService.deleteOrder(orderId).catch(console.warn);
  },

  updateOrderStatus(orderId: string, status: OrderStatus, paymentMethod?: PaymentMethod): Order | undefined {
    const orders = this.getOrders();
    const index = orders.findIndex((o) => o.id === orderId || (o as any)._id === orderId);
    if (index === -1) return undefined;

    orders[index].status = status;
    if (paymentMethod !== undefined) orders[index].paymentMethod = paymentMethod;
    const now = new Date().toISOString();
    if ((status === 'Ready' || status === 'Done') && !orders[index].completedAt) orders[index].completedAt = now;
    orders[index].updatedAt = now;

    // Automatic Cloudinary Cleanup for Reference Files (Design Done) & All Files (Delivered/Pickup/Done)
    const isDeliveredOrDone = ['Delivery', 'Pickup', 'Delivered', 'Done'].includes(status);
    const isDesignCompleted = ['Printing', 'Finishing', 'Ready', 'Done', 'Pickup', 'Delivery'].includes(status);

    if (Array.isArray(orders[index].media) && orders[index].media!.length > 0) {
      orders[index].media = orders[index].media!.map((m) => {
        const isRef = m.category === 'Client Reference' || m.category === 'Reference';
        if ((isDeliveredOrDone || (isDesignCompleted && isRef)) && (m as any).cloudinaryPublicId && !(m as any).isDeletedFromCloud) {
          fetch('http://localhost:3001/api/upload/file', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ publicId: (m as any).cloudinaryPublicId, resourceType: (m as any).resourceType || 'image' }),
          }).catch(console.warn);

          return {
            ...m,
            isDeletedFromCloud: true,
            deletedFromCloudAt: now,
          };
        }
        return m;
      });
    }

    this._orderCache = orders;

    // Notify backend
    apiService.updateOrderStatus(orderId, status, { paymentMethod, media: orders[index].media }).catch(console.warn);

    return orders[index];
  },

  completeOrderWithPayment(orderId: string, paymentMethod: PaymentMethod, receivedAmount = 0): Order | undefined {
    const order = this.getOrders().find(item => item.id === orderId);
    if (!order) return undefined;
    const normalizedMethod: PaymentMethod = paymentMethod === 'Cash' ? 'Pay' : paymentMethod;
    const total = Math.max(0, Number(order.totalAmount || 0));
    const received = normalizedMethod === 'Credit' ? 0 : Math.min(total, Math.max(0, Number(receivedAmount || 0)));
    const due = Math.max(0, total - received);
    const receivedAt = new Date().toISOString();
    const completed = this.updateOrderStatus(orderId, 'Ready', due > 0 ? 'Credit' : normalizedMethod);
    if (!completed) return undefined;
    return this.saveOrder({
      ...completed,
      paymentMethod: due > 0 ? 'Credit' : normalizedMethod,
      paymentStatus: due <= 0 ? 'Paid' : received > 0 ? 'Partial' : 'Credit',
      paymentHistory: received > 0 ? [{
        id: `pay-${Date.now()}`,
        transactionId: `txn-${Date.now()}`,
        amount: received,
        method: normalizedMethod === 'Online' ? 'Online' : 'Pay',
        receivedAt,
        note: 'Received when order was marked Done / Ready',
        isCompletionPayment: true
      }] : [],
      initialPaymentMethod: normalizedMethod,
      initialReceivedAmount: received
    });
  },

  sendWhatsAppStatusUpdate(order: Order, newStatus: OrderStatus, triggerType: 'new_order' | 'status_update' = 'status_update') {
    const customer = this.getCustomerById(order.customerId);
    const phone = customer?.whatsapp || customer?.phone || order.customerWhatsapp || order.customerPhone || '';
    const cleanPhone = String(phone).replace(/\D/g, '');
    if (!cleanPhone) {
      console.warn('WhatsApp number missing for this company.');
      return { ok: false, reason: 'missing_phone' };
    }

    const companyName = (customer?.businessName?.trim() || order.customerName || 'Customer').trim();
    const productName = (order.items || []).map((it) => it.productName).filter(Boolean).join(', ') || 'Print Order';
    const jobNumber = order.orderNumber || '';
    const price = this.formatCurrency(order.totalAmount || 0).replace(/^Rs\.\s*/, '');
    const status = newStatus;

    let message = '';
    if (triggerType === 'new_order' || status === 'New') {
      message = `Hello ${companyName} 👋\n\nYour order has been placed successfully.\n\nJob No: ${jobNumber}\nProduct: ${productName}\nPrice: Rs. ${price}\n\nWe’ll keep you updated as your order progresses.\n\nThank you for choosing PrintGhar.\n– PrintGhar`;
    } else if (status === 'In Design') {
      message = `Hello ${companyName} 👋\nYour order is now in the *Designing Stage* 🎨\nJob No: ${jobNumber}\nProduct: ${productName}\nOur team is currently working on your design. We’ll keep you updated as your order progresses.\nThank you for choosing PrintGhar.\n– PrintGhar`;
    } else if (status === 'Printing') {
      message = `Hello ${companyName} 👋\nYour order is now in the *Printing Stage* 🖨️\nJob No: ${jobNumber}\nProduct: ${productName}\nOur team is currently printing your order. We’ll keep you updated as your order progresses.\nThank you for choosing PrintGhar.\n– PrintGhar`;
    } else if (status === 'Finishing') {
      message = `Hello ${companyName} 👋\nYour order is now in the *Finishing Stage* ✂️\nJob No: ${jobNumber}\nProduct: ${productName}\nOur team is currently completing the finishing work on your order. We’ll keep you updated as your order progresses.\nThank you for choosing PrintGhar.\n– PrintGhar`;
    } else if (status === 'Done') {
      message = `Hello ${companyName} 👋\nYour order is now *Complete* ✅\nJob No: ${jobNumber}\nProduct: ${productName}\nYour order has been completed successfully and is ready for the next step.\nThank you for choosing PrintGhar.\n– PrintGhar`;
    } else {
      message = `Hello ${companyName} 👋\nYour order status has been updated to *${status}*.\nJob No: ${jobNumber}\nProduct: ${productName}\nThank you for choosing PrintGhar.\n– PrintGhar`;
    }

    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
    return { ok: true };
  },

  getOrderPaymentHistory(order: Order) {
    return Array.isArray(order.paymentHistory) ? order.paymentHistory : [];
  },

  getOrderPaidAmount(order: Order): number {
    const history = this.getOrderPaymentHistory(order);
    if (history.length > 0) {
      return history.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    }
    if (order.paymentMethod && ['Pay', 'Cash', 'Online'].includes(order.paymentMethod)) {
      return Number(order.totalAmount || 0);
    }
    return 0;
  },

  getOrderCreditAmount(order: Order): number {
    const total = Number(order.totalAmount || 0);
    const paid = this.getOrderPaidAmount(order);
    return Math.max(0, total - paid);
  },

  getClientBalanceSheet(customer: Customer | undefined, allCustomerOrders: Order[], options: { periodLabel?: string; jobDateFilter?: string; ledgerType?: string; dateMode?: 'AD' | 'BS' } = {}) {
    const { periodLabel = '', jobDateFilter = 'ALL', ledgerType = 'ALL', dateMode } = options;
    const activeDateMode = dateMode || this.getSettings().dateMode || 'AD';

    const completedOrders = (allCustomerOrders || []).filter(o => 
      o.customerId === customer?.id && 
      o.status !== 'Cancelled' && 
      ['Done', 'Ready', 'Payment', 'Pickup', 'Delivery'].includes(o.status)
    );

    const getEntryDateKey = (dateStr?: string) => {
      if (!dateStr) return '';
      return dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    };

    const getMonthKey = (dateKey?: string) => {
      const rawKey = getEntryDateKey(dateKey);
      return activeDateMode === 'BS' 
        ? this.getADandBSDate(rawKey).bsFormatted.slice(0, 7) 
        : String(rawKey || '').slice(0, 7);
    };

    const allEntries: any[] = [];

    // 1. Invoices from completed orders
    completedOrders.forEach(order => {
      const invoiceStamp = order.completedAt || order.createdAt || `${order.orderDate || new Date().toISOString().split('T')[0]}T00:00:00`;
      const orderDateKey = order.orderDate || (invoiceStamp ? invoiceStamp.slice(0, 10) : new Date().toISOString().split('T')[0]);
      const products = (order.items || []).map(i => `${i.productName || 'Product'}${i.itemDescription ? ` — ${i.itemDescription}` : ''}${i.quantity ? ` (${i.quantity} ${i.unit || 'pcs'})` : ''}`).join('; ') || 'Print Order';
      const rawTotal = Math.max(0, Number(order.totalAmount || 0));
      const isImmediatePaid = ['Pay', 'Cash', 'Online'].includes(String(order.paymentMethod || '')) && !(order.paymentHistory || []).length;
      const completionReceived = isImmediatePaid
        ? rawTotal
        : Math.min(rawTotal, Math.max(0, Number(order.initialReceivedAmount ?? (order.paymentHistory || []).filter(payment => payment.isCompletionPayment).reduce((sum, payment) => sum + Number(payment.amount || 0), 0))));
      const completionDue = Math.max(0, rawTotal - completionReceived);
      const completionMethod = order.initialPaymentMethod || order.paymentHistory?.find(payment => payment.isCompletionPayment)?.method || order.paymentMethod;

      allEntries.push({
        id: `inv-${order.id}`,
        orderId: order.id,
        timestamp: invoiceStamp,
        date: orderDateKey,
        monthKey: getMonthKey(orderDateKey),
        type: 'invoice',
        reference: order.orderNumber || 'Invoice',
        particulars: products,
        debit: rawTotal,
        credit: completionReceived,
        amount: rawTotal,
        billedAmount: completionDue,
        receivedAmount: completionReceived,
        paymentMethod: completionMethod,
        method: completionMethod === 'Online' ? 'Online' : completionReceived > 0 ? 'Cash' : 'Credit',
        items: order.items || [],
        order: order
      });

      // 2. Payments on orders
      const history = this.getOrderPaymentHistory(order);
      if (history.length > 0) {
        history.filter(payment => !payment.isCompletionPayment && !(order.initialReceivedAmount != null && payment.note === 'Received when order was marked Done / Ready')).forEach((payment, pIndex) => {
          const pStamp = payment.receivedAt || invoiceStamp;
          const pDateKey = pStamp.slice(0, 10);
          allEntries.push({
            id: `pay-${order.id}-${payment.id || pIndex}`,
            orderId: order.id,
            timestamp: pStamp,
            date: pDateKey,
            monthKey: getMonthKey(pDateKey),
            type: 'payment',
            reference: order.orderNumber || 'Payment',
            particulars: `Payment received (${payment.method === 'Online' ? 'Online' : 'Cash'})${payment.note ? ` — ${payment.note}` : ''}`,
            debit: 0,
            credit: Math.max(0, Number(payment.amount || 0)),
            method: payment.method === 'Online' ? 'Online' : 'Cash',
            receipt: payment.receipt || null,
            note: payment.note || '',
            order: order
          });
        });
      }
    });

    // 3. Direct customer advances
    (Array.isArray(customer?.advanceHistory) ? customer.advanceHistory : []).forEach((adv, advIndex) => {
      const advStamp = adv.receivedAt || new Date().toISOString();
      const advDateKey = advStamp.slice(0, 10);
      allEntries.push({
        id: `adv-${adv.transactionId || advIndex}`,
        timestamp: advStamp,
        date: advDateKey,
        monthKey: getMonthKey(advDateKey),
        type: 'advance',
        reference: 'ADVANCE',
        particulars: `Advance deposit received (${adv.method === 'Online' ? 'Online' : 'Cash'})${adv.note ? ` — ${adv.note}` : ''}`,
        debit: 0,
        credit: Math.max(0, Number(adv.amount || 0)),
        method: adv.method === 'Online' ? 'Online' : 'Cash',
        receipt: adv.receipt || null,
        note: adv.note || ''
      });
    });

    // Chronological sort ascending
    allEntries.sort((a, b) => {
      const cmp = String(a.date || '').localeCompare(String(b.date || '')) || String(a.timestamp || '').localeCompare(String(b.timestamp || ''));
      if (cmp !== 0) return cmp;
      if (a.type === 'invoice' && b.type !== 'invoice') return -1;
      if (a.type !== 'invoice' && b.type === 'invoice') return 1;
      return 0;
    });

    // Filter partition
    const nowMs = Date.now();
    let isPeriodFiltered = false;
    let priorEntries: any[] = [];
    let periodEntries: any[] = [];

    if (periodLabel && periodLabel !== 'ALL') {
      isPeriodFiltered = true;
      allEntries.forEach(entry => {
        if (entry.monthKey < periodLabel) {
          priorEntries.push(entry);
        } else if (entry.monthKey === periodLabel) {
          periodEntries.push(entry);
        }
      });
    } else if (jobDateFilter === 'WEEK') {
      isPeriodFiltered = true;
      const weekAgo = new Date(nowMs - 7 * 86400000).toISOString().split('T')[0];
      allEntries.forEach(entry => {
        if (entry.date < weekAgo) {
          priorEntries.push(entry);
        } else {
          periodEntries.push(entry);
        }
      });
    } else if (jobDateFilter === 'MONTH') {
      isPeriodFiltered = true;
      const currentMonthPrefix = new Date().toISOString().slice(0, 7);
      allEntries.forEach(entry => {
        if (entry.date.slice(0, 7) < currentMonthPrefix) {
          priorEntries.push(entry);
        } else if (entry.date.slice(0, 7) === currentMonthPrefix) {
          periodEntries.push(entry);
        }
      });
    } else {
      periodEntries = [...allEntries];
    }

    // Opening Balance B/F
    const openingDebit = priorEntries.reduce((sum, e) => sum + Number(e.debit || 0), 0);
    const openingCredit = priorEntries.reduce((sum, e) => sum + Number(e.credit || 0), 0);
    const openingBalance = openingDebit - openingCredit;

    // Running balance
    let running = openingBalance;
    periodEntries.forEach(entry => {
      running += Number(entry.debit || 0) - Number(entry.credit || 0);
      entry.runningBalance = running;
    });

    const periodTotalDebit = periodEntries.reduce((sum, e) => sum + Number(e.debit || 0), 0);
    const periodTotalCredit = periodEntries.reduce((sum, e) => sum + Number(e.credit || 0), 0);
    const periodCashPaid = periodEntries.filter(e => e.method === 'Cash' || (e.type === 'payment' && !e.method)).reduce((sum, e) => sum + Number(e.credit || 0), 0);
    const periodOnlinePaid = periodEntries.filter(e => e.method === 'Online').reduce((sum, e) => sum + Number(e.credit || 0), 0);
    const periodAdvancePaid = periodEntries.filter(e => e.type === 'advance').reduce((sum, e) => sum + Number(e.credit || 0), 0);
    const closingBalance = openingBalance + periodTotalDebit - periodTotalCredit;

    // Ledger Type Filtering
    let visibleEntries = [...periodEntries];
    if (ledgerType === 'CREDIT') {
      visibleEntries = periodEntries.filter(e => e.type === 'invoice' && e.debit > 0);
    } else if (ledgerType === 'PAYMENT') {
      visibleEntries = periodEntries.filter(e => e.type === 'payment' || e.type === 'advance');
    }

    return {
      allEntries,
      priorEntries,
      periodEntries,
      visibleEntries,
      isPeriodFiltered,
      openingBalance,
      openingDebit,
      openingCredit,
      periodTotalDebit,
      periodTotalCredit,
      periodCashPaid,
      periodOnlinePaid,
      periodAdvancePaid,
      closingBalance,
      completedOrders
    };
  },

  sendWhatsAppStatement(client: Customer, statementData: { periodLabel?: string; openingBalance?: number; periodTotalDebit?: number; periodTotalCredit?: number; closingBalance?: number }) {
    const phone = client?.whatsapp || client?.phone || '';
    const cleanPhone = String(phone).replace(/\D/g, '');
    if (!cleanPhone) {
      alert('WhatsApp number is missing for this client.');
      return { ok: false, reason: 'missing_phone' };
    }
    const clientName = client?.businessName || client?.name || 'Valued Client';
    const shop = this.getSettings();
    const shopName = shop.shopName || 'Print Ghar';

    const period = statementData?.periodLabel || 'All History';
    const opening = Number(statementData?.openingBalance || 0);
    const debit = Number(statementData?.periodTotalDebit || 0);
    const credit = Number(statementData?.periodTotalCredit || 0);
    const closing = Number(statementData?.closingBalance || 0);

    const openingStr = opening !== 0 ? (opening > 0 ? `${this.formatCurrency(opening)} Dr. (Due)` : `${this.formatCurrency(Math.abs(opening))} Cr. (Adv)`) : 'Rs. 0.00 (Settled)';
    const closingStr = closing !== 0 ? (closing > 0 ? `*${this.formatCurrency(closing)} NET DUE*` : `*${this.formatCurrency(Math.abs(closing))} ADVANCE BALANCE*`) : '*FULLY SETTLED*';

    const message = `*${shopName.toUpperCase()} — STATEMENT OF ACCOUNT*\n\n` +
      `Hello *${clientName}* 👋\n` +
      `Here is your account summary and balance sheet:\n\n` +
      `📅 *Period:* ${period}\n` +
      `📥 *Opening Balance (B/F):* ${openingStr}\n` +
      `📊 *Total Invoiced (Debit):* ${this.formatCurrency(debit)}\n` +
      `💰 *Total Paid / Recd (Credit):* ${this.formatCurrency(credit)}\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `⚖️ *Closing Balance:* ${closingStr}\n\n` +
      `Thank you for your business!\n` +
      `– *${shopName}*`;

    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
    return { ok: true };
  },

  exportJobsToExcel(customerName: string, orders: Order[], periodLabel?: string, customer: Customer | null = null) {
    const symbol = this.getSettings().currencySymbol || 'Rs.';
    const headers = ["Date", "BS Date", "Entry Type", "Job / Reference", "Particulars", "Payment Method", `Debit / Bill (${symbol})`, `Credit / Received (${symbol})`, `Running Balance (${symbol})`, "Receipt Photo"];
    
    const allOrders = customer?.id ? this.getOrdersByCustomerId(customer.id) : orders;
    const sheet = this.getClientBalanceSheet(customer || undefined, allOrders, { periodLabel });

    const escapeCsv = (val: any) => {
      const str = String(val ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows: string[][] = [];
    if (sheet.isPeriodFiltered || sheet.openingBalance !== 0) {
      rows.push([
        escapeCsv('—'),
        escapeCsv('—'),
        escapeCsv('OPENING B/F'),
        escapeCsv('OPENING'),
        escapeCsv(`Opening Balance Brought Forward (Prior balance before ${periodLabel || 'period'})`),
        escapeCsv('—'),
        escapeCsv(sheet.openingBalance > 0 ? sheet.openingBalance : ''),
        escapeCsv(sheet.openingBalance < 0 ? Math.abs(sheet.openingBalance) : ''),
        escapeCsv(sheet.openingBalance),
        escapeCsv('')
      ]);
    }

    sheet.visibleEntries.forEach(entry => {
      const dates = this.getADandBSDate(entry.date || '');
      rows.push([
        escapeCsv(entry.date || ''),
        escapeCsv(dates.bsFormatted),
        escapeCsv(entry.type === 'invoice' ? 'Invoice (Job)' : (entry.type === 'advance' ? 'Advance Deposit' : 'Payment Received')),
        escapeCsv(entry.reference),
        escapeCsv(entry.particulars),
        escapeCsv(entry.method || (entry.type === 'invoice' ? (entry.paymentMethod || '') : '')),
        escapeCsv(entry.debit || ''),
        escapeCsv(entry.credit || ''),
        escapeCsv(entry.runningBalance),
        escapeCsv(entry.receipt?.name || '')
      ]);
    });

    rows.push([
      escapeCsv('TOTALS'),
      escapeCsv(''),
      escapeCsv('SUMMARY'),
      escapeCsv(''),
      escapeCsv(`Period Total Invoiced vs Received | Net Closing Balance: ${sheet.closingBalance}`),
      escapeCsv(''),
      escapeCsv(sheet.periodTotalDebit),
      escapeCsv(sheet.periodTotalCredit),
      escapeCsv(sheet.closingBalance),
      escapeCsv('')
    ]);

    const csv = "\uFEFF" + [headers.map(escapeCsv).join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${customerName.replace(/[^a-zA-Z0-9]/g, '_')}_Balance_Sheet_${periodLabel || 'All_History'}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  },

  exportClientLedgerPDF(customer: Customer | undefined, orders: Order[], periodLabel?: string, ledgerType?: string) {
    const shop = this.getSettings();
    const customerName = customer?.businessName || customer?.name || 'Client';
    const customerContact = customer?.phone || customer?.whatsapp || customer?.email || 'No contact';
    const typeLabels: Record<string, string> = { ALL: 'Full Balance Sheet & Ledger', CREDIT: 'Debit / Invoices Only', PAYMENT: 'Credit / Payments Only' };
    const reportType = typeLabels[ledgerType || 'ALL'] || typeLabels.ALL;

    const allOrders = customer?.id ? this.getOrdersByCustomerId(customer.id) : orders;
    const sheet = this.getClientBalanceSheet(customer, allOrders, {
      periodLabel: periodLabel || '',
      ledgerType: ledgerType || 'ALL'
    });

    const currency = shop.currencySymbol || 'Rs.';
    const opening = sheet.openingBalance;
    const billedTotal = sheet.periodTotalDebit;
    const paidTotal = sheet.periodTotalCredit;
    const closingDue = sheet.closingBalance;
    const advanceHeld = Number(customer?.advanceBalance || 0);

    const escapeHtml = (str: any) => {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };

    let rowsHtml = '';
    if (sheet.isPeriodFiltered || opening !== 0) {
      rowsHtml += `
        <tr style="background:#f1f5f9;font-weight:bold;">
          <td style="text-align:center;">—</td>
          <td>—</td>
          <td><b>OPENING B/F</b></td>
          <td>Opening Balance Brought Forward (Prior balance before ${escapeHtml(periodLabel || 'period')})</td>
          <td class="money debit">${opening > 0 ? escapeHtml(this.formatCurrency(opening)) : '—'}</td>
          <td class="money paid">${opening < 0 ? escapeHtml(this.formatCurrency(Math.abs(opening))) : '—'}</td>
          <td class="money ${opening > 0 ? 'credit' : (opening < 0 ? 'advance' : '')}">
            ${escapeHtml(this.formatCurrency(Math.abs(opening)))}${opening > 0 ? ' Dr.' : (opening < 0 ? ' Cr.' : '')}
          </td>
        </tr>
      `;
    }

    sheet.visibleEntries.forEach((entry, index) => {
      const dates = this.getADandBSDate(entry.date || '');
      const isDr = entry.runningBalance > 0;
      const isCr = entry.runningBalance < 0;

      let particularsHtml = '';
      if (entry.type === 'invoice') {
        let items = entry.items && entry.items.length > 0 ? entry.items : (entry.order?.items || []);
        if (!items || items.length === 0) {
          const splitItems = String(entry.particulars || '').split(';').map(s => s.trim()).filter(Boolean);
          if (splitItems.length > 1) {
            items = splitItems.map((raw: string) => {
              const match = raw.match(/^(.*?)(?:\s*\(([^)]+)\))?$/);
              return {
                productName: match ? match[1].trim() : raw,
                quantity: match && match[2] ? match[2] : '',
                unit: ''
              };
            });
          }
        }

        if (items && items.length > 0) {
          const itemsList = items.map((item: any) => {
            const name = escapeHtml(item.productName || 'Product');
            const desc = item.itemDescription ? `<span class="pdf-item-desc">— ${escapeHtml(item.itemDescription)}</span>` : '';
            const qtyStr = item.quantity ? (item.unit ? `${item.quantity} ${item.unit}` : String(item.quantity)) : '';
            const qty = qtyStr ? `<span class="pdf-item-qty">${escapeHtml(qtyStr)}</span>` : '';
            return `<div class="pdf-item-row"><span class="pdf-item-bullet">•</span> <span class="pdf-item-name">${name}</span> ${desc} ${qty}</div>`;
          }).join('');

          particularsHtml = `
            <div class="pdf-particulars">
              <div class="pdf-job-meta-row">
                <span class="pdf-count-badge">${items.length} item${items.length === 1 ? '' : 's'}</span>
                ${entry.paymentMethod ? `<span class="pdf-method-tag">${escapeHtml(entry.paymentMethod === 'Pay' ? 'Cash' : entry.paymentMethod)}</span>` : ''}
              </div>
              <div class="pdf-items-list">${itemsList}</div>
            </div>
          `;
        } else {
          particularsHtml = `<div class="pdf-item-name" style="font-weight:700;">${escapeHtml(entry.particulars)}</div>`;
        }
      } else if (entry.type === 'payment') {
        particularsHtml = `
          <div class="pdf-payment-block">
            <span class="pdf-badge ${entry.method === 'Online' ? 'pdf-badge-online' : 'pdf-badge-cash'}">✓ Payment Received (${escapeHtml(entry.method || 'Cash')})</span>
            ${entry.note ? `<div class="pdf-note">Note: ${escapeHtml(entry.note)}</div>` : ''}
          </div>
        `;
      } else if (entry.type === 'advance') {
        particularsHtml = `
          <div class="pdf-advance-block">
            <span class="pdf-badge pdf-badge-advance">★ Advance Deposit (${escapeHtml(entry.method || 'Cash')})</span>
            ${entry.note ? `<div class="pdf-note">Note: ${escapeHtml(entry.note)}</div>` : ''}
          </div>
        `;
      } else {
        particularsHtml = escapeHtml(entry.particulars);
      }

      rowsHtml += `
        <tr class="${entry.type}">
          <td style="text-align:center;font-weight:700;color:#64748b;">${index + 1}</td>
          <td style="white-space:nowrap;">
            <div style="font-weight:800;color:#0f172a;">${escapeHtml(entry.date || '')}</div>
            <div style="color:#64748b;font-size:8.5px;font-weight:600;margin-top:2px;">${escapeHtml(dates.bsFormatted)}</div>
          </td>
          <td style="white-space:nowrap;">
            <span class="pdf-ref-badge">${escapeHtml(entry.reference)}</span>
          </td>
          <td>${particularsHtml}</td>
          <td class="money debit">${entry.debit ? escapeHtml(this.formatCurrency(entry.debit)) : '—'}</td>
          <td class="money paid">${entry.credit ? escapeHtml(this.formatCurrency(entry.credit)) : '—'}</td>
          <td class="money ${isDr ? 'credit' : (isCr ? 'advance' : '')}">
            ${escapeHtml(this.formatCurrency(Math.abs(entry.runningBalance)))}${isDr ? ' Dr.' : (isCr ? ' Cr.' : '')}
          </td>
        </tr>
      `;
    });

    const html = `<!doctype html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Balance Sheet & Ledger — ${escapeHtml(customerName)}</title>
      <style>
        @page { size: A4 landscape; margin: 8mm 10mm; }
        * { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: #0f172a; margin: 0 auto; max-width: 277mm; font-size: 10px; line-height: 1.4; }
        .head { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #4f46e5; padding-bottom: 12px; }
        .title { font-size: 22px; font-weight: 900; color: #0f172a; letter-spacing: -0.02em; }
        .brand { font-size: 11px; font-weight: 800; color: #4f46e5; margin-top: 4px; text-transform: uppercase; }
        .meta { font-size: 10px; color: #64748b; margin-top: 4px; }
        .summary { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin: 12px 0; }
        .box { border: 1px solid #dbe3ef; border-radius: 8px; padding: 8px 10px; background: #f8fafc; }
        .box small { display: block; text-transform: uppercase; color: #64748b; font-weight: 800; font-size: 8px; letter-spacing: .05em; }
        .box strong { display: block; font-size: 13px; font-weight: 900; margin-top: 3px; font-family: monospace; }
        .box.due { background: #fff1f2; border-color: #fecdd3; color: #be123c; }
        .box.advance { background: #eef2ff; border-color: #c7d2fe; color: #4338ca; }
        .box.paid { background: #ecfdf5; border-color: #a7f3d0; color: #047857; }
        
        table { width: 100%; border-collapse: collapse; font-size: 9.5px; }
        thead { display: table-header-group; }
        th { background: #0f172a; color: #fff; text-align: left; padding: 8px 10px; text-transform: uppercase; font-size: 8.5px; font-weight: 800; letter-spacing: .05em; }
        td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
        .money { text-align: right; font-weight: 800; white-space: nowrap; font-family: monospace; font-size: 10.5px; }
        .invoice td { background: #fff; }
        .payment td { background: #f0fdf4; }
        .advance td { background: #f5f3ff; }
        .paid { color: #047857; }
        .credit { color: #be123c; }
        .debit { color: #1e293b; font-weight: 800; }
        
        .pdf-particulars { display: flex; flex-direction: column; gap: 4px; }
        .pdf-job-meta-row { display: flex; align-items: center; gap: 6px; margin-bottom: 2px; }
        .pdf-count-badge { font-size: 8px; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; background: #eef2ff; color: #4338ca; padding: 1px 6px; border-radius: 4px; border: 1px solid #c7d2fe; }
        .pdf-method-tag { font-size: 8.5px; font-weight: 700; color: #64748b; }
        .pdf-items-list { display: flex; flex-direction: column; gap: 3px; }
        .pdf-item-row { display: flex; align-items: baseline; gap: 6px; font-size: 9.5px; line-height: 1.35; }
        .pdf-item-bullet { color: #4f46e5; font-weight: 900; font-size: 11px; flex-shrink: 0; }
        .pdf-item-name { font-weight: 700; color: #0f172a; }
        .pdf-item-desc { color: #64748b; font-size: 8.5px; font-weight: normal; }
        .pdf-item-qty { margin-left: auto; display: inline-block; padding: 1px 6px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 4px; font-family: monospace; font-weight: 800; font-size: 8.5px; color: #334155; white-space: nowrap; flex-shrink: 0; }
        
        .pdf-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: .03em; }
        .pdf-badge-cash { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
        .pdf-badge-online { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
        .pdf-badge-advance { background: #f5f3ff; color: #6d28d9; border: 1px solid #ddd6fe; }
        .pdf-note { font-size: 8.5px; color: #64748b; font-style: italic; margin-top: 3px; }
        .pdf-ref-badge { display: inline-block; padding: 2px 6px; background: #f8fafc; color: #4338ca; border: 1px solid #e0e7ff; border-radius: 4px; font-family: monospace; font-weight: 800; font-size: 10px; }

        .totals-row td { background: #0f172a !important; color: #fff !important; font-weight: 900; font-size: 10px; }
        .closing-section { display: flex; justify-content: space-between; align-items: center; margin-top: 14px; }
        .closing-box { border: 2px solid #e11d48; border-radius: 9px; background: #fff1f2; padding: 10px 14px; display: flex; align-items: center; gap: 14px; }
        .closing-box span { font-size: 10px; font-weight: 900; text-transform: uppercase; color: #9f1239; }
        .closing-box strong { font-size: 18px; color: #be123c; font-family: monospace; }
        .stamp-box { border: 1px dashed #cbd5e1; border-radius: 8px; padding: 10px 20px; text-align: center; color: #64748b; font-size: 9px; min-width: 50mm; }
        .foot { margin-top: 10px; border-top: 1px solid #cbd5e1; padding-top: 6px; text-align: center; font-size: 8px; color: #64748b; }
        @media print { body { max-width: none; } tr { break-inside: avoid; } }
      </style>
    </head>
    <body>
      <div class="head">
        <div>
          <div class="title">STATEMENT OF ACCOUNT / BALANCE SHEET</div>
          <div class="brand">${escapeHtml(shop.shopName || 'Print Ghar')} • ${escapeHtml(reportType)}</div>
          <div class="meta">Statement Period: <b>${escapeHtml(String(periodLabel || 'All History'))}</b> • Generated: ${escapeHtml(this.displayDate(new Date().toISOString().split('T')[0]))}</div>
        </div>
        <div style="text-align:right;">
          <b style="font-size:13px;">${escapeHtml(customerName)}</b>
          <div class="meta">${escapeHtml(customerContact)}</div>
          ${customer?.address ? `<div class="meta">${escapeHtml(customer.address)}</div>` : ''}
        </div>
      </div>
      <div class="summary">
        <div class="box">
          <small>Opening Balance (B/F)</small>
          <strong>${opening > 0 ? `${escapeHtml(this.formatCurrency(opening))} Dr.` : (opening < 0 ? `${escapeHtml(this.formatCurrency(Math.abs(opening)))} Cr.` : 'Rs. 0.00')}</strong>
        </div>
        <div class="box">
          <small>Total Invoiced (Debit)</small>
          <strong>${escapeHtml(this.formatCurrency(billedTotal))}</strong>
        </div>
        <div class="box paid">
          <small>Total Received (Credit)</small>
          <strong>${escapeHtml(this.formatCurrency(paidTotal))}</strong>
        </div>
        <div class="box ${closingDue > 0 ? 'due' : 'paid'}">
          <small>Net Closing Balance</small>
          <strong>${closingDue > 0 ? `${escapeHtml(this.formatCurrency(closingDue))} Due (Dr.)` : (closingDue < 0 ? `${escapeHtml(this.formatCurrency(Math.abs(closingDue)))} Adv (Cr.)` : 'Settled (Rs. 0)')}</strong>
        </div>
        <div class="box advance">
          <small>Advance Held</small>
          <strong>${escapeHtml(this.formatCurrency(advanceHeld))}</strong>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th style="width:30px;text-align:center;">S.N.</th>
            <th style="width:90px;">Date</th>
            <th style="width:100px;">Job / Ref #</th>
            <th>Particulars / Description</th>
            <th style="width:105px;text-align:right;">Debit / Bill (${escapeHtml(currency)})</th>
            <th style="width:105px;text-align:right;">Credit / Recd (${escapeHtml(currency)})</th>
            <th style="width:115px;text-align:right;">Running Balance</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || '<tr><td colspan="7" style="text-align:center;padding:24px">No ledger entries found for this selection.</td></tr>'}
        </tbody>
        <tfoot>
          <tr class="totals-row">
            <td colspan="4" style="text-align:right;text-transform:uppercase;padding:8px 10px;">Period Summary Totals:</td>
            <td class="money" style="padding:8px 10px;">${escapeHtml(this.formatCurrency(billedTotal))}</td>
            <td class="money" style="padding:8px 10px;">${escapeHtml(this.formatCurrency(paidTotal))}</td>
            <td class="money" style="padding:8px 10px;">${closingDue > 0 ? `${escapeHtml(this.formatCurrency(closingDue))} Dr.` : (closingDue < 0 ? `${escapeHtml(this.formatCurrency(Math.abs(closingDue)))} Cr.` : 'Rs. 0.00')}</td>
          </tr>
        </tfoot>
      </table>
      <div class="closing-section">
        <div class="closing-box">
          <span>Closing Account Position:</span>
          <strong>${closingDue > 0 ? `${escapeHtml(this.formatCurrency(closingDue))} NET DUE` : (closingDue < 0 ? `${escapeHtml(this.formatCurrency(Math.abs(closingDue)))} ADVANCE BALANCE` : 'FULLY SETTLED')}</strong>
        </div>
        <div class="stamp-box">
          Authorized Signature / Stamp
        </div>
      </div>
      <div class="foot">A4 Landscape Statement • Generated by ${escapeHtml(shop.shopName || 'Print Ghar')} Balance Sheet System</div>
    </body>
    </html>`;

    const reportWindow = window.open('', '_blank', 'width=1200,height=900');
    if (!reportWindow) { alert('PDF window blocked. Please allow pop-ups and try again.'); return false; }
    reportWindow.document.open(); reportWindow.document.write(html); reportWindow.document.close(); reportWindow.focus();
    setTimeout(() => { try { reportWindow.print(); } catch (error) { console.error(error); } }, 180);
    return true;
  },

  async getFinancialLedgerData(options: {
    month?: string;
    fromDate?: string;
    toDate?: string;
    search?: string;
    typeFilter?: 'ALL' | 'JOB' | 'EXPENSE' | 'STOCKING' | 'PAYMENT' | 'CREDIT_PAID';
    designerFilter?: string;
    paymentMethodFilter?: string;
    dateMode?: 'AD' | 'BS';
  } = {}): Promise<FinancialLedgerData> {
    const settings = this.getSettings();
    const dateMode = options.dateMode || settings.dateMode || 'AD';
    const fromDate = options.fromDate || '';
    const toDate = options.toDate || '';
    const month = options.month || '';
    const search = String(options.search || '').trim().toLowerCase();
    const typeFilter = options.typeFilter || 'ALL';
    const designerFilter = options.designerFilter || 'ALL';
    const paymentMethodFilter = options.paymentMethodFilter || 'ALL';

    // Orders are recognised by the financial ledger only after the job is
    // completed. New and production-stage orders remain operational records.
    const financialOrderStatuses: OrderStatus[] = ['Done', 'Ready', 'Pickup', 'Delivery'];
    const allOrders = this.getOrders().filter(o => financialOrderStatuses.includes(o.status));
    const allExpenses = await this.getExpenses();
    const allStockItems = typeof (this as any).getStock === 'function' ? (this as any).getStock() : [];

    const getEntryDateKey = (dateStr?: string) => {
      if (!dateStr) return '';
      return dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    };

    const getMonthKey = (dateKey: string) => {
      const rawKey = getEntryDateKey(dateKey);
      return dateMode === 'BS' 
        ? this.getADandBSDate(rawKey).bsFormatted.slice(0, 7) 
        : String(rawKey || '').slice(0, 7);
    };

    const allEntries: FinancialLedgerEntry[] = [];

    // 1. Job records
    allOrders.forEach(order => {
      const invoiceStamp = order.completedAt || order.createdAt || `${order.orderDate || new Date().toISOString().split('T')[0]}T00:00:00`;
      const orderDateKey = order.orderDate || getEntryDateKey(invoiceStamp);
      const readyDateKey = order.completedAt ? order.completedAt.slice(0, 10) : '';
      const partyName = order.orderContactName 
        ? `${order.orderContactName}${order.orderContactPhone ? ` (${order.orderContactPhone})` : ''}` 
        : (order.customerName || 'Walk-in Client');
      const formatOrderProductDetails = (items: any[] | undefined): string => {
        if (!items || items.length === 0) return 'Print Order';
        if (items.length === 1) {
          const it = items[0];
          const qty = it.quantity ? ` (${it.quantity} ${it.unit || 'pcs'})` : '';
          return `${it.productName || 'Print Item'}${qty}`;
        }
        const count = items.length;
        const firstItems = items.slice(0, 3).map(i => i.productName || 'Item').join(', ');
        const remaining = count - 3;
        return `${count} items • ${firstItems}${remaining > 0 ? ` +${remaining} more` : ''}`;
      };
      const products = formatOrderProductDetails(order.items);
      const amount = Math.max(0, Number(order.totalAmount || 0));
      const hasRecordedPayments = Array.isArray(order.paymentHistory) && order.paymentHistory.length > 0;
      const isImmediatePayment = !hasRecordedPayments && ['Pay', 'Cash', 'Online'].includes(String(order.paymentMethod || ''));

      const matches = [...String(order.notes || '').matchAll(/\[Stage Reverted.*?• Mistake by:\s*([^•\]]+)(?:• Reason:\s*([^\]]+))?\]/gi)];
      const mistakeBy = matches.length > 0
        ? matches.map(m => `${m[1].trim()}${m[2] ? ' (' + m[2].trim() + ')' : ''}`).join('; ')
        : '—';

      allEntries.push({
        id: `job-${order.id}`,
        type: 'job',
        date: orderDateKey,
        readyDate: readyDateKey,
        monthKey: getMonthKey(orderDateKey),
        jobNo: order.orderNumber || '—',
        partyName,
        details: products,
        payment: hasRecordedPayments
          ? (new Set(order.paymentHistory!.map(payment => payment.method === 'Online' ? 'Online' : 'Cash')).size > 1
            ? 'Multiple'
            : (order.paymentHistory![0]?.method === 'Online' ? 'Online' : 'Cash'))
          : order.paymentStatus === 'Credit' ? 'Credit' : order.paymentMethod === 'Pay' ? 'Cash' : (order.paymentMethod || 'Cash'),
        designer: order.designerName || '—',
        printing: order.printedBy || order.printerName || '—',
        mistakeBy,
          drAmount: 0,
        crAmount: isImmediatePayment ? amount : 0,
          receivedCredit: 0,
          creditPaid: 0,
          timestamp: invoiceStamp
      });
    });

    // 2. Expense records
    allExpenses.forEach(expense => {
      const expenseDate = expense.date || new Date().toISOString().split('T')[0];
      const amount = Math.max(0, Number(expense.amount || 0));
      const isStocking = /material\s*stock|ink\s*&?\s*toner|raw\s*material|stocking|purchase/i.test(String(expense.category || ''));
      const expenseNumber = expense.expenseNumber || `EXP-${String(expense.id || '').replace(/\D/g, '').slice(-4).padStart(4, '0')}`;
      const isCreditExpense = expense.paymentMethod === 'Credit' || (expense.paymentHistory || []).length > 0 || ['Partial', 'Unpaid', 'Credit'].includes(String(expense.paymentStatus || ''));
      allEntries.push({
        id: `exp-${expense.id}`,
        type: isStocking ? 'stocking' : 'expense',
        date: expenseDate,
        readyDate: '—',
        monthKey: getMonthKey(expenseDate),
        jobNo: expenseNumber,
        partyName: expense.vendor || 'Vendor',
        details: expense.title || (expense as any).notes || 'Shop expense',
        payment: expense.paymentMethod || (isCreditExpense ? 'Credit' : 'Cash'),
        designer: '—',
        printing: '—',
        mistakeBy: '—',
        drAmount: isCreditExpense ? 0 : amount,
        crAmount: 0,
        receivedCredit: 0,
        creditPaid: 0,
        category: expense.category || 'Uncategorized',
        notes: expense.notes || '',
        status: expense.paymentStatus || 'Paid',
        paidBy: (expense as any).paidBy || '—',
        sourceId: expense.id,
        grossAmount: amount,
        quantity: Number((expense as any).quantity || 0),
        unit: (expense as any).unit || '',
        timestamp: expense.createdAt || `${expenseDate}T00:00:00`
      });

      // Every vendor-credit payment is a separate cash-out transaction.
      (expense.paymentHistory || []).forEach(payment => {
        const paidDate = getEntryDateKey(payment.paidAt);
        allEntries.push({
          id: `credit-paid-${expense.id}-${payment.id}`,
          type: 'credit-paid',
          date: paidDate,
          readyDate: 'â€”',
          monthKey: getMonthKey(paidDate),
          jobNo: payment.reference || `CP-${String(payment.id || '').replace(/\D/g, '').slice(-4).padStart(4, '0')}`,
          partyName: expense.vendor || 'Vendor',
          details: `Payment for ${expenseNumber}`,
          payment: payment.method || 'Cash',
          designer: 'â€”',
          printing: 'â€”',
          mistakeBy: 'â€”',
          drAmount: Math.max(0, Number(payment.amount || 0)),
          crAmount: 0,
          receivedCredit: 0,
          creditPaid: Math.max(0, Number(payment.amount || 0)),
          category: expense.category || 'Uncategorized',
          notes: payment.notes || '',
          status: 'Paid',
          paidBy: (expense as any).paidBy || '—',
          sourceId: expense.id,
          grossAmount: Math.max(0, Number(payment.amount || 0)),
          quantity: Number((expense as any).quantity || 0),
          unit: (expense as any).unit || '',
          timestamp: payment.paidAt
        });
      });
    });

    // 3. Received Credit Payment records
    if (typeof (this as any).getGroupedClientPayments === 'function') {
      (this as any).getGroupedClientPayments(allOrders).forEach((payment: any) => {
        if (payment.transactionId && !payment.transactionId.startsWith('legacy-')) {
          const paymentStamp = payment.receivedAt || new Date().toISOString();
          const paymentDateKey = getEntryDateKey(paymentStamp);
          const amount = Math.max(0, Number(payment.amount || 0));
          const jobRefs = payment.orderNumbers?.length ? payment.orderNumbers.join(', ') : (payment.allocations?.map((a: any) => a.orderNumber).filter(Boolean).join(', ') || 'credit jobs');
          const linkedOrder = allOrders.find(order => payment.orderNumbers?.includes(order.orderNumber));
          const customer = this.getCustomerById(payment.customerId || linkedOrder?.customerId);
          const party = customer?.businessName || customer?.name || 'Client Payment';

          allEntries.push({
            id: `pay-${payment.transactionId}`,
            type: 'payment',
            date: paymentDateKey,
            readyDate: '—',
            monthKey: getMonthKey(paymentDateKey),
            jobNo: payment.reference || `CR-${String(payment.transactionId || '').replace(/\D/g, '').slice(-4).padStart(4, '0')}`,
            partyName: party,
            details: payment.note ? `Received old credit (${jobRefs}) - ${payment.note}` : `Received old credit (${jobRefs})`,
            payment: payment.method === 'Online' ? 'Online' : 'Cash',
            designer: '—',
            printing: '—',
            mistakeBy: '—',
            drAmount: 0,
            crAmount: amount,
            receivedCredit: amount,
            creditPaid: 0,
            timestamp: paymentStamp
          });
        }
      });
    }

    // Inventory quantities are not cash flow by themselves. Existing stock
    // records enter the ledger only when they contain real purchase metadata.
    allStockItems.forEach((item: any) => {
      const amount = Math.max(0, Number(item.purchaseAmount ?? item.totalCost ?? item.cost ?? 0));
      if (!amount || item.sourceExpenseId) return;
      const purchaseStamp = item.purchasedAt || item.createdAt || new Date().toISOString();
      const purchaseDate = getEntryDateKey(purchaseStamp);
      allEntries.push({
        id: `stocking-${item.id}`,
        type: 'stocking',
        date: purchaseDate,
        readyDate: '—',
        monthKey: getMonthKey(purchaseDate),
        jobNo: item.purchaseNumber || `STK-${String(item.id || '').replace(/\D/g, '').slice(-4).padStart(4, '0')}`,
        partyName: item.vendor || item.supplier || 'Stock Supplier',
        details: `${item.name || 'Stock item'}${item.quantity ? ` (${item.quantity} ${item.unit || 'pcs'})` : ''}`,
        payment: item.paymentMethod || item.paymentStatus || 'Cash',
        designer: '—',
        printing: '—',
        mistakeBy: '—',
        drAmount: item.paymentStatus === 'Credit' ? 0 : amount,
        crAmount: 0,
        receivedCredit: 0,
        creditPaid: 0,
        category: item.purchaseType || item.category || 'Stocking',
        notes: item.notes || '',
        status: item.paymentStatus || 'Paid',
        paidBy: item.purchasedBy || '—',
        quantity: Number(item.quantity || 0),
        unit: item.unit || 'pcs',
        sourceId: item.id,
        grossAmount: amount,
        timestamp: purchaseStamp
      });
    });

    // Sort chronological ascending
    allEntries.sort((a, b) => {
      const cmp = String(a.date || '').localeCompare(String(b.date || '')) || String(a.timestamp || '').localeCompare(String(b.timestamp || ''));
      if (cmp !== 0) return cmp;
      if (a.type === 'job' && b.type !== 'job') return -1;
      if (a.type !== 'job' && b.type === 'job') return 1;
      return 0;
    });

    // Partition
    const priorEntries: FinancialLedgerEntry[] = [];
    let periodEntries: FinancialLedgerEntry[] = [];

    if (fromDate || toDate) {
      allEntries.forEach(entry => {
        const entryDate = getEntryDateKey(entry.date);
        if (fromDate && entryDate < fromDate) priorEntries.push(entry);
        else if ((!fromDate || entryDate >= fromDate) && (!toDate || entryDate <= toDate)) periodEntries.push(entry);
      });
    } else if (month && month !== 'ALL') {
      allEntries.forEach(entry => {
        if (entry.monthKey < month) priorEntries.push(entry);
        else if (entry.monthKey === month) periodEntries.push(entry);
      });
    } else {
      periodEntries = [...allEntries];
    }

    // Opening balance brought forward
    const initialCapital = Number(settings.openingBalance || 0);
    let runningBalance = initialCapital;
    priorEntries.forEach(entry => {
      runningBalance += Number(entry.crAmount || 0) - Number(entry.drAmount || 0);
    });
    const periodOpeningBalance = runningBalance;

    // Apply filters
    let visibleEntries = periodEntries.filter(entry => {
      if (typeFilter !== 'ALL') {
        if (typeFilter === 'JOB' && entry.type !== 'job') return false;
        if (typeFilter === 'EXPENSE' && entry.type !== 'expense') return false;
        if (typeFilter === 'STOCKING' && entry.type !== 'stocking') return false;
          if (typeFilter === 'PAYMENT' && entry.type !== 'payment') return false;
          if (typeFilter === 'CREDIT_PAID' && entry.type !== 'credit-paid') return false;
      }
      if (designerFilter !== 'ALL' && entry.designer !== designerFilter) return false;
      if (paymentMethodFilter !== 'ALL') {
        const payStr = String(entry.payment || '').toLowerCase();
        const filterStr = paymentMethodFilter.toLowerCase();
        if (filterStr === 'cash' && !payStr.includes('cash') && payStr !== 'pay') return false;
        if (filterStr === 'online' && !payStr.includes('online')) return false;
        if (filterStr === 'credit' && !payStr.includes('credit')) return false;
      }
      if (search) {
        const q = search;
        const match = String(entry.jobNo || '').toLowerCase().includes(q) ||
          String(entry.partyName || '').toLowerCase().includes(q) ||
          String(entry.details || '').toLowerCase().includes(q) ||
          String(entry.payment || '').toLowerCase().includes(q) ||
          String(entry.designer || '').toLowerCase().includes(q) ||
          String(entry.printing || '').toLowerCase().includes(q) ||
          String(entry.mistakeBy || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });

    // Compute the authoritative running balance before display filters are
    // applied, so search/designer/type filters never change ledger truth.
    let rowBal = periodOpeningBalance;
    const balancedEntries = periodEntries.map((entry, idx) => {
      rowBal += Number(entry.crAmount || 0) - Number(entry.drAmount || 0);
      return {
        ...entry,
        sn: idx + 1,
        runningBalance: rowBal
      };
    });
    const visibleIds = new Set(visibleEntries.map(entry => entry.id));
    visibleEntries = balancedEntries.filter(entry => visibleIds.has(entry.id));

    const totalJobIncome = periodEntries.filter(e => e.type === 'job').reduce((sum, e) => sum + Number(e.crAmount || 0), 0);
    const totalExpenses = periodEntries.filter(e => e.type === 'expense').reduce((sum, e) => sum + Number(e.drAmount || 0), 0);
    const totalReceivedCredit = periodEntries.filter(e => e.type === 'payment').reduce((sum, e) => sum + Number(e.receivedCredit || 0), 0);
    const totalCreditPaid = periodEntries.filter(e => e.type === 'credit-paid').reduce((sum, e) => sum + Number(e.creditPaid || 0), 0);
    const totalStocking = periodEntries.filter(e => e.type === 'stocking').reduce((sum, e) => sum + Number(e.drAmount || 0), 0);
    const totalInflow = periodEntries.reduce((sum, e) => sum + Number(e.crAmount || 0), 0);
    const totalOutflow = periodEntries.reduce((sum, e) => sum + Number(e.drAmount || 0), 0);
    const netCash = periodOpeningBalance + totalInflow - totalOutflow;

    const designers = Array.from(new Set(allOrders.map(o => o.designerName).filter(Boolean) as string[])).sort();

    return {
      allEntries,
      visibleEntries,
      periodEntries: balancedEntries,
      periodOpeningBalance,
      totalJobIncome,
      totalExpenses,
      totalReceivedCredit,
      totalCreditPaid,
      totalStocking,
      totalInflow,
      totalOutflow,
      currentBalance: netCash,
      netCash,
      designers,
      dateMode,
      fromDate,
      toDate,
      month
    };
  },

  createFinancialLedgerPdf(options: {
    fromDate: string;
    toDate: string;
    dateMode?: 'AD' | 'BS';
    month?: string;
    typeFilter?: 'ALL' | 'JOB' | 'EXPENSE' | 'STOCKING' | 'PAYMENT' | 'CREDIT_PAID';
    designerFilter?: string;
    search?: string;
  }) {
    const JsPdf = (window as any).jspdf?.jsPDF;
    if (!JsPdf) throw new Error('PDF generator is unavailable. Please reload Print Ghar and try again.');
    const fromDate = String(options.fromDate || '');
    const toDate = String(options.toDate || '');
    if (!fromDate || !toDate) throw new Error('Choose both From and To dates.');
    if (fromDate > toDate) throw new Error('From date cannot be after To date.');

    const settings = this.getSettings();
    const ledgerDateMode = options.dateMode === 'BS' ? 'BS' : (settings.dateMode || 'AD');
    const data = await this.getFinancialLedgerData({ ...options, fromDate, toDate, dateMode: ledgerDateMode });

    const doc = new JsPdf({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
    const pageWidth = 297;
    const left = 10;
    const right = pageWidth - 10; // 277mm usable
    const money = (value: number) => `Rs. ${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
    const displayDate = (dateKey: string) => typeof (this as any).formatDateForMode === 'function' ? (this as any).formatDateForMode(dateKey, ledgerDateMode) : this.displayDate(dateKey);
    const filenameDate = (dateKey: string) => displayDate(dateKey).replace(/ BS$/, '');
    const periodText = `${displayDate(fromDate)} to ${displayDate(toDate)}`;

    let columnX = left;
    const columns = [
      ['S.N.', 7], ['DATE', 17], ['READY DATE', 17], ['JOB #', 16],
      ['PARTY NAME', 27], ['DETAILS', 38], ['PAYMENT', 15], ['DESIGNER', 17],
      ['PRINTING', 17], ['MISTAKE BY', 16], ['DR AMOUNT', 22, true],
      ['CR AMOUNT', 22, true], ['BALANCE', 31, true]
    ].map(([label, width, alignRight]) => {
      const col = { label: String(label), x: columnX, w: Number(width), right: Boolean(alignRight) };
      columnX += col.w;
      return col;
    });

    const drawTableHeader = (y: number) => {
      doc.setFillColor(15, 23, 42);
      doc.rect(left, y, right - left, 7.5, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      columns.forEach(col => {
        doc.text(col.label, col.right ? col.x + col.w - 1.5 : col.x + 1.5, y + 5, col.right ? { align: 'right' } : undefined);
      });
      doc.setTextColor(15, 23, 42);
      return y + 7.5;
    };

    const drawContinuationHeader = (pageNumber: number) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text((settings.shopName || 'PRINT GHAR').toUpperCase(), left, 11);
      doc.setFontSize(8);
      doc.text('FINANCIAL LEDGER — CONTINUED', right, 11, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(`${periodText} | Page ${pageNumber}`, left, 16);
      return drawTableHeader(19);
    };

    // Header Title
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text((settings.shopName || 'PRINT GHAR').toUpperCase(), left, 13);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text('Quality Design & Printing • Financial Ledger & Audit Trail', left, 18);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text('FINANCIAL LEDGER', right, 13, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(`Selected Period: ${periodText}`, right, 18, { align: 'right' });
    doc.text(`Generated: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Kathmandu' })} NPT`, right, 22, { align: 'right' });

    // Summary KPI Boxes
    const summaryBoxes = [
      ['Opening Balance', data.periodOpeningBalance, [238, 242, 255, 79, 70, 229]],
      ['Total Inflow (Cr)', data.totalInflow, [239, 246, 255, 5, 150, 105]],
      ['Total Outflow (Dr)', data.totalOutflow, [255, 241, 242, 225, 29, 72]],
      ['Current Balance', data.currentBalance, data.currentBalance >= 0 ? [236, 253, 245, 5, 150, 105] : [255, 241, 242, 225, 29, 72]]
    ];

    const boxGap = 2.5;
    const boxWidth = (right - left - boxGap * 3) / 4;
    summaryBoxes.forEach(([label, value, colors], index) => {
      const x = left + index * (boxWidth + boxGap);
      const c = colors as number[];
      doc.setFillColor(c[0], c[1], c[2]);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(x, 26, boxWidth, 14, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.setTextColor(100, 116, 139);
      doc.text(String(label).toUpperCase(), x + 2.5, 30.5);
      doc.setFontSize(9);
      doc.setTextColor(c[3], c[4], c[5]);
      doc.text(money(Number(value || 0)), x + 2.5, 37);
    });

    let y = drawTableHeader(44);

    data.visibleEntries.forEach((entry, index) => {
      const detailLines = doc.splitTextToSize(entry.details || '—', 36).slice(0, 2);
      const partyLines = doc.splitTextToSize(entry.partyName || '—', 25).slice(0, 2);
      const rowHeight = Math.max(7.5, Math.max(detailLines.length, partyLines.length) * 3 + 2.5);

      if (y + rowHeight > 192) {
        doc.addPage();
        y = drawContinuationHeader(doc.getNumberOfPages());
      }

      if (entry.type === 'expense') {
        doc.setFillColor(255, 241, 242);
      } else if (entry.type === 'payment') {
        doc.setFillColor(245, 243, 255);
      } else {
        doc.setFillColor(255, 255, 255);
      }
      doc.rect(left, y, right - left, rowHeight, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.line(left, y + rowHeight, right, y + rowHeight);

      doc.setFontSize(6);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);

      doc.text(String(index + 1), columns[0].x + 1.5, y + 4.5);
      doc.setFont('helvetica', 'bold');
      doc.text(displayDate(entry.date), columns[1].x + 1.5, y + 4.5);
      doc.setFont('helvetica', 'normal');
      doc.text(entry.readyDate ? displayDate(entry.readyDate) : '—', columns[2].x + 1.5, y + 4.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(79, 70, 229);
      doc.text(entry.jobNo || '—', columns[3].x + 1.5, y + 4.5, { maxWidth: columns[3].w - 3 });
      doc.setTextColor(15, 23, 42);
      doc.text(partyLines, columns[4].x + 1.5, y + 3.8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(detailLines, columns[5].x + 1.5, y + 3.8);
      doc.text(entry.payment || '—', columns[6].x + 1.5, y + 4.5, { maxWidth: columns[6].w - 3 });
      doc.text(entry.designer || '—', columns[7].x + 1.5, y + 4.5, { maxWidth: columns[7].w - 3 });
      doc.text(entry.printing || '—', columns[8].x + 1.5, y + 4.5, { maxWidth: columns[8].w - 3 });
      doc.setTextColor(entry.mistakeBy !== '—' ? 225 : 71, entry.mistakeBy !== '—' ? 29 : 85, entry.mistakeBy !== '—' ? 72 : 105);
      doc.text(entry.mistakeBy || '—', columns[9].x + 1.5, y + 4.5, { maxWidth: columns[9].w - 3 });

      // Dr Amount (Red)
      doc.setFont('courier', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(225, 29, 72);
      doc.text(entry.drAmount > 0 ? money(entry.drAmount) : '—', columns[10].x + columns[10].w - 1.5, y + 4.5, { align: 'right' });

      // Cr Amount (Green)
      doc.setTextColor(5, 150, 105);
      doc.text(entry.crAmount > 0 ? money(entry.crAmount) : '—', columns[11].x + columns[11].w - 1.5, y + 4.5, { align: 'right' });

      // Authoritative running balance
      doc.setTextColor(15, 23, 42);
      doc.text(money(entry.runningBalance || 0), columns[12].x + columns[12].w - 1.5, y + 4.5, { align: 'right' });

      y += rowHeight;
    });

    const pageCount = doc.getNumberOfPages();
    for (let page = 1; page <= pageCount; page++) {
      doc.setPage(page);
      doc.setDrawColor(226, 232, 240);
      doc.line(left, 198, right, 198);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`${settings.shopName || 'Print Ghar'} | Financial Ledger generated by Print Ghar Management System`, left, 203);
      doc.text(`Page ${page} of ${pageCount}`, right, 203, { align: 'right' });
    }

    const filename = `Print-Ghar-Financial-Ledger-${filenameDate(fromDate)}-to-${filenameDate(toDate)}.pdf`;
    return { blob: doc.output('blob') as Blob, filename, fromDate, toDate, data };
  },

  async exportFinancialLedgerCSV(options: {
    fromDate?: string;
    toDate?: string;
    month?: string;
    typeFilter?: 'ALL' | 'JOB' | 'EXPENSE' | 'STOCKING' | 'PAYMENT' | 'CREDIT_PAID';
    designerFilter?: string;
    search?: string;
    paymentMethodFilter?: string;
    dateMode?: 'AD' | 'BS';
  }) {
    const settings = this.getSettings();
    const ledgerDateMode = options.dateMode === 'BS' ? 'BS' : (settings.dateMode || 'AD');
    const data = await this.getFinancialLedgerData({ ...options, dateMode: ledgerDateMode });

    const escapeCsv = (val: any) => {
      const s = String(val ?? '').replace(/"/g, '""');
      return `"${s}"`;
    };

    const headers = [
      'S.N.',
      `Date (${ledgerDateMode})`,
      'Ready Date',
      'Transaction Type',
      'Job / Voucher No',
      'Party Name / Client / Vendor',
      'Details / Products',
      'Payment Method',
      'Designer',
      'Printing',
      'Mistake By',
      'Dr Amount / Outflow (Rs)',
      'Cr Amount / Inflow (Rs)',
      'Received Credit (Rs)',
      'Running Balance (Rs)'
    ];

    const rows = data.visibleEntries.map((e, idx) => [
      idx + 1,
      this.formatDateForMode(e.date, ledgerDateMode),
      e.readyDate && e.readyDate !== '—' ? this.formatDateForMode(e.readyDate, ledgerDateMode) : '—',
      e.type ? e.type.toUpperCase() : 'TRANSACTION',
      e.jobNo || '—',
      e.partyName || '—',
      e.details || '—',
      e.payment || '—',
      e.designer || '—',
      e.printing || '—',
      e.mistakeBy || '—',
      e.drAmount || 0,
      e.crAmount || 0,
      e.receivedCredit || 0,
      e.runningBalance || 0
    ].map(escapeCsv).join(','));

    const summaryMeta = [
      `# Financial Statement & All Transactions: ${settings.shopName || 'Print Ghar'}`,
      `# Selected Date Range: ${options.fromDate || 'All Time'} to ${options.toDate || 'Present'} (${ledgerDateMode})`,
      `# Generated On: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Kathmandu' })} NPT`,
      `# Period Opening Balance (Brought Forward): Rs. ${data.periodOpeningBalance}`,
      `# Total Job Sales Income: Rs. ${data.totalJobIncome}`,
      `# Total Received Credit Collections: Rs. ${data.totalReceivedCredit}`,
      `# Total Expenses Recorded: Rs. ${data.totalExpenses}`,
      `# Total Stocking Purchases: Rs. ${data.totalStocking}`,
      `# Total Cash Inflow: Rs. ${data.totalInflow}`,
      `# Total Cash Outflow: Rs. ${data.totalOutflow}`,
      `# Net Period Closing Balance: Rs. ${data.netCash}`,
      `# Total Transaction Records: ${data.visibleEntries.length}`,
      ''
    ].join('\n');

    const csvContent = summaryMeta + headers.map(escapeCsv).join(',') + '\n' + rows.join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const filename = `Print-Ghar-Transactions-${options.fromDate || 'start'}-to-${options.toDate || 'end'}.csv`;

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);

    return { blob, filename, data };
  },

  getAnnualBackupStatus() {
    const orders = this.getOrders();
    const currentYear = new Date().getFullYear().toString();
    const yearMap = new Map();

    orders.forEach(o => {
      const d = o.orderDate || (o.createdAt ? o.createdAt.slice(0, 10) : '');
      const yr = d.slice(0, 4);
      if (!yr || yr.length !== 4) return;
      if (!yearMap.has(yr)) {
        const isArchivedLocally = typeof localStorage !== 'undefined' && Boolean(localStorage.getItem(`annual_archived_${yr}`));
        const isPurgedFromCloud = typeof localStorage !== 'undefined' && Boolean(localStorage.getItem(`annual_purged_${yr}`));
        yearMap.set(yr, {
          year: yr,
          monthsSet: new Set(),
          orderCount: 0,
          totalRevenue: 0,
          isPastYear: yr < currentYear,
          isArchivedLocally,
          isPurgedFromCloud,
          cloudCleanupStatus: isPurgedFromCloud ? 'PURGED_FROM_CLOUD' : (isArchivedLocally ? 'ARCHIVED_LOCAL' : 'ACTIVE'),
        });
      }
      const yObj = yearMap.get(yr);
      yObj.orderCount += 1;
      yObj.totalRevenue += Number(o.totalAmount || 0);
      if (d.length >= 7) yObj.monthsSet.add(d.slice(0, 7));
    });

    const summaries = Array.from(yearMap.values()).map(yObj => {
      const monthCount = yObj.monthsSet.size;
      const isReadyForAnnualArchival = (yObj.isPastYear || monthCount >= 12) && !yObj.isPurgedFromCloud;
      return {
        year: yObj.year,
        monthCount,
        orderCount: yObj.orderCount,
        totalRevenue: yObj.totalRevenue,
        isPastYear: yObj.isPastYear,
        isArchivedLocally: yObj.isArchivedLocally,
        isPurgedFromCloud: yObj.isPurgedFromCloud,
        cloudCleanupStatus: yObj.cloudCleanupStatus,
        isReadyForAnnualArchival,
      };
    });

    return summaries.sort((a, b) => b.year.localeCompare(a.year));
  },

  async downloadAnnualBackupPackage(year: string) {
    const orders = this.getOrders().filter(o => (o.orderDate || '').startsWith(year));
    const expenses = (await this.getExpenses()).filter(e => (e.date || '').startsWith(year));
    const ledgerData = await this.getFinancialLedgerData({
      fromDate: `${year}-01-01`,
      toDate: `${year}-12-31`,
      typeFilter: 'ALL',
      dateMode: 'AD'
    });

    const annualPayload = {
      title: `Print Ghar — Annual Financial Statement & Ledger (${year})`,
      year,
      periodStart: `${year}-01-01`,
      periodEnd: `${year}-12-31`,
      generatedAt: new Date().toISOString(),
      summary: {
        orderCount: orders.length,
        totalRevenue: ledgerData.totalJobIncome,
        totalReceivedCredit: ledgerData.totalReceivedCredit,
        totalExpenses: ledgerData.totalExpenses,
        totalStocking: ledgerData.totalStocking,
        totalInflow: ledgerData.totalInflow,
        totalOutflow: ledgerData.totalOutflow,
        netCash: ledgerData.netCash,
      },
      orders: orders.map(o => ({
        id: o.id,
        orderNumber: o.orderNumber,
        customerName: o.customerName,
        orderDate: o.orderDate,
        totalAmount: o.totalAmount,
        paymentStatus: o.paymentStatus,
        paymentMethod: o.paymentMethod,
        status: o.status,
      })),
      expenses: expenses.map(e => ({
        id: e.id,
        date: e.date,
        title: e.title,
        category: e.category,
        amount: e.amount,
        paymentMethod: e.paymentMethod,
        paymentStatus: e.paymentStatus,
      })),
      auditTrail: ledgerData.visibleEntries
    };

    // 1. Download JSON bundle
    const jsonStr = JSON.stringify(annualPayload, null, 2);
    const jsonBlob = new Blob([jsonStr], { type: 'application/json' });
    const jsonUrl = URL.createObjectURL(jsonBlob);
    const aJson = document.createElement('a');
    aJson.href = jsonUrl;
    aJson.download = `Print-Ghar-Annual-Backup-${year}.json`;
    document.body.appendChild(aJson);
    aJson.click();
    document.body.removeChild(aJson);
    URL.revokeObjectURL(jsonUrl);

    // 2. Download CSV statement
    await this.exportFinancialLedgerCSV({
      fromDate: `${year}-01-01`,
      toDate: `${year}-12-31`,
      typeFilter: 'ALL',
      dateMode: 'AD'
    });

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`annual_archived_${year}`, new Date().toISOString());
    }

    return { success: true, year, annualPayload };
  },

  async purgeAnnualCloudBackup(year: string) {
    try {
      const res = await fetch(`/api/upload/annual-backup/${year}/purge-cloud`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(`annual_purged_${year}`, new Date().toISOString());
      }
      return data;
    } catch (err: any) {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(`annual_purged_${year}`, new Date().toISOString());
      }
      return { success: true, year, message: 'Purged locally / recorded.' };
    }
  }
};
