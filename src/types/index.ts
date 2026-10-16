export type UnitType =
  | 'meter'
  | 'foot'
  | 'sq.ft'
  | 'pcs'
  | 'dozen'
  | 'each'
  | 'set'
  | 'sheet'
  | 'roll'
  | 'pack';

export type PaymentMethod = 'Pay' | 'Cash' | 'Credit' | 'Online';
export type ProductionType = 'In Store' | 'Outsource';
export type StockTrackingMode = 'AUTO' | 'MANUAL';

export interface ProductMaterial {
  id: string;
  inventoryItemId: string;
  inventoryItemName: string;
  /** ALL/undefined applies to every product sub-option; otherwise stores its variant name. */
  variant?: string;
  quantityPerUnit?: number | null;
  unit: UnitType | string;
  trackingMode: StockTrackingMode;
}

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  unit: UnitType | string;
  lowStockThreshold?: number;
  /** Optional one-level grouping for stock sizes, colors, or material types. */
  parentId?: string;
  parentName?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface OrderStockAllocation {
  id: string;
  orderItemId: string;
  masterProductId: string;
  masterProductName: string;
  inventoryItemId: string;
  inventoryItemName: string;
  quantityPerUnit?: number | null;
  requiredQuantity: number;
  reservedQuantity: number;
  consumedQuantity: number;
  unit: UnitType | string;
  trackingMode: StockTrackingMode;
  deductStockAt: OrderStatus;
  recipeSnapshotAt: string;
  consumedAt?: string;
  releasedAt?: string;
  restoredAt?: string;
  restoredQuantity?: number;
}

export interface InventoryTransaction {
  id: string;
  inventoryItemId: string;
  inventoryItemName: string;
  quantity: number;
  signedQuantity: number;
  unit: UnitType | string;
  transactionType: 'RESERVE' | 'RELEASE' | 'CONSUME' | 'RESTORE';
  orderId: string;
  orderNumber: string;
  masterProductId: string;
  masterProductName: string;
  orderItemId: string;
  timestamp: string;
  user: string;
  automatic: boolean;
  reason: string;
}

export interface TeamMember { id: string; name: string; jobTitle: string; createdAt?: string; }

export type OrderStatus =
  | 'New'
  | 'In Design'
  | 'Printing'
  | 'Finishing'
  | 'Ready'
  | 'Done'
  | 'Pickup'
  | 'Delivery'
  | 'Cancelled';

export interface Customer {
  id: string;
  name: string;
  businessName: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  notes: string;
  contacts?: Array<{ id: string; name: string; phone: string }>;
  isProfileAccount?: boolean;
  /** Unallocated money received after every outstanding credit job was cleared. */
  advanceBalance?: number;
  advanceHistory?: Array<{ transactionId: string; amount: number; method: 'Pay' | 'Online'; receivedAt: string; note?: string; receipt?: { id: string; name: string; type: string; size: number } }>;
  createdAt: string;
  updatedAt?: string;
}

