'use strict';

/**
 * Shared helpers for converting PostgreSQL rows to the JSON shape
 * that the frontend (and existing API contracts) expect.
 *
 * Convention:
 *   - PostgreSQL columns are snake_case
 *   - API responses use camelCase
 *   - MongoDB used `_id`; PostgreSQL uses `id` — we alias it back to `_id`
 *     so the frontend requires zero changes.
 */

// Mapping of known snake_case column names → camelCase keys.
// Any column not listed here is converted automatically via the generic
// camelCase converter below.
const COLUMN_MAP = {
  local_id:                         'localId',
  business_id:                      'businessId',
  password_hash:                    'passwordHash',
  target_role:                      'targetRole',
  is_read:                          'isRead',
  order_number:                     'orderNumber',
  customer_id:                      'customerId',
  customer_name:                    'customerName',
  customer_phone:                   'customerPhone',
  customer_email:                   'customerEmail',
  customer_whatsapp:                'customerWhatsapp',
  pan:                              'pan',
  pan_number:                       'panNumber',
  order_contact_name:               'orderContactName',
  order_contact_phone:              'orderContactPhone',
  due_time:                         'dueTime',
  initial_payment_method:           'initialPaymentMethod',
  initial_received_amount:          'initialReceivedAmount',
  invoice_number:                   'invoiceNumber',
  stock_allocations:                'stockAllocations',
  stock_updated_at:                 'stockUpdatedAt',
  designer_id:                      'designerId',
  designer_name:                    'designerName',
  designer_job_title:               'designerJobTitle',
  completed_at:                     'completedAt',
  pickup_type:                      'pickupType',
  pickup_person_name:               'pickupPersonName',
  pickup_person_phone:              'pickupPersonPhone',
  picked_up_at:                     'pickedUpAt',
  delivery_type:                    'deliveryType',
  delivery_person_id:               'deliveryPersonId',
  delivery_person_name:             'deliveryPersonName',
  delivery_person_job_title:        'deliveryPersonJobTitle',
  delivered_at:                     'deliveredAt',
  downloaded_media_ids:             'downloadedMediaIds',
  last_design_downloaded_at:        'lastDesignDownloadedAt',
  print_history:                    'printHistory',
  printer_id:                       'printerId',
  printer_name:                     'printerName',
  printed_by:                       'printedBy',
  printer_job_title:                'printerJobTitle',
  cancelled_at:                     'cancelledAt',
  cancelled_by:                     'cancelledBy',
  cancel_reason:                    'cancelReason',
  previous_status:                  'previousStatus',
  min_stock_alert:                  'minStockAlert',
  opening_balance_date:             'openingBalanceDate',
  total_amount:                     'totalAmount',
  order_date:                       'orderDate',
  due_date:                         'dueDate',
  payment_method:                   'paymentMethod',
  payment_status:                   'paymentStatus',
  payment_history:                  'paymentHistory',
  expense_number:                   'expenseNumber',
  paid_amount:                      'paidAmount',
  outstanding_amount:               'outstandingAmount',
  paid_by:                          'paidBy',
  paid_at:                          'paidAt',
  linked_purchase_id:               'linkedPurchaseId',
  stock_quantity:                   'stockQuantity',
  vendor_id:                        'vendorId',
  is_profile_account:               'isProfileAccount',
  advance_balance:                  'advanceBalance',
  advance_history:                  'advanceHistory',
  business_name:                    'businessName',
  default_price:                    'defaultPrice',
  is_active:                        'isActive',
  stock_materials_enabled:          'stockMaterialsEnabled',
  deduct_auto_stock_at:             'deductAutoStockAt',
  variant_prices:                   'variantPrices',
  sub_items:                        'subItems',
  has_sub_items:                    'hasSubItems',
  low_stock_threshold:              'lowStockThreshold',
  job_title:                        'jobTitle',
  parent_id:                        'parentId',
  parent_name:                      'parentName',
  min_quantity:                     'minQuantity',
  purchase_amount:                  'purchaseAmount',
  is_archived:                      'isArchived',
  archived_at:                      'archivedAt',
  source_expense_id:                'sourceExpenseId',
  purchase_number:                  'purchaseNumber',
  inventory_item_id:                'inventoryItemId',
  inventory_item_name:              'inventoryItemName',
  signed_quantity:                  'signedQuantity',
  transaction_type:                 'transactionType',
  order_id:                         'orderId',
  master_product_id:                'masterProductId',
  master_product_name:              'masterProductName',
  order_item_id:                    'orderItemId',
  customer_id:                      'customerId',
  product_id:                       'productId',
  custom_price:                     'customPrice',
  shop_name:                        'shopName',
  shop_phone:                       'shopPhone',
  shop_email:                       'shopEmail',
  shop_address:                     'shopAddress',
  shop_logo:                        'shopLogo',
  opening_balance:                  'openingBalance',
  date_mode:                        'dateMode',
  job_prefix:                       'jobPrefix',
  job_start_number:                 'jobStartNumber',
  invoice_prefix:                   'invoicePrefix',
  invoice_start_number:             'invoiceStartNumber',
  brand_primary:                    'brandPrimary',
  whatsapp_notifications_enabled:   'whatsappNotificationsEnabled',
  whatsapp_sender_number:           'whatsappSenderNumber',
  whatsapp_template:                'whatsappTemplate',
  balance_sheet_header_color:       'balanceSheetHeaderColor',
  balance_sheet_header_text_color:  'balanceSheetHeaderTextColor',
  balance_sheet_footer_color:       'balanceSheetFooterColor',
  balance_sheet_footer_text_color:  'balanceSheetFooterTextColor',
  balance_sheet_alternate_color:    'balanceSheetAlternateColor',
  balance_sheet_alternate_tint:     'balanceSheetAlternateTint',
  all_transactions_header_color:    'allTransactionsHeaderColor',
  all_transactions_header_text_color: 'allTransactionsHeaderTextColor',
  all_transactions_footer_color:    'allTransactionsFooterColor',
  all_transactions_footer_text_color: 'allTransactionsFooterTextColor',
  all_transactions_alternate_color: 'allTransactionsAlternateColor',
  all_transactions_alternate_tint:  'allTransactionsAlternateTint',
  bill_reference_config:            'billReferenceConfig',
  chalan_reference_config:          'chalanReferenceConfig',
  period_start:                     'periodStart',
  period_end:                       'periodEnd',
  total_revenue:                    'totalRevenue',
  total_expenses:                   'totalExpenses',
  net_profit:                       'netProfit',
  order_count:                      'orderCount',
  cloudinary_pdf_url:               'cloudinaryPdfUrl',
  cloudinary_public_id:             'cloudinaryPublicId',
  is_archived_locally:              'isArchivedLocally',
  archived_locally_at:              'archivedLocallyAt',
  is_deleted_from_cloud:            'isDeletedFromCloud',
  deleted_from_cloud_at:            'deletedFromCloudAt',
  cloud_cleanup_status:             'cloudCleanupStatus',
  generated_at:                     'generatedAt',
  summary_data:                     'summaryData',
  created_at:                       'createdAt',
  updated_at:                       'updatedAt',
};

