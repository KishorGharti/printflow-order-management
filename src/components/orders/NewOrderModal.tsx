import React, { useState, useEffect, useRef } from 'react';
import { Order, OrderItem, OrderStatus } from '../../types';
import { storageService } from '../../services/storageService';
import { apiService } from '../../services/apiService';
import { CustomerModal } from '../customers/CustomerModal';
import { 
  X, 
  Plus, 
  Trash2, 
  ShoppingBag, 
  User, 
  Sparkles, 
  Search, 
  RotateCcw, 
  ChevronDown,
  Paperclip,
  Eye,
  FileText,
  Image as ImageIcon,
  Upload,
  Download
} from 'lucide-react';

interface NewOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderCreated: (order: Order) => void;
  initialCustomerId?: string;
}

export const NewOrderModal: React.FC<NewOrderModalProps> = ({
  isOpen,
  onClose,
  onOrderCreated,
  initialCustomerId,
}) => {
  const customers = storageService.getCustomers();
  const masterProducts = storageService.getProducts().filter((p) => p.isActive);
  const settings = storageService.getSettings();

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [orderDate, setOrderDate] = useState<string>(storageService.dateInputValue(new Date().toISOString().split('T')[0]));
  const [dueDate, setDueDate] = useState<string>(
    storageService.dateInputValue(new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0])
  );
  const [orderStatus, setOrderStatus] = useState<OrderStatus>('New');
  const [notes, setNotes] = useState<string>('');

  // Items state
  const [items, setItems] = useState<OrderItem[]>([]);
  const [isQuickCustomerModalOpen, setIsQuickCustomerModalOpen] = useState<boolean>(false);

  // Design & Reference files state (Cloudinary)
  const [media, setMedia] = useState<any[]>([]);
  const [isUploadingMedia, setIsUploadingMedia] = useState<boolean>(false);

  // Previous order search (Fix 2)
  const [jobSearchQuery, setJobSearchQuery] = useState<string>('');
  const [jobSearchResults, setJobSearchResults] = useState<Order[]>([]);
  const [showJobResults, setShowJobResults] = useState<boolean>(false);
  const jobSearchRef = useRef<HTMLDivElement>(null);

  // Searchable product picker (Fix 5)
  const [productSearch, setProductSearch] = useState<string>('');
  const [showProductDropdown, setShowProductDropdown] = useState<boolean>(false);
  const productPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialCustomerId) {
      setSelectedCustomerId(initialCustomerId);
    } else if (customers.length > 0 && !selectedCustomerId) {
      setSelectedCustomerId(customers[0].id);
    }
  }, [initialCustomerId, isOpen]);

  // Close job search results on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (jobSearchRef.current && !jobSearchRef.current.contains(e.target as Node)) {
        setShowJobResults(false);
      }
      if (productPickerRef.current && !productPickerRef.current.contains(e.target as Node)) {
        setShowProductDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Search previous orders by job number or customer name
  const handleJobSearch = (query: string) => {
    setJobSearchQuery(query);
    if (query.trim().length < 2) {
      setJobSearchResults([]);
      setShowJobResults(false);
      return;
    }
    const q = query.trim().toLowerCase();
    const allOrders = storageService.getOrders();
    const results = allOrders
      .filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(q) ||
          (o.customerName || '').toLowerCase().includes(q)
      )
      .slice(0, 8);
    setJobSearchResults(results);
    setShowJobResults(true);
  };

  // Load previous order's items and details into form (Fix 2)
  const handleLoadPreviousOrder = (previousOrder: Order) => {
    setSelectedCustomerId(previousOrder.customerId);
    setNotes(previousOrder.notes || '');
    // Re-price items for current customer and current product catalog
    const reloadedItems: OrderItem[] = previousOrder.items.map((it) => {
      const masterProd = masterProducts.find((p) => p.id === it.productId);
      const { price, isCustom } = storageService.getEffectiveProductPrice(
        it.productId,
        previousOrder.customerId
      );
      return {
        ...it,
        id: 'item-' + Date.now() + Math.random(),
        unitPrice: price,
        defaultPrice: masterProd?.defaultPrice || it.defaultPrice,
        customerPrice: isCustom ? price : undefined,
        lineTotal: it.quantity * price,
      };
    });
    setItems(reloadedItems);
    setJobSearchQuery(previousOrder.orderNumber);
    setShowJobResults(false);
  };

  // When customer changes, update product items with new customer custom rates if not manually overridden
  const handleCustomerChange = (newCustomerId: string) => {
    setSelectedCustomerId(newCustomerId);
    setItems((prevItems) =>
      prevItems.map((item) => {
        const { price, isCustom } = storageService.getEffectiveProductPrice(item.productId, newCustomerId);
        const masterProd = masterProducts.find((p) => p.id === item.productId);
        const unitPrice = price;
        const lineTotal = storageService.calculateLineTotal(
          item.unit,
          item.width,
          item.height,
          item.quantity,
          unitPrice
        );
        return {
          ...item,
          unitPrice,
          customerPrice: isCustom ? price : undefined,
          defaultPrice: masterProd?.defaultPrice || price,
          lineTotal,
        };
      })
    );
  };

  const handleAddProductLine = (productId: string) => {
    if (!productId) return;
    const masterProd = masterProducts.find((p) => p.id === productId);
    if (!masterProd) return;

    const { price, isCustom } = storageService.getEffectiveProductPrice(productId, selectedCustomerId);

    const newItem: OrderItem = {
      id: 'item-' + Date.now() + Math.random(),
      productId: masterProd.id,
      productName: masterProd.name,
      unit: masterProd.unit,
      quantity: 1,
      unitPrice: price,
      defaultPrice: masterProd.defaultPrice,
      customerPrice: isCustom ? price : undefined,
      lineTotal: price,
    };

    setItems([...items, newItem]);
    setProductSearch('');
    setShowProductDropdown(false);
  };

  const handleUpdateItem = (index: number, updates: Partial<OrderItem>) => {
    setItems((prevItems) => {
      const updated = [...prevItems];
      const item = { ...updated[index], ...updates };
      item.lineTotal = item.quantity * item.unitPrice;
      updated[index] = item;
      return updated;
    });
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingMedia(true);
    try {
      const updatedMedia = [...media];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          const res = await apiService.uploadDesignFile(file, {
            category: 'Client Reference',
            uploadedBy: 'Designer / Operator',
          });

          if (res.media) {
            updatedMedia.push(res.media);
          }
        } catch (uploadErr) {
          console.warn('Backend Cloudinary upload error, using local reference:', uploadErr);
          const ext = file.name.split('.').pop() || '';
          updatedMedia.push({
            id: `med_${Date.now()}_${i}`,
            name: file.name,
            type: file.type,
            size: file.size,
            extension: ext,
            category: 'Client Reference',
            uploadedAt: new Date().toISOString(),
          });
        }
      }

      setMedia(updatedMedia);
    } catch (err: any) {
      alert(`Upload error: ${err.message}`);
    } finally {
      setIsUploadingMedia(false);
      e.target.value = '';
    }
  };

  const handleRemoveMedia = (index: number) => {
    const item = media[index];
    if (item?.cloudinaryPublicId) {
      apiService.deleteFile(item.cloudinaryPublicId, {
        resourceType: item.resourceType || 'image',
      }).catch(console.warn);
    }
    setMedia(media.filter((_, i) => i !== index));
  };

  const handleDownloadFile = async (url: string, fileName: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName || 'reference-file';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      window.open(url, '_blank');
    }
  };

  const grandTotal = items.reduce((sum, item) => sum + item.lineTotal, 0);

  // Filtered products for searchable picker
  const filteredProducts = masterProducts.filter((p) => {
    if (!productSearch.trim()) return true;
    const q = productSearch.trim().toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.category || '').toLowerCase().includes(q) ||
      p.unit.toLowerCase().includes(q)
    );
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      alert('Please select a customer.');
      return;
    }
    if (items.length === 0) {
      alert('Please add at least one product to the order.');
      return;
    }

    const customer = storageService.getCustomerById(selectedCustomerId);
    if (!customer) return;

    const orderNumber = storageService.generateNextOrderNumber();
    const orderDateAD = storageService.dateInputToAD(orderDate);
    const dueDateAD = storageService.dateInputToAD(dueDate);
    if (!orderDateAD || !dueDateAD || dueDateAD < orderDateAD) {
      alert('Please enter valid dates. Due date cannot be before the order date.');
      return;
    }

    const createdOrder = storageService.saveOrder({
      orderNumber,
      customerId: customer.id,
      customerName: customer.businessName || customer.name,
      customerPhone: customer.phone,
      customerEmail: customer.email,
      customerWhatsapp: customer.whatsapp || customer.phone,
      items,
      totalAmount: grandTotal,
      orderDate: orderDateAD,
      dueDate: dueDateAD,
      status: orderStatus,
      notes,
      media,
    });

    // Also sync order to backend database asynchronously
    void fetch('http://localhost:3001/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...createdOrder,
        media,
      }),
    }).catch(console.warn);

    void storageService.sendWhatsAppStatusUpdate(createdOrder, orderStatus, 'new_order');
    onOrderCreated(createdOrder);
    onClose();
  };

  const selectedCustomer = storageService.getCustomerById(selectedCustomerId);

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
        <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
          {/* Modal Header */}
          <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center border border-indigo-500/30">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-lg leading-tight">Create New Print Order</h3>
                <p className="text-xs text-slate-400">Step 1: Select Customer • Step 2: Add Products & Pricing</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Form */}
          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1">

            {/* === REPEAT ORDER SEARCH (Fix 2) === */}
            <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-200/80 space-y-2" ref={jobSearchRef}>
              <label className="text-xs font-semibold text-indigo-700 uppercase tracking-wider flex items-center gap-2">
                <RotateCcw className="w-3.5 h-3.5" />
                Load from Previous Order (Optional)
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400 pointer-events-none" />
                <input
                  type="text"
                  value={jobSearchQuery}
                  onChange={(e) => handleJobSearch(e.target.value)}
                  onFocus={() => jobSearchQuery.trim().length >= 2 && setShowJobResults(true)}
                  placeholder="Search by Job No. (e.g. JOB-1031) or customer name…"
                  className="w-full pl-8 pr-4 py-2 bg-white border border-indigo-200 rounded-xl text-sm font-medium text-slate-800 placeholder-indigo-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                {showJobResults && jobSearchResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-white rounded-xl border border-indigo-200 shadow-xl overflow-hidden">
                    {jobSearchResults.map((order) => (
                      <button
                        key={order.id}
                        type="button"
                        onClick={() => handleLoadPreviousOrder(order)}
                        className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 transition-colors border-b border-slate-100 last:border-0 flex items-center justify-between gap-3"
                      >
                        <div>
                          <span className="font-black text-sm text-indigo-700 font-mono">{order.orderNumber}</span>
                          <span className="ml-2 text-xs text-slate-600 font-medium">{order.customerName}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-slate-400">{storageService.displayDate(order.orderDate)}</span>
                          <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">Load</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {showJobResults && jobSearchQuery.trim().length >= 2 && jobSearchResults.length === 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-white rounded-xl border border-slate-200 shadow-xl px-4 py-3 text-xs text-slate-500 font-medium">
                    No orders found for "{jobSearchQuery}"
                  </div>
                )}
              </div>
              <p className="text-[11px] text-indigo-500 font-medium">
                Selecting a previous order pre-fills customer, items & prices. A new job number will be generated on save.
              </p>
            </div>

            {/* Step 1: Customer Selector */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                  <User className="w-4 h-4 text-indigo-600" />
                  Select Customer *
                </label>
                <button
                  type="button"
                  onClick={() => setIsQuickCustomerModalOpen(true)}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Quick Add Customer
                </button>
              </div>

              <select
                value={selectedCustomerId}
                onChange={(e) => handleCustomerChange(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="">-- Choose Customer --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.businessName || c.name}
                  </option>
                ))}
              </select>

              {selectedCustomer && (
                <div className="text-xs text-slate-600 bg-white p-3 rounded-lg border border-slate-200/60 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-slate-800">{selectedCustomer.businessName || selectedCustomer.name}</span>
                  </div>
                  {selectedCustomer.notes && (
                    <span className="text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md text-[11px] font-medium border border-amber-200">
                      Note: {selectedCustomer.notes}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Step 2: Products Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Multiple Products in This Order *
                </label>
              </div>

              {/* === SEARCHABLE PRODUCT PICKER (Fix 5) === */}
              <div className="relative" ref={productPickerRef}>
                <div
                  className="flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-xl cursor-text"
                  onClick={() => setShowProductDropdown(true)}
                >
                  <Search className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => {
                      setProductSearch(e.target.value);
                      setShowProductDropdown(true);
                    }}
                    onFocus={() => setShowProductDropdown(true)}
                    placeholder="Search & add product to order…"
                    className="flex-1 bg-transparent text-sm font-medium text-indigo-700 placeholder-indigo-400 focus:outline-none"
                  />
                  <ChevronDown className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                </div>

                {showProductDropdown && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden max-h-64 overflow-y-auto">
                    {filteredProducts.length === 0 ? (
                      <div className="px-4 py-3 text-xs text-slate-500 font-medium text-center">
                        No products match "{productSearch}"
                      </div>
                    ) : (
                      filteredProducts.map((p) => {
                        const { price, isCustom } = storageService.getEffectiveProductPrice(p.id, selectedCustomerId);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => handleAddProductLine(p.id)}
                            className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 transition-colors border-b border-slate-100 last:border-0 flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-slate-900 truncate">{p.name}</span>
                                {isCustom && (
                                  <span className="shrink-0 text-[10px] px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-bold">Custom Rate</span>
                                )}
                              </div>
                              <span className="text-[11px] text-slate-500 font-medium">{p.category} • {p.unit}</span>
                            </div>
                            <div className="shrink-0 text-right">
                              <div className="font-black text-indigo-700 text-sm font-mono">{storageService.formatCurrency(price)}</div>
                              <div className="text-[10px] text-slate-400">per {p.unit}</div>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {items.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                  <p className="text-sm text-slate-500">No products added yet.</p>
                  <p className="text-xs text-slate-400 mt-1">Search for a product above to add it to this order.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="p-4 bg-white border border-slate-200 rounded-xl space-y-3 shadow-xs hover:border-indigo-200 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 text-sm">Product {idx + 1}: {item.productName}</span>
                          <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md font-mono">
                            {item.unit}
                          </span>
                          {item.customerPrice && item.unitPrice === item.customerPrice && (
                            <span className="text-[11px] px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md font-semibold flex items-center gap-1">
                              <Sparkles className="w-3 h-3" /> Special Customer Rate
                            </span>
                          )}
                          {item.unitPrice !== item.defaultPrice && item.unitPrice !== item.customerPrice && (
                            <span className="text-[11px] px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-md font-semibold">
                              Manual Price Override
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-500 uppercase">Quantity ({item.unit})</label>
                          <input type="number" min="1" value={item.quantity} onChange={(e) => handleUpdateItem(idx, { quantity: parseInt(e.target.value, 10) || 1 })} className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm font-semibold" />
                        </div>
                        <div>
                          <div className="flex items-center justify-between">
                            <label className="block text-[11px] font-semibold text-slate-500 uppercase">Unit Price (Rs.)</label>
                            <span className="text-[10px] text-slate-400">Editable</span>
                          </div>
                          <input type="number" step="0.01" min="0" value={item.unitPrice} onChange={(e) => handleUpdateItem(idx, { unitPrice: parseFloat(e.target.value) || 0 })} className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm font-bold text-indigo-700 bg-slate-50/50" />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Production Description</label>
                        <textarea
                          rows={4}
                          value={item.itemDescription || ''}
                          onChange={(e) => handleUpdateItem(idx, { itemDescription: e.target.value })}
                          placeholder="Add as much production detail as needed. Enter and Shift+Enter both create a new line."
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-y whitespace-pre-wrap"
                        />
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                        <span className="text-slate-500">
                          {`${item.quantity} ${item.unit} × ${storageService.formatCurrency(item.unitPrice)}`}
                        </span>
                        <span className="font-bold text-slate-900 text-sm">
                          Line Total: {storageService.formatCurrency(item.lineTotal)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Order Dates & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Order Date ({settings.dateMode})
                </label>
                <input
                  type={settings.dateMode === 'BS' ? 'text' : 'date'}
                  placeholder={settings.dateMode === 'BS' ? '2083-04-31' : undefined}
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Due Date ({settings.dateMode})
                </label>
                <input
                  type={settings.dateMode === 'BS' ? 'text' : 'date'}
                  placeholder={settings.dateMode === 'BS' ? '2083-04-31' : undefined}
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none font-semibold text-indigo-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Initial Status
                </label>
                <select
                  value={orderStatus}
                  onChange={(e) => setOrderStatus(e.target.value as OrderStatus)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
                >
                  <option value="New">New</option>
                  <option value="In Design">In Design</option>
                  <option value="Printing">Printing</option>
                  <option value="Finishing">Finishing</option>
                  <option value="Done">Done</option>
                </select>
              </div>
            </div>

            {/* Design & Reference Files (Cloudinary) */}
            <div className="space-y-3 p-4 bg-slate-50/70 rounded-2xl border border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Paperclip className="w-4 h-4 text-indigo-600" />
                    <span>Design & Reference Files</span>
                    <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700 text-[10px] font-bold font-mono">
                      {media.length}
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Upload customer reference images, mockups, or PDFs. Uploads to Cloudinary and deletes automatically on delivery.
                  </p>
                </div>

                <label className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-xs font-bold text-indigo-700 cursor-pointer shadow-2xs transition-colors shrink-0 ${isUploadingMedia ? 'opacity-50 pointer-events-none' : ''}`}>
                  <Upload className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{isUploadingMedia ? 'Uploading to Cloudinary…' : 'Add Reference Files'}</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*,.pdf,.psd,.ai,.cdr,.eps,.zip"
                    disabled={isUploadingMedia}
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {media.length === 0 ? (
                <div className="p-3 bg-white rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400 font-medium">
                  No reference files attached. Click &quot;Add Reference Files&quot; to upload artwork or PDFs.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  {media.map((item, idx) => (
                    <div key={item.id || idx} className="flex items-center gap-2.5 p-2.5 bg-white border border-slate-200 rounded-xl shadow-2xs hover:border-indigo-200 transition-all">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                        {['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes((item.extension || '').toLowerCase()) ? (
                          <ImageIcon className="w-4 h-4" />
                        ) : (
                          <FileText className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-bold text-slate-900" title={item.name}>{item.name}</div>
                        <div className="text-[10px] text-slate-400 font-medium">
                          {(item.extension || 'FILE').toUpperCase()} • {item.size ? `${Math.round(item.size / 1024)} KB` : '—'}
                          {item.cloudinaryUrl && <span className="text-indigo-600 font-semibold ml-1">• Cloudinary</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {item.cloudinaryUrl && (
                          <button
                            type="button"
                            title={`Preview ${item.name}`}
                            onClick={() => window.open(item.cloudinaryUrl, '_blank')}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 cursor-pointer shadow-2xs transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {item.cloudinaryUrl && (
                          <button
                            type="button"
                            title={`Save ${item.name} to local device`}
                            onClick={() => handleDownloadFile(item.cloudinaryUrl, item.name)}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer shadow-2xs transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          title="Remove file"
                          onClick={() => handleRemoveMedia(idx)}
                          className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 cursor-pointer shadow-2xs transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Order Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Order Notes & Job Instructions
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Finishing instructions, grommet spacing, paper stock, rush status..."
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </form>

          {/* Footer Summary & Action */}
          <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-t border-slate-800">
            <div>
              <p className="text-xs text-slate-400">Order Total</p>
              <p className="text-2xl font-black text-indigo-400">{storageService.formatCurrency(grandTotal)}</p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-600/30 transition-all transform hover:-translate-y-0.5"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Save & Create Order</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Inline Quick Add Customer Modal */}
      {isQuickCustomerModalOpen && (
        <CustomerModal
          isOpen={isQuickCustomerModalOpen}
          onClose={() => setIsQuickCustomerModalOpen(false)}
          onSaved={(newCust) => {
            setSelectedCustomerId(newCust.id);
            handleCustomerChange(newCust.id);
          }}
        />
      )}
    </>
  );
};
