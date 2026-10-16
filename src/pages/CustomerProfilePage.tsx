import React, { useState } from 'react';
import { Customer, Order } from '../types';
import { storageService } from '../services/storageService';
import { StatusBadge } from '../components/common/StatusBadge';
import { 
  ShoppingBag, 
  Tag, 
  FileText, 
  ArrowLeft, 
  Edit3, 
  Phone, 
  Mail, 
  MapPin, 
  Sparkles,
  RotateCcw,
  Check,
  Plus
} from 'lucide-react';

interface CustomerProfilePageProps {
  customer: Customer;
  onBack: () => void;
  onOpenOrder: (order: Order) => void;
  onOpenNewOrderForCustomer: (customerId: string) => void;
}

export const CustomerProfilePage: React.FC<CustomerProfilePageProps> = ({
  customer,
  onBack,
  onOpenOrder,
  onOpenNewOrderForCustomer,
}) => {
  const [activeTab, setActiveTab] = useState<'orders' | 'pricing' | 'notes'>('orders');
  const [notesText, setNotesText] = useState<string>(customer.notes || '');
  const [editingPriceProductId, setEditingPriceProductId] = useState<string | null>(null);
  const [tempCustomPrice, setTempCustomPrice] = useState<string>('');
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState<boolean>(false);
  const [addProductSearch, setAddProductSearch] = useState<string>('');
  const [addProductCategory, setAddProductCategory] = useState<string>('ALL');

  const orders = storageService.getOrdersByCustomerId(customer.id);
  const masterProducts = storageService.getProducts();
  const pricingMap = storageService.getCustomerPricingMap(customer.id);
  const customProductIds = new Set(pricingMap.keys());
  const activeProductIds = new Set([...customProductIds, ...(editingPriceProductId ? [editingPriceProductId] : [])]);
  const customProducts = masterProducts.filter((p) => activeProductIds.has(p.id));
  const categories = ['ALL', ...Array.from(new Set(masterProducts.map((p) => p.category || 'General').filter(Boolean)))];

  // Stats
  const totalOrders = orders.length;
  const totalAmount = orders.reduce((sum, o) => sum + o.totalAmount, 0);
  const lastOrderDate =
    orders.length > 0
      ? [...orders].sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime())[0].orderDate
      : 'No orders yet';

  const handleSaveNotes = () => {
    storageService.saveCustomer({
      ...customer,
      notes: notesText.trim(),
    });
    alert('Customer notes saved!');
  };

  const handleSaveCustomPrice = (productId: string) => {
    const val = parseFloat(tempCustomPrice);
    if (isNaN(val) || val < 0) {
      alert('Please enter a valid price number.');
      return;
    }
    storageService.setCustomerPrice(customer.id, productId, val);
    setEditingPriceProductId(null);
  };

  const handleResetToDefault = (productId: string) => {
    storageService.removeCustomerPrice(customer.id, productId);
    if (editingPriceProductId === productId) {
      setEditingPriceProductId(null);
    }
  };

  const handleSelectProductToAdd = (product: typeof masterProducts[0]) => {
    setIsAddProductModalOpen(false);
    setEditingPriceProductId(product.id);
    const existing = pricingMap.get(product.id);
    setTempCustomPrice(existing !== undefined ? existing.toString() : product.defaultPrice.toString());
  };

  const availableMasterProducts = masterProducts.filter((p) => {
    if (addProductCategory !== 'ALL' && (p.category || 'General') !== addProductCategory) return false;
    if (!addProductSearch.trim()) return true;
    const q = addProductSearch.trim().toLowerCase();
    return [p.name, p.category, p.unit].some((v) => String(v || '').toLowerCase().includes(q));
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back button & Title */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-700 transition-colors shadow-2xs"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Customers</span>
        </button>

        <button
          onClick={() => onOpenNewOrderForCustomer(customer.id)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>+ Create Order</span>
        </button>
      </div>

      {/* Profile Header Box */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white font-black text-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
              {(customer.businessName || customer.name)
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2)}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-extrabold text-slate-900">{customer.businessName || customer.name}</h1>
                {pricingMap.size > 0 && (
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-full flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    Special Rates Active
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 mt-2">
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-slate-400" /> {customer.phone}
                </span>
                {customer.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-slate-400" /> {customer.email}
                  </span>
                )}
                {customer.address && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" /> {customer.address}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 3 Summary Stats */}
          <div className="grid grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
            <div className="text-center px-2">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Orders</span>
              <span className="text-lg font-black text-slate-900">{totalOrders}</span>
            </div>
            <div className="text-center px-2 border-x border-slate-200">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Amount</span>
              <span className="text-lg font-black text-indigo-600">{storageService.formatCurrency(totalAmount)}</span>
            </div>
            <div className="text-center px-2">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Last Order</span>
              <span className="text-xs font-bold text-slate-700 block mt-1">{lastOrderDate}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="border-b border-slate-200 flex items-center gap-2">
        <button
          onClick={() => setActiveTab('orders')}
          className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm border-b-2 transition-all ${
            activeTab === 'orders'
              ? 'border-indigo-600 text-indigo-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          <span>Orders ({orders.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('pricing')}
          className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm border-b-2 transition-all ${
            activeTab === 'pricing'
              ? 'border-indigo-600 text-indigo-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Tag className="w-4 h-4" />
          <span>Pricing & Custom Rates</span>
          {pricingMap.size > 0 && (
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-xs">
              {pricingMap.size}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('notes')}
          className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm border-b-2 transition-all ${
            activeTab === 'notes'
              ? 'border-indigo-600 text-indigo-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Notes</span>
        </button>
      </div>

      {/* TAB 1: ORDERS HISTORY */}
      {activeTab === 'orders' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          {orders.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <p className="font-semibold text-sm">No orders recorded for this customer yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3.5">Job Number</th>
                    <th className="px-5 py-3.5">Date</th>
                    <th className="px-5 py-3.5">Products Summary</th>
                    <th className="px-5 py-3.5 text-center">Items Qty</th>
                    <th className="px-5 py-3.5 text-right">Total</th>
                    <th className="px-5 py-3.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {orders.map((o) => {
                    const prodSummary = o.items.map((i) => i.productName).join(', ');

                    return (
                      <tr
                        key={o.id}
                        onClick={() => onOpenOrder(o)}
                        className="hover:bg-indigo-50/40 cursor-pointer transition-colors"
                      >
                        <td className="px-5 py-4 font-bold font-mono text-indigo-600">
                          {o.orderNumber}
                        </td>
                        <td className="px-5 py-4 text-slate-600">{storageService.displayDate(o.orderDate)}</td>
                        <td className="px-5 py-4 font-semibold text-slate-900">{prodSummary}</td>
                        <td className="px-5 py-4 text-center">{o.items.map((i) => `${i.quantity} ${i.unit}`).join(" / ")}</td>
                        <td className="px-5 py-4 text-right font-black text-slate-900 font-mono text-sm">
                          {storageService.formatCurrency(o.totalAmount)}
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge status={o.status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CUSTOMER-SPECIFIC PRICING (CRUCIAL FEATURE) */}
      {activeTab === 'pricing' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-indigo-50/80 border border-indigo-100 p-4 rounded-2xl text-xs text-indigo-900">
            <div className="space-y-1">
              <p className="font-bold flex items-center gap-2 text-sm">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                Customer-Specific Price Override Matrix
              </p>
              <p>
                Set special custom rates for this customer. Only products with custom rates are listed below.
              </p>
            </div>
            <button
              onClick={() => {
                setAddProductSearch('');
                setAddProductCategory('ALL');
                setIsAddProductModalOpen(true);
              }}
              className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add Product</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden relative">
            {customProducts.length === 0 ? (
              <div className="text-center py-16 px-4">
                <p className="text-slate-600 font-bold text-sm">No custom prices set for this client.</p>
                <p className="text-slate-400 text-xs mt-1">This client uses standard Master Product catalog rates.</p>
                <button
                  onClick={() => {
                    setAddProductSearch('');
                    setAddProductCategory('ALL');
                    setIsAddProductModalOpen(true);
                  }}
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Product</span>
                </button>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3.5">Product</th>
                    <th className="px-5 py-3.5">Unit</th>
                    <th className="px-5 py-3.5 text-right">Default</th>
                    <th className="px-5 py-3.5 text-right">Custom</th>
                    <th className="px-5 py-3.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {customProducts.map((p) => {
                    const hasCustom = pricingMap.has(p.id);
                    const customPrice = pricingMap.get(p.id);
                    const isEditing = editingPriceProductId === p.id;

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-4">
                          <p className="font-bold text-slate-900 text-sm">{p.name}</p>
                          <p className="text-[11px] text-slate-400">{p.category}</p>
                        </td>
                        <td className="px-5 py-4">
                          <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-600 font-mono">
                            {p.unit}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right font-mono text-slate-600">
                          {storageService.formatCurrency(p.defaultPrice)} / {p.unit}
                        </td>
                        <td className="px-5 py-4 text-right">
                          {isEditing ? (
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-slate-400 font-bold">Rs.</span>
                              <input
                                autoFocus
                                type="number"
                                step="0.01"
                                min="0"
                                value={tempCustomPrice}
                                onChange={(e) => setTempCustomPrice(e.target.value)}
                                className="w-24 px-2 py-1 border border-indigo-300 rounded-lg text-sm font-bold text-indigo-700 text-right focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              />
                            </div>
                          ) : hasCustom ? (
                            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 font-extrabold text-sm border border-emerald-200 rounded-lg font-mono inline-block">
                              {storageService.formatCurrency(customPrice || 0)} / {p.unit}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Default ({storageService.formatCurrency(p.defaultPrice)})</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-center">
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleSaveCustomPrice(p.id)}
                                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center gap-1"
                              >
                                <Check className="w-3 h-3" /> Save
                              </button>
                              <button
                                onClick={() => setEditingPriceProductId(null)}
                                className="px-2 py-1 bg-slate-200 text-slate-600 rounded-lg text-xs"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => {
                                  setEditingPriceProductId(p.id);
                                  setTempCustomPrice(
                                    hasCustom ? customPrice!.toString() : p.defaultPrice.toString()
                                  );
                                }}
                                className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-lg text-xs border border-indigo-200 flex items-center gap-1"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>Edit</span>
                              </button>

                              {hasCustom && (
                                <button
                                  onClick={() => handleResetToDefault(p.id)}
                                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                  title="Reset to Master Default"
                                >
                                  <RotateCcw className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* Modal: Add Product Selector */}
            {isAddProductModalOpen && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
                onClick={() => setIsAddProductModalOpen(false)}
              >
                <div
                  className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden flex flex-col max-h-[85vh]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">Add Product</h4>
                      <p className="text-xs text-slate-500">Choose a product to set a custom rate</p>
                    </div>
                    <button
                      onClick={() => setIsAddProductModalOpen(false)}
                      className="text-slate-400 hover:text-slate-600 p-1"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="p-3 border-b border-slate-100 space-y-2">
                    <input
                      autoFocus
                      type="text"
                      value={addProductSearch}
                      onChange={(e) => setAddProductSearch(e.target.value)}
                      placeholder="Search products..."
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                    {categories.length > 2 && (
                      <div className="flex flex-wrap gap-1">
                        {categories.map((cat) => (
                          <button
                            key={cat}
                            onClick={() => setAddProductCategory(cat)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              addProductCategory === cat
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {cat === 'ALL' ? 'All' : cat}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="p-2 overflow-y-auto flex-1 divide-y divide-slate-100">
                    {availableMasterProducts.length === 0 ? (
                      <p className="text-center py-6 text-xs text-slate-400">No products found.</p>
                    ) : (
                      availableMasterProducts.map((p) => {
                        const isAlreadyCustom = pricingMap.has(p.id);
                        return (
                          <button
                            key={p.id}
                            disabled={isAlreadyCustom}
                            onClick={() => handleSelectProductToAdd(p)}
                            className={`w-full text-left p-3 rounded-xl flex items-center justify-between transition-colors ${
                              isAlreadyCustom
                                ? 'opacity-40 cursor-not-allowed bg-slate-50'
                                : 'hover:bg-indigo-50/60'
                            }`}
                          >
                            <div>
                              <p className="font-bold text-xs text-slate-900">{p.name}</p>
                              <p className="text-[10px] text-slate-400">
                                {p.category} • {p.unit}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-mono text-xs font-bold text-slate-700">
                                {storageService.formatCurrency(p.defaultPrice)}
                              </p>
                              {isAlreadyCustom ? (
                                <span className="text-[9px] font-bold text-indigo-600">Already Added</span>
                              ) : (
                                <span className="text-[10px] font-bold text-emerald-600">+ Select</span>
                              )}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>

                  <div className="p-3 border-t border-slate-100 bg-slate-50 flex justify-end">
                    <button
                      onClick={() => setIsAddProductModalOpen(false)}
                      className="px-4 py-1.5 border border-slate-200 bg-white rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: NOTES */}
      {activeTab === 'notes' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 space-y-4 shadow-xs">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Customer Notes & Preferences</h3>
            <p className="text-xs text-slate-500">Record customer instructions, specs, and specific requirements</p>
          </div>

          <textarea
            rows={6}
            value={notesText}
            onChange={(e) => setNotesText(e.target.value)}
            placeholder="e.g. Always wants matte finish. Usually orders 500 business cards. Needs design approval first."
            className="w-full p-4 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />

          <div className="flex justify-end">
            <button
              onClick={handleSaveNotes}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-sm transition-all"
            >
              Save Notes
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