/**
 * Converts a single PostgreSQL row object to a frontend-friendly document.
 * - Maps `id` → `_id` (preserves MongoDB-style IDs expected by frontend)
 * - Maps all snake_case columns to camelCase
 * - Numeric NUMERIC/DECIMAL columns are coerced to JS numbers
 */
function rowToDoc(row) {
  if (!row) return null;
  const doc = {};

  for (const [col, val] of Object.entries(row)) {
    const key = col === 'id' ? '_id' : (COLUMN_MAP[col] || snakeToCamel(col));
    doc[key] = val;
  }

  if (row.id) {
    doc.id = row.id;
  }

  return doc;
}

/** Generic fallback: snake_case → camelCase */
function snakeToCamel(str) {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

/**
 * Convert an array of rows to an array of docs.
 */
function rowsToDocs(rows) {
  return rows.map(rowToDoc);
}

/**
 * Build a parameterised SET clause and values array for an UPDATE statement.
 * Input:  { camelCase key → value } object (frontend body)
 * Output: { setClause: 'col1 = $1, col2 = $2', values: [...], nextIdx: N+1 }
 *
 * Reverse of COLUMN_MAP: camelCase → snake_case.
 */
const CAMEL_TO_SNAKE = Object.fromEntries(
  Object.entries(COLUMN_MAP).map(([snake, camel]) => [camel, snake])
);
// Additional one-offs not covered by COLUMN_MAP
CAMEL_TO_SNAKE['user'] = '"user"';
CAMEL_TO_SNAKE['timestamp'] = '"timestamp"';

const VIRTUAL_OR_INTERNAL_FIELDS = new Set([
  'id', '_id', '__v', 'createdAt', 'updatedAt', 'created_at', 'updated_at',
  'itemSummary', 'item_summary', 'mediaCount', 'media_count'
]);

/**
 * Given a plain object of { camelCaseField: value } pairs, returns
 * { cols: ['col1','col2',...], placeholders: ['$1','$2',...], values: [...] }
 * ready for INSERT … RETURNING * or UPDATE SET col=$1 queries.
 *
 * Fields whose values are objects/arrays are JSON-stringified.
 * Skips 'id', '_id', '__v' and undefined values.
 */
function buildInsertParts(data, startIdx = 1) {
  const cols = [];
  const placeholders = [];
  const values = [];
  let idx = startIdx;

  for (const [camel, val] of Object.entries(data)) {
    // Skip internal/mongo/virtual fields
    if (VIRTUAL_OR_INTERNAL_FIELDS.has(camel)) continue;
    if (val === undefined) continue;

    const snake = CAMEL_TO_SNAKE[camel] || camelToSnake(camel);
    if (VIRTUAL_OR_INTERNAL_FIELDS.has(snake)) continue;
    cols.push(snake);
    placeholders.push(`$${idx++}`);
    values.push(serializeValue(val));
  }

  return { cols, placeholders, values, nextIdx: idx };
}

/**
 * Build a SET clause for UPDATE from a camelCase data object.
 * Returns { setClause, values, nextIdx }.
 * startIdx lets you chain parameters (e.g. WHERE id = $N).
 */
function buildSetClause(data, startIdx = 1) {
  const parts = [];
  const values = [];
  let idx = startIdx;

  for (const [camel, val] of Object.entries(data)) {
    if (VIRTUAL_OR_INTERNAL_FIELDS.has(camel)) continue;
    if (val === undefined) continue;

    const snake = CAMEL_TO_SNAKE[camel] || camelToSnake(camel);
    if (VIRTUAL_OR_INTERNAL_FIELDS.has(snake)) continue;
    parts.push(`${snake} = $${idx++}`);
    values.push(serializeValue(val));
  }

  return { setClause: parts.join(', '), values, nextIdx: idx };
}

function serializeValue(val) {
  if (val === null || val === undefined) return val;
  if (typeof val === 'object') return JSON.stringify(val);
  return val;
}

/** Generic: camelCase → snake_case */
function camelToSnake(str) {
  return str.replace(/([A-Z])/g, (c) => `_${c.toLowerCase()}`);
}

module.exports = { rowToDoc, rowsToDocs, buildInsertParts, buildSetClause, snakeToCamel, camelToSnake };
