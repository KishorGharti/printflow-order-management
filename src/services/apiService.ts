/**
 * Print Ghar API Service for interacting with Express + database + Cloudinary backend.
 */

const API_BASE_URL = 'http://localhost:3001/api';

import { Order } from '../types';

export interface UploadResult {
  success: boolean;
  media?: {
    id: string;
    name: string;
    type: string;
    size: number;
    extension: string;
    category: 'Ready to Go' | 'Client Reference' | string;
    cloudinaryUrl: string;
    cloudinaryPublicId: string;
    resourceType: string;
    uploadedBy: string;
    uploadedAt: string;
    isDeletedFromCloud: boolean;
  };
  url?: string;
  publicId?: string;
}

export const apiService = {
  /**
   * Upload a designer / artwork file to Cloudinary.
   */
  async uploadDesignFile(
    file: File,
    options: {
      orderId?: string;
      orderNumber?: string;
      category?: 'Ready to Go' | 'Client Reference' | string;
      uploadedBy?: string;
    } = {}
  ): Promise<UploadResult> {
    const formData = new FormData();
    formData.append('file', file);
    if (options.orderId) formData.append('orderId', options.orderId);
    if (options.orderNumber) formData.append('orderNumber', options.orderNumber);
    if (options.category) formData.append('category', options.category);
    if (options.uploadedBy) formData.append('uploadedBy', options.uploadedBy);

    const res = await fetch(`${API_BASE_URL}/upload/design`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(err.error || `Upload failed with status ${res.status}`);
    }

    return res.json();
  },

  /**
   * Upload shop branding logo to Cloudinary.
   */
  async uploadLogo(file: File): Promise<{ success: boolean; url: string; publicId: string }> {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_BASE_URL}/upload/logo`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Logo upload failed' }));
      throw new Error(err.error || `Upload failed with status ${res.status}`);
    }

    return res.json();
  },

  /**
   * Archive monthly financial ledger PDF / summary to Cloudinary.
   */
  async uploadMonthlyLedger(
    fileOrBlob: Blob | File,
    metadata: {
      month: string;
      title?: string;
      periodStart?: string;
      periodEnd?: string;
      totalRevenue?: number;
      totalExpenses?: number;
      netProfit?: number;
      orderCount?: number;
      summaryData?: any;
    }
  ): Promise<{ success: boolean; report: any }> {
    const formData = new FormData();
    formData.append('file', fileOrBlob, `ledger-${metadata.month}.pdf`);
    formData.append('month', metadata.month);
    if (metadata.title) formData.append('title', metadata.title);
    if (metadata.periodStart) formData.append('periodStart', metadata.periodStart);
    if (metadata.periodEnd) formData.append('periodEnd', metadata.periodEnd);
    if (metadata.totalRevenue !== undefined) formData.append('totalRevenue', String(metadata.totalRevenue));
    if (metadata.totalExpenses !== undefined) formData.append('totalExpenses', String(metadata.totalExpenses));
    if (metadata.netProfit !== undefined) formData.append('netProfit', String(metadata.netProfit));
    if (metadata.orderCount !== undefined) formData.append('orderCount', String(metadata.orderCount));
    if (metadata.summaryData) formData.append('summaryData', JSON.stringify(metadata.summaryData));

    const res = await fetch(`${API_BASE_URL}/upload/ledger-monthly`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Ledger archival failed' }));
      throw new Error(err.error || `Archival failed with status ${res.status}`);
    }

    return res.json();
  },

  /**
   * Delete a specific file from Cloudinary.
   */
  async deleteFile(publicId: string, options: { resourceType?: string; orderId?: string; mediaId?: string } = {}) {
    const res = await fetch(`${API_BASE_URL}/upload/file`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        publicId,
        resourceType: options.resourceType || 'image',
        orderId: options.orderId,
        mediaId: options.mediaId,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Delete failed' }));
      throw new Error(err.error || `Delete failed with status ${res.status}`);
    }

    return res.json();
  },

  /**
   * Notify backend of order status update (which triggers automatic Cloudinary cleanup when Delivered).
   */
  async updateOrderStatus(orderId: string, status: string, orderData?: any) {
    try {
      const res = await fetch(`${API_BASE_URL}/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ...(orderData || {}) }),
      });
      return await res.json();
    } catch (e) {
      console.warn('Backend order status update skipped:', e);
      return null;
    }
  },

  /**
   * Check backend & Cloudinary health status.
   */
  async checkHealth(): Promise<{ status: string; db: string; cloudinary: string }> {
    try {
      const res = await fetch('http://localhost:3001/health');
      return await res.json();
    } catch (e) {
      return { status: 'offline', db: 'none', cloudinary: 'offline' };
    }
  },

  // ─── Expenses API ──────────────────────────────────────────────────────────

  /**
   * Fetch all expenses from database (with optional filters).
   */
  async getExpenses(
    filters: { fromDate?: string; toDate?: string; category?: string; paymentStatus?: string; search?: string } = {}
  ): Promise<any[]> {
    try {
      const params = new URLSearchParams();
      if (filters.fromDate)      params.set('fromDate', filters.fromDate);
      if (filters.toDate)        params.set('toDate', filters.toDate);
      if (filters.category)      params.set('category', filters.category);
      if (filters.paymentStatus) params.set('paymentStatus', filters.paymentStatus);
      if (filters.search)        params.set('search', filters.search);
      params.set('limit', '2000');
      const res = await fetch(`${API_BASE_URL}/expenses?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }
      const data = await res.json();
      return Array.isArray(data.expenses) ? data.expenses : [];
    } catch (err) {
      console.error('[apiService] getExpenses failed:', err);
      throw new Error('Unable to load expenses. Please check your internet connection and try again.');
    }
  },

  /**
   * Create a new expense in database.
   */
  async createExpense(expenseData: any): Promise<any> {
    try {
      const res = await fetch(`${API_BASE_URL}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(expenseData),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Create failed' }));
        throw new Error(err.error || `Create failed with status ${res.status}`);
      }
      return res.json();
    } catch (e: any) {
      console.error('[apiService] createExpense failed:', e);
      throw new Error('Unable to save expense. Please check your internet connection and try again.');
    }
  },

  /**
   * Update an existing expense in database by its _id or localId.
   */
  async updateExpense(id: string, expenseData: any): Promise<any> {
    try {
      const res = await fetch(`${API_BASE_URL}/expenses/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(expenseData),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Update failed' }));
        throw new Error(err.error || `Update failed with status ${res.status}`);
      }
      return res.json();
    } catch (e: any) {
      console.error('[apiService] updateExpense failed:', e);
      throw new Error('Unable to save expense. Please check your internet connection and try again.');
    }
  },

  /**
   * Record a payment against a credit/partial expense.
   */
  async recordExpensePayment(
    id: string,
    paymentData: { amount: number; method: string; paidAt: string; notes?: string; paidBy?: string }
  ): Promise<any> {
    try {
      const res = await fetch(`${API_BASE_URL}/expenses/${id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentData),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Payment record failed' }));
        throw new Error(err.error || `Payment record failed with status ${res.status}`);
      }
      return res.json();
    } catch (e: any) {
      console.error('[apiService] recordExpensePayment failed:', e);
      throw new Error('Unable to record expense payment. Please check your internet connection and try again.');
    }
  },

  /**
   * Delete an expense from database by its _id or localId.
   */
  async deleteExpense(id: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE_URL}/expenses/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        throw new Error(`Delete failed with status ${res.status}`);
      }
      return true;
    } catch (e) {
      console.error('[apiService] deleteExpense failed:', e);
      throw new Error('Unable to delete expense. Please check your internet connection and try again.');
    }
  },

  /**
   * Bulk-upsert expenses from localStorage to database (one-time migration).
   * Uses localId to avoid duplicates on re-run.
   */
  async bulkUpsertExpenses(expenses: any[]): Promise<{ inserted: number; skipped: number } | null> {
    try {
      const res = await fetch(`${API_BASE_URL}/expenses/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expenses }),
      });
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  },

  // ── Orders API ─────────────────────────────────────────────────────────

  async getOrders(filters: { status?: string; customerId?: string; search?: string; limit?: number } = {}): Promise<Order[]> {
    try {
      const params = new URLSearchParams();
      if (filters.status) params.set('status', filters.status);
      if (filters.customerId) params.set('customerId', filters.customerId);
      if (filters.search) params.set('search', filters.search);
      if (filters.limit) params.set('limit', String(filters.limit));

      const query = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`${API_BASE_URL}/orders${query}`);
      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }
      const data = await res.json();
      return Array.isArray(data.orders) ? data.orders : [];
    } catch (e: any) {
      console.error('[apiService] getOrders failed:', e);
      throw new Error('Unable to fetch orders from server. Please check your internet connection.');
    }
  },

  async createOrder(order: Partial<Order>): Promise<Order> {
    try {
      const res = await fetch(`${API_BASE_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to create order' }));
        throw new Error(err.error || `Server returned status ${res.status}`);
      }
      return res.json();
    } catch (e: any) {
      console.error('[apiService] createOrder failed:', e);
      throw new Error(e.message || 'Unable to save order. Please check your internet connection and try again.');
    }
  },

  async updateOrder(id: string, order: Partial<Order>): Promise<Order> {
    try {
      const res = await fetch(`${API_BASE_URL}/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to update order' }));
        throw new Error(err.error || `Server returned status ${res.status}`);
      }
      return res.json();
    } catch (e: any) {
      console.error('[apiService] updateOrder failed:', e);
      throw new Error(e.message || 'Unable to save order. Please check your internet connection and try again.');
    }
  },

  async deleteOrder(id: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE_URL}/orders/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        throw new Error(`Delete failed with status ${res.status}`);
      }
      return true;
    } catch (e) {
      console.error('[apiService] deleteOrder failed:', e);
      throw new Error('Unable to delete order. Please check your internet connection and try again.');
    }
  },

  async bulkUpsertOrders(orders: any[]): Promise<{ inserted: number; updated: number } | null> {
    try {
      const res = await fetch(`${API_BASE_URL}/orders/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders }),
      });
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  },

  // ── Customers API ──────────────────────────────────────────────────────
  async getCustomers(filters: { search?: string; limit?: number } = {}): Promise<any[]> {
    try {
      const params = new URLSearchParams();
      if (filters.search) params.set('search', filters.search);
      if (filters.limit) params.set('limit', String(filters.limit));
      const res = await fetch(`${API_BASE_URL}/customers?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return Array.isArray(data.customers) ? data.customers : [];
    } catch (e: any) {
      console.error('[apiService] getCustomers failed:', e);
      throw new Error('Unable to fetch customers. Backend is offline.');
    }
  },

  async createCustomer(customer: any): Promise<any> {
    try {
      const res = await fetch(`${API_BASE_URL}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customer),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      return res.json();
    } catch (e: any) {
      console.error('[apiService] createCustomer failed:', e);
      throw new Error(e.message || 'Unable to save customer. Backend is offline.');
    }
  },

  async updateCustomer(id: string, customer: any): Promise<any> {
    try {
      const res = await fetch(`${API_BASE_URL}/customers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customer),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      return res.json();
    } catch (e: any) {
      console.error('[apiService] updateCustomer failed:', e);
      throw new Error(e.message || 'Unable to update customer. Backend is offline.');
    }
  },

  async deleteCustomer(id: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE_URL}/customers/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return true;
    } catch (e: any) {
      console.error('[apiService] deleteCustomer failed:', e);
      throw new Error('Unable to delete customer. Backend is offline.');
    }
  },

  async bulkUpsertCustomers(customers: any[]): Promise<{ inserted: number; updated: number } | null> {
    try {
      const res = await fetch(`${API_BASE_URL}/customers/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customers }),
      });
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  },

  // ── Products API ───────────────────────────────────────────────────────
  async getProducts(filters: { search?: string; category?: string; activeOnly?: boolean } = {}): Promise<any[]> {
    try {
      const params = new URLSearchParams();
      if (filters.search) params.set('search', filters.search);
      if (filters.category) params.set('category', filters.category);
      if (filters.activeOnly) params.set('activeOnly', 'true');
      const res = await fetch(`${API_BASE_URL}/products?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return Array.isArray(data.products) ? data.products : [];
    } catch (e: any) {
      console.error('[apiService] getProducts failed:', e);
      throw new Error('Unable to fetch products. Backend is offline.');
    }
  },

  async createProduct(product: any): Promise<any> {
    try {
      const res = await fetch(`${API_BASE_URL}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(product),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      return res.json();
    } catch (e: any) {
      console.error('[apiService] createProduct failed:', e);
      throw new Error(e.message || 'Unable to save product. Backend is offline.');
    }
  },

  async updateProduct(id: string, product: any): Promise<any> {
    try {
      const res = await fetch(`${API_BASE_URL}/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(product),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      return res.json();
    } catch (e: any) {
      console.error('[apiService] updateProduct failed:', e);
      throw new Error(e.message || 'Unable to update product. Backend is offline.');
    }
  },

  async deleteProduct(id: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE_URL}/products/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return true;
    } catch (e: any) {
      console.error('[apiService] deleteProduct failed:', e);
      throw new Error('Unable to delete product. Backend is offline.');
    }
  },

  async bulkUpsertProducts(products: any[]): Promise<{ inserted: number; updated: number } | null> {
    try {
      const res = await fetch(`${API_BASE_URL}/products/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products }),
      });
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  },

  // ── Pricing API ────────────────────────────────────────────────────────
  async getPricing(filters: { customerId?: string; productId?: string } = {}): Promise<any[]> {
    try {
      const params = new URLSearchParams();
      if (filters.customerId) params.set('customerId', filters.customerId);
      if (filters.productId) params.set('productId', filters.productId);
      const res = await fetch(`${API_BASE_URL}/pricing?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return Array.isArray(data.pricing) ? data.pricing : [];
    } catch (e: any) {
      console.error('[apiService] getPricing failed:', e);
      throw new Error('Unable to fetch custom pricing. Backend is offline.');
    }
  },

  async setCustomerPrice(data: { customerId: string; productId: string; variant?: string; customPrice: number }): Promise<any> {
    try {
      const res = await fetch(`${API_BASE_URL}/pricing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    } catch (e: any) {
      console.error('[apiService] setCustomerPrice failed:', e);
      throw new Error('Unable to save custom price. Backend is offline.');
    }
  },

  async deleteCustomerPrice(customerId: string, productId: string, variant = ''): Promise<boolean> {
    try {
      const params = new URLSearchParams({ customerId, productId, variant });
      const res = await fetch(`${API_BASE_URL}/pricing?${params.toString()}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return true;
    } catch (e: any) {
      console.error('[apiService] deleteCustomerPrice failed:', e);
      throw new Error('Unable to remove custom price. Backend is offline.');
    }
  },

  async bulkUpsertPricing(pricing: any[]): Promise<{ inserted: number; updated: number } | null> {
    try {
      const res = await fetch(`${API_BASE_URL}/pricing/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pricing }),
      });
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  },

  // ── Team API ───────────────────────────────────────────────────────────
  async getTeam(): Promise<any[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/team`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return Array.isArray(data.team) ? data.team : [];
    } catch (e: any) {
      console.error('[apiService] getTeam failed:', e);
      throw new Error('Unable to fetch team members. Backend is offline.');
    }
  },

  async createTeamMember(member: any): Promise<any> {
    try {
      const res = await fetch(`${API_BASE_URL}/team`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(member),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    } catch (e: any) {
      console.error('[apiService] createTeamMember failed:', e);
      throw new Error('Unable to save team member. Backend is offline.');
    }
  },

  async updateTeamMember(id: string, member: any): Promise<any> {
    try {
      const res = await fetch(`${API_BASE_URL}/team/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(member),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    } catch (e: any) {
      console.error('[apiService] updateTeamMember failed:', e);
      throw new Error('Unable to update team member. Backend is offline.');
    }
  },

  async deleteTeamMember(id: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE_URL}/team/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return true;
    } catch (e: any) {
      console.error('[apiService] deleteTeamMember failed:', e);
      throw new Error('Unable to delete team member. Backend is offline.');
    }
  },

  async bulkUpsertTeam(team: any[]): Promise<{ inserted: number; updated: number } | null> {
    try {
      const res = await fetch(`${API_BASE_URL}/team/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team }),
      });
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  },

  // ── Stock API ──────────────────────────────────────────────────────────
  async getStock(filters: { search?: string; category?: string; activeOnly?: boolean } = {}): Promise<any[]> {
    try {
      const params = new URLSearchParams();
      if (filters.search) params.set('search', filters.search);
      if (filters.category) params.set('category', filters.category);
      if (filters.activeOnly) params.set('activeOnly', 'true');
      const res = await fetch(`${API_BASE_URL}/stock?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return Array.isArray(data.stock) ? data.stock : [];
    } catch (e: any) {
      console.error('[apiService] getStock failed:', e);
      throw new Error('Unable to fetch stock. Backend is offline.');
    }
  },

  async createStockItem(item: any): Promise<any> {
    try {
      const res = await fetch(`${API_BASE_URL}/stock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    } catch (e: any) {
      console.error('[apiService] createStockItem failed:', e);
      throw new Error('Unable to save stock item. Backend is offline.');
    }
  },

  async updateStockItem(id: string, item: any): Promise<any> {
    try {
      const res = await fetch(`${API_BASE_URL}/stock/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    } catch (e: any) {
      console.error('[apiService] updateStockItem failed:', e);
      throw new Error('Unable to update stock item. Backend is offline.');
    }
  },

  async deleteStockItem(id: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE_URL}/stock/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return true;
    } catch (e: any) {
      console.error('[apiService] deleteStockItem failed:', e);
      throw new Error('Unable to delete stock item. Backend is offline.');
    }
  },

  async bulkUpsertStock(stock: any[]): Promise<{ inserted: number; updated: number } | null> {
    try {
      const res = await fetch(`${API_BASE_URL}/stock/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock }),
      });
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  },

  // ── Stock Transactions API ─────────────────────────────────────────────
  async getStockTransactions(filters: { inventoryItemId?: string; orderId?: string } = {}): Promise<any[]> {
    try {
      const params = new URLSearchParams();
      if (filters.inventoryItemId) params.set('inventoryItemId', filters.inventoryItemId);
      if (filters.orderId) params.set('orderId', filters.orderId);
      const res = await fetch(`${API_BASE_URL}/stock-transactions?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return Array.isArray(data.transactions) ? data.transactions : [];
    } catch (e: any) {
      console.error('[apiService] getStockTransactions failed:', e);
      throw new Error('Unable to fetch stock transactions. Backend is offline.');
    }
  },

  async createStockTransaction(txn: any): Promise<any> {
    try {
      const res = await fetch(`${API_BASE_URL}/stock-transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(txn),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    } catch (e: any) {
      console.error('[apiService] createStockTransaction failed:', e);
      throw new Error('Unable to record stock transaction. Backend is offline.');
    }
  },

  async bulkUpsertStockTransactions(transactions: any[]): Promise<{ inserted: number } | null> {
    try {
      const res = await fetch(`${API_BASE_URL}/stock-transactions/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions }),
      });
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  },

  // ── Vendors API ────────────────────────────────────────────────────────
  async getVendors(): Promise<any[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/vendors`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return Array.isArray(data.vendors) ? data.vendors : [];
    } catch (e: any) {
      console.error('[apiService] getVendors failed:', e);
      throw new Error('Unable to fetch vendors. Backend is offline.');
    }
  },

  async createVendor(vendor: any): Promise<any> {
    try {
      const res = await fetch(`${API_BASE_URL}/vendors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vendor),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    } catch (e: any) {
      console.error('[apiService] createVendor failed:', e);
      throw new Error('Unable to save vendor. Backend is offline.');
    }
  },

  async updateVendor(id: string, vendor: any): Promise<any> {
    try {
      const res = await fetch(`${API_BASE_URL}/vendors/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vendor),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    } catch (e: any) {
      console.error('[apiService] updateVendor failed:', e);
      throw new Error('Unable to update vendor. Backend is offline.');
    }
  },

  async deleteVendor(id: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE_URL}/vendors/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return true;
    } catch (e: any) {
      console.error('[apiService] deleteVendor failed:', e);
      throw new Error('Unable to delete vendor. Backend is offline.');
    }
  },

  async bulkUpsertVendors(vendors: any[]): Promise<{ inserted: number; updated: number } | null> {
    try {
      const res = await fetch(`${API_BASE_URL}/vendors/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendors }),
      });
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  },

  // ── Settings API ───────────────────────────────────────────────────────
  async getSettings(): Promise<any> {
    try {
      const res = await fetch(`${API_BASE_URL}/settings`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    } catch (e: any) {
      console.error('[apiService] getSettings failed:', e);
      throw new Error('Unable to fetch settings. Backend is offline.');
    }
  },

  async updateSettings(settings: any): Promise<any> {
    try {
      const res = await fetch(`${API_BASE_URL}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    } catch (e: any) {
      console.error('[apiService] updateSettings failed:', e);
      throw new Error('Unable to update settings. Backend is offline.');
    }
  },

  async bulkUpsertSettings(settings: any): Promise<any> {
    try {
      const res = await fetch(`${API_BASE_URL}/settings/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  },
};