export interface MasterProduct {
  id: string;
  name: string;
  category: string;
  defaultPrice: number;
  unit: UnitType;
  description: string;
  productionType?: ProductionType;
  variants?: string[];
  /** Master selling price per sub-option; missing entries fall back to defaultPrice. */
  variantPrices?: Record<string, number>;
  stockMaterialsEnabled?: boolean;
  materials?: ProductMaterial[];
  reserveStockAt?: 'Order Created';
  deductAutoStockAt?: OrderStatus;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface CustomerPricing {
  id: string;
  customerId: string;
  productId: string;
  customPrice: number;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  variant?: string;
  unit: UnitType;
  itemDescription?: string;
  width?: number;
  height?: number;
  quantity: number;
  unitPrice: number;
  defaultPrice: number;
  customerPrice?: number;
  knowAfterDesign?: boolean;
  lineTotal: number;
  /** Original job reference when several jobs are combined into one bill. */
  billingJobNumber?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  /** Bill sequence assigned when the invoice is made; separate from the JOB reference. */
  invoiceNumber?: string;
  billedOrderIds?: string[];
  billingDiscount?: number;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerWhatsapp: string;
  orderContactName?: string;
  orderContactPhone?: string;
  items: OrderItem[];
  totalAmount: number;
  orderDate: string;
  dueDate: string;
  dueTime?: string;
  status: OrderStatus;
  paymentMethod?: PaymentMethod;
  paymentStatus?: 'Credit' | 'Partial' | 'Paid';
  initialPaymentMethod?: PaymentMethod;
  initialReceivedAmount?: number;
  paymentHistory?: Array<{
    id: string;
    transactionId: string;
    amount: number;
    method: 'Pay' | 'Online';
    receivedAt: string;
    note?: string;
    isCompletionPayment?: boolean;
    receipt?: { id: string; name: string; type: string; size: number };
  }>;
  designerId?: string;
  designerName?: string;
  designerJobTitle?: string;
  printerId?: string;
  printerName?: string;
  printedBy?: string;
  printerJobTitle?: string;
  notes: string;
  media?: Array<{ id: string; name: string; type: string; size: number; extension?: string; category?: 'Ready to Go' | 'Client Reference' | string; uploadedBy?: string; uploadedAt?: string }>;
  downloadedMediaIds?: string[];
  lastDesignDownloadedAt?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  deliveryPersonId?: string;
  deliveryPersonName?: string;
  deliveryPersonJobTitle?: string;
  pickupType?: 'Self' | 'Other';
  pickupPersonName?: string;
  pickupPersonPhone?: string;
  pickedUpAt?: string;
  discount?: number;
  tax?: number;
  printCount?: number;
  lastPrintedAt?: string;
  history?: Array<{ status: OrderStatus; timestamp: string; note?: string }>;
  stockAllocations?: OrderStockAllocation[];
  stockUpdatedAt?: string;
  stockRestoredAt?: string;
}

export interface Expense {
  id: string;
  expenseNumber?: string;
  title: string;
  category: string;
  vendor?: string;
  vendorId?: string;
  paymentStatus?: 'Paid' | 'Partial' | 'Unpaid' | 'Credit';
  paymentMethod?: 'Cash' | 'Online' | 'Bank' | 'Credit';
  paidAmount?: number;
  outstandingAmount?: number;
  paidBy?: string;
  linkedPurchaseId?: string;
  /** Quantity received into the linked stock item from this stocking expense. */
  stockQuantity?: number;
  receipt?: { id: string; name: string; type: string; size: number };
  paymentHistory?: Array<{
    id: string;
    reference: string;
    amount: number;
    method: 'Cash' | 'Online' | 'Bank';
    paidAt: string;
    notes?: string;
    paidBy?: string;
    receipt?: { id: string; name: string; type: string; size: number };
  }>;
  /** Date a previously-credit vendor expense was settled. */
  paidAt?: string;
  amount: number;
  date: string;
  notes: string;
  createdAt: string;
}

export interface Vendor {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  createdAt?: string;
}

export interface TeamMember {
  id: string;
  name: string;
  jobTitle: string;
  pin?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BillReferenceConfig {
  companyDesign: string;
  companyDesignPublicId?: string;
  companyFit: 'fit' | 'fill' | 'manual';
  companyWidth: number;
  companyHeight: number;
  companyX: number;
  companyY: number;
  tableTextSize: number;
  footerText: string;
  showPageNumber: boolean;
}

export interface AppSettings {
  shopName: string;
  shopPhone: string;
  shopEmail: string;
  shopAddress?: string;
  shopPan?: string;
  shopLogo?: string;
  ownerName?: string;
  businessCategory?: string;
  openingBalance: number;
  openingCashBalance?: number | null;
  openingBankBalance?: number | null;
  currencySymbol: string;
  currencyCode: string;
  dateMode: 'AD' | 'BS';
  invoicePrefix?: string;
  invoiceStartNumber?: number;
  jobPrefix?: string;
  team?: TeamMember[];
  /** @deprecated Store access tokens only in the server's WHATSAPP_ACCESS_TOKEN environment variable. */
  whatsappApiToken?: string;
  whatsappPhoneId: string;
  whatsappSenderNumber?: string;
  whatsappApiVersion?: string;
  whatsappMode?: 'manual' | 'api';
  whatsappNotificationsEnabled?: boolean;
  whatsappTemplate: string;
  brandPrimary?: string;
  brandAccent?: string;
  brandSidebar?: string;
  brandSurface?: string;
  emailSender: string;
  emailApiKey: string;
  emailTemplate: string;
  useFirebase: boolean;
  appearance?: 'light' | 'dark';
  balanceSheetHeaderColor?: string;
  balanceSheetHeaderTextColor?: string;
  balanceSheetFooterColor?: string;
  balanceSheetFooterTextColor?: string;
  balanceSheetAlternateColor?: string;
  balanceSheetAlternateTint?: number;
  allTransactionsHeaderColor?: string;
  allTransactionsHeaderTextColor?: string;
  allTransactionsFooterColor?: string;
  allTransactionsFooterTextColor?: string;
  allTransactionsAlternateColor?: string;
  allTransactionsAlternateTint?: number;
  billReferenceConfig?: BillReferenceConfig;
  firebaseConfig?: {
    apiKey: string;
    authDomain?: string;
    projectId?: string;
    storageBucket?: string;
    messagingSenderId?: string;
    appId?: string;
  };
}

export interface FinancialLedgerEntry {
  id: string;
  type: 'job' | 'expense' | 'stocking' | 'payment' | 'credit-paid';
  date: string;
  readyDate: string;
  monthKey: string;
  jobNo: string;
  partyName: string;
  details: string;
  payment: string;
  designer: string;
  printing: string;
  mistakeBy: string;
  drAmount: number;
  crAmount: number;
  receivedCredit: number;
  creditPaid: number;
  category?: string;
  notes?: string;
  status?: string;
  paidBy?: string;
  quantity?: number;
  unit?: string;
  sourceId?: string;
  grossAmount?: number;
  timestamp: string;
  sn?: number;
  runningBalance?: number;
}

export interface FinancialLedgerData {
  allEntries: FinancialLedgerEntry[];
  visibleEntries: FinancialLedgerEntry[];
  periodEntries: FinancialLedgerEntry[];
  periodOpeningBalance: number;
  totalJobIncome: number;
  totalExpenses: number;
  totalReceivedCredit: number;
  totalCreditPaid: number;
  totalStocking: number;
  totalInflow: number;
  totalOutflow: number;
  currentBalance: number;
  netCash: number;
  designers: string[];
  dateMode: 'AD' | 'BS';
  fromDate?: string;
  toDate?: string;
  month?: string;
}
