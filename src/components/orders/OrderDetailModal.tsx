import React, { useState } from 'react';
import { Order, OrderStatus, PaymentMethod } from '../../types';
import { storageService } from '../../services/storageService';
import { apiService } from '../../services/apiService';
import { StatusBadge } from '../common/StatusBadge';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { NotificationModal } from '../notifications/NotificationModal';
import { 
  ArrowLeft,
  Printer,
  ChevronDown,
  X,
  Copy,
  Receipt,
  Truck,
  MessageSquare,
  Clock,
  AlertTriangle,
  Trash2,
  Search,
  Paperclip,
  Sparkles,
  Eye,
  Download
} from 'lucide-react';

interface OrderDetailModalProps {
  order?: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onOrderUpdated: () => void;
}

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  order,
  isOpen,
  onClose,
  onOrderUpdated,
}) => {
  const [isNotificationOpen, setIsNotificationOpen] = useState<boolean>(false);
  const [printDropdownOpen, setPrintDropdownOpen] = useState<boolean>(false);
  const [moreDropdownOpen, setMoreDropdownOpen] = useState<boolean>(false);
  const [isActivityOpen, setIsActivityOpen] = useState<boolean>(false);
  const [paymentPromptOpen, setPaymentPromptOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewAllCategory, setViewAllCategory] = useState<'Reference' | 'Ready to Go' | null>(null);
  const [uploadingCategory, setUploadingCategory] = useState<'Reference' | 'Ready to Go' | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    variant: 'danger' | 'warning';
    onConfirm: () => void;
  } | null>(null);

  if (!isOpen || !order) return null;

  const isOrderCancellable = (ord: Order) => {
    if (!ord) return false;
    if (ord.status === 'Cancelled') return false;
    if (ord.paymentStatus === 'Paid') return false;
    const cancellableStages: OrderStatus[] = ['New', 'In Design', 'Printing', 'Finishing'];
    return cancellableStages.includes(ord.status);
  };

  const handleStatusChange = (newStatus: OrderStatus) => {
    if (newStatus === 'Done' || newStatus === 'Ready') {
      setPaymentPromptOpen(true);
      return;
    }
    const updated = storageService.updateOrderStatus(order.id, newStatus);
    onOrderUpdated();
    if (updated) {
      void storageService.sendWhatsAppStatusUpdate(updated, newStatus);
      void apiService.updateOrderStatus(order.id, newStatus, updated);
    }
  };

  const completeWithPayment = (paymentMethod: PaymentMethod) => {
    const updated = storageService.updateOrderStatus(order.id, 'Done', paymentMethod);
    setPaymentPromptOpen(false);
    onOrderUpdated();
    if (updated) {
      void storageService.sendWhatsAppStatusUpdate(updated, 'Done');
      void apiService.updateOrderStatus(order.id, 'Done', updated);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, category: 'Ready to Go' | 'Client Reference') => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingCategory(category === 'Ready to Go' ? 'Ready to Go' : 'Reference');
    try {
      const currentMedia = [...(order.media || [])];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          const res = await apiService.uploadDesignFile(file, {
            orderId: order.id,
            orderNumber: order.orderNumber,
            category,
            uploadedBy: 'Designer',
          });

          if (res.media) {
            currentMedia.push(res.media as any);
          }
        } catch (uploadErr) {
          console.warn('Backend Cloudinary upload fallback to local storage:', uploadErr);
          const ext = file.name.split('.').pop() || '';
          currentMedia.push({
            id: `med_${Date.now()}_${i}`,
            name: file.name,
            type: file.type,
            size: file.size,
            extension: ext,
            category,
            uploadedAt: new Date().toISOString(),
          } as any);
        }
      }

      const updatedOrder = { ...order, media: currentMedia };
      storageService.saveOrder(updatedOrder as any);
      onOrderUpdated();
    } catch (err: any) {
      alert(`Upload error: ${err.message}`);
    } finally {
      setUploadingCategory(null);
      e.target.value = '';
    }
  };

  const handleDeleteMedia = (mediaItem: any) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Remove File',
      message: `Are you sure you want to remove "${mediaItem.name}"? This cannot be undone.`,
      confirmLabel: 'Remove',
      variant: 'danger',
      onConfirm: async () => {
        try {
          if (mediaItem.cloudinaryPublicId) {
            await apiService.deleteFile(mediaItem.cloudinaryPublicId, {
              resourceType: mediaItem.resourceType || 'image',
              orderId: order.id,
              mediaId: mediaItem.id,
            }).catch(console.warn);
          }
          const updatedMedia = (order.media || []).filter((m) => m.id !== mediaItem.id);
          const updatedOrder = { ...order, media: updatedMedia };
          storageService.saveOrder(updatedOrder as any);
          onOrderUpdated();
        } catch (e: any) {
          alert(`Failed to delete: ${e.message}`);
        }
      },
    });
  };

  const handleDownloadFile = async (url: string, fileName: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      window.open(url, '_blank');
    }
  };

  const copyJobNumber = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(order.orderNumber);
      alert(`Job Number ${order.orderNumber} copied!`);
    }
  };

  const client = storageService.getCustomerById(order.customerId);
  const clientName = order.orderContactName || client?.name || order.customerName || 'Client';
  const companyName = client?.businessName || order.customerName;

  const workflowSteps: { status: OrderStatus; label: string }[] = [
    { status: 'In Design', label: '1. In Design' },
    { status: 'Printing', label: '2. Printing' },
    { status: 'Finishing', label: '3. Progress' },
    { status: 'Done', label: '4. Done' },
    { status: 'Pickup', label: '5. Pickup' },
    { status: 'Delivery', label: '6. Delivery' },
  ];

  const referenceFiles = (order.media || []).filter((m) => m.category !== 'Ready to Go');
  const readyToGoFiles = (order.media || []).filter((m) => m.category === 'Ready to Go');

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
        onClick={() => {
          setPrintDropdownOpen(false);
          setMoreDropdownOpen(false);
        }}
      >
        <div
          className="bg-slate-50 rounded-2xl sm:rounded-3xl max-w-6xl w-full shadow-2xl border border-slate-200/90 max-h-[94vh] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 1. TOP HEADER */}
          <div className="px-4 sm:px-6 py-3.5 bg-white border-b border-slate-200/90 flex items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 text-xs sm:text-sm font-black text-slate-600 hover:text-indigo-600 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Orders</span>
            </button>

            <div className="flex items-center gap-2 sm:gap-2.5 relative">
              <StatusBadge status={order.status} />

              {/* Print Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  title="Print Bill"
                  onClick={() => {
                    setMoreDropdownOpen(false);
                    setPrintDropdownOpen(!printDropdownOpen);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-colors cursor-pointer shadow-2xs ${
                    printDropdownOpen ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Printer className="w-3.5 h-3.5 text-slate-500" />
                  <span>Print</span>
                  <ChevronDown className="w-3 h-3" />
                </button>

                {printDropdownOpen && (
                  <div className="absolute right-0 top-full mt-1.5 z-40 w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl animate-fade-in">
                    <button
                      type="button"
                      title="Print Bill"
                      onClick={() => {
                        setPrintDropdownOpen(false);
                        window.print();
                      }}
                      className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer"
                    >
                      <Receipt className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Print as Bill</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPrintDropdownOpen(false);
                        window.print();
                      }}
                      className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700 cursor-pointer"
                    >
                      <Truck className="w-3.5 h-3.5 text-blue-600" />
                      <span>Print as Chalan</span>
                    </button>
                  </div>
                )}
              </div>

              {/* More Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setPrintDropdownOpen(false);
                    setMoreDropdownOpen(!moreDropdownOpen);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-colors cursor-pointer shadow-2xs ${
                    moreDropdownOpen ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>More</span>
                  <ChevronDown className="w-3 h-3" />
                </button>

                {moreDropdownOpen && (
                  <div className="absolute right-0 top-full mt-1.5 z-40 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl animate-fade-in divide-y divide-slate-100">
                    <div className="space-y-0.5 pb-1">
                      <button
                        type="button"
                        onClick={() => {
                          setMoreDropdownOpen(false);
                          setIsNotificationOpen(true);
                        }}
                        className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Send to WhatsApp</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMoreDropdownOpen(false);
                          setIsActivityOpen(true);
                        }}
                        className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer"
                      >
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>View Activity / History</span>
                      </button>
                    </div>
                    {isOrderCancellable(order) && (
                      <div className="space-y-0.5 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setMoreDropdownOpen(false);
                            setConfirmDialog({
                              isOpen: true,
                              title: 'Cancel Order',
                              message: `Are you sure you want to cancel order ${order.orderNumber}? This action cannot be undone.`,
                              confirmLabel: 'Cancel Order',
                              variant: 'warning',
                              onConfirm: () => {
                                setConfirmDialog(null);
                                handleStatusChange('Cancelled');
                              },
                            });
                          }}
                          className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-amber-700 hover:bg-amber-50 cursor-pointer"
                        >
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                          <span>Cancel Order</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 2. BODY */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 md:p-6 grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-5">
            {/* LEFT SIDEBAR */}
            <div className="flex flex-col gap-4 lg:w-72 shrink-0">
              <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="font-mono font-black text-base text-indigo-700 tracking-tight">{order.orderNumber}</h3>
                  <button
                    type="button"
                    onClick={copyJobNumber}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 text-[10px] font-bold text-slate-600 hover:text-indigo-700 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </button>
                </div>
                <div className="space-y-1">
                  <div className="text-base font-black text-slate-900 leading-snug">{clientName}</div>
                  {companyName && companyName !== clientName && (
                    <div className="text-xs font-semibold text-slate-500">{companyName}</div>
                  )}
                </div>
                <div className="pt-2 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 font-bold">Phone:</span>
                    <span className="font-semibold">{order.orderContactPhone || order.customerPhone || '—'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 font-bold">Date:</span>
                    <span className="font-semibold">{storageService.displayDate(order.orderDate)} • Due {order.dueTime || '17:00'}</span>
                  </div>
                </div>
              </div>

              {/* Workflow Stepper */}
              <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-2.5">
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Workflow</div>
                <div className="space-y-1.5">
                  {workflowSteps.map((st, idx) => {
                    const isCurrent = order.status === st.status || (st.status === 'Done' && order.status === 'Ready');
                    return (
                      <button
                        key={st.status}
                        type="button"
                        onClick={() => handleStatusChange(st.status)}
                        className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${
                          isCurrent
                            ? 'bg-indigo-50 border border-indigo-200 text-indigo-900 font-black shadow-2xs'
                            : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black ${
                              isCurrent ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {isCurrent ? '✓' : idx + 1}
                          </span>
                          <span>{st.label}</span>
                        </span>
                        {isCurrent && <span className="text-[9px] font-black uppercase text-indigo-600">Current</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* MAIN CONTENT */}
            <div className="flex flex-col gap-5 min-w-0">
              {/* 3. ORDER ITEMS */}
              {(() => {
                const totalCount = order.items.length;
                const query = searchQuery.trim().toLowerCase();
                const filteredItems = query
                  ? order.items.filter(it => 
                      it.productName.toLowerCase().includes(query) ||
                      (it.itemDescription || '').toLowerCase().includes(query) ||
                      String(it.quantity).toLowerCase().includes(query) ||
                      (it.unit || '').toLowerCase().includes(query)
                    )
                  : order.items;

                return (
                  <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col">
                    <div className="px-4 sm:px-5 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2.5 bg-slate-50/50 shrink-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-black text-slate-900">Order Items</h4>
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-bold font-mono">
                          {query && filteredItems.length !== totalCount
                            ? `${filteredItems.length} of ${totalCount}`
                            : `${totalCount}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-1 sm:flex-initial justify-end">
                        <div className="relative w-full sm:w-56">
                          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                          <input
                            type="text"
                            placeholder="Search products..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-8 pr-7 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs"
                          />
                          {searchQuery && (
                            <button
                              type="button"
                              onClick={() => setSearchQuery('')}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="max-h-[340px] overflow-y-auto overflow-x-auto overscroll-contain">
                      <table className="w-full min-w-[620px] text-left text-xs border-collapse">
                        <thead className="sticky top-0 z-10 bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200 shadow-2xs">
                          <tr>
                            <th className="w-10 px-3 py-2.5 text-center bg-slate-50">#</th>
                            <th className="px-3 py-2.5 bg-slate-50">Product / Description</th>
                            <th className="w-24 px-3 py-2.5 text-center bg-slate-50">Qty</th>
                            <th className="w-28 px-3 py-2.5 text-right bg-slate-50">Unit Price</th>
                            <th className="w-28 px-3 py-2.5 text-right bg-slate-50">Line Total</th>
                            <th className="w-24 px-3 py-2.5 text-center bg-slate-50">Status</th>
                            <th className="w-16 px-3 py-2.5 text-center bg-slate-50">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium bg-white">
                          {filteredItems.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="px-4 py-8 text-center text-xs text-slate-400 font-medium">
                                {query ? `No products matching "${searchQuery}" found in this order.` : 'No items in this order.'}
                              </td>
                            </tr>
                          ) : (
                            filteredItems.map((it, idx) => (
                              <tr key={idx} className="bg-white hover:bg-slate-50/60 transition-colors">
                                <td className="px-3 py-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                                <td className="px-3 py-3">
                                  <div className="font-bold text-slate-900">{it.productName}</div>
                                  {it.itemDescription && (
                                    <div className="mt-0.5 text-[11px] text-slate-500 whitespace-pre-wrap">{it.itemDescription}</div>
                                  )}
                                </td>
                                <td className="px-3 py-3 text-center font-mono">{it.quantity} {it.unit}</td>
                                <td className="px-3 py-3 text-right font-mono text-slate-600">{storageService.formatCurrency(it.unitPrice)}</td>
                                <td className="px-3 py-3 text-right font-mono font-bold text-slate-900">{storageService.formatCurrency(it.lineTotal)}</td>
                                <td className="px-3 py-3 text-center">
                                  <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[9px] font-bold text-emerald-700">Ready</span>
                                </td>
                                <td className="px-3 py-3 text-center text-slate-300 font-mono">—</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200/90 flex items-center justify-between text-xs sm:text-sm font-bold shrink-0">
                      <div>
                        {order.paymentMethod && (
                          <span className="px-2.5 py-1 rounded-lg text-[10px] font-black border bg-emerald-600 text-white border-emerald-700">
                            Payment: {order.paymentMethod}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-500 font-bold uppercase text-[11px]">Grand Total</span>
                        <span className="text-indigo-700 text-base sm:text-lg font-black font-mono">
                          {storageService.formatCurrency(order.totalAmount)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* 4. BOTTOM AREA: 2-COLUMN (50/50) GRID FOR REFERENCE FILES & READY TO GO */}
              {(() => {
                const visibleRefFiles = referenceFiles.slice(0, 3);
                const visibleReadyFiles = readyToGoFiles.slice(0, 3);

                return (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
                    {/* LEFT CARD: REFERENCE FILES */}
                    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 sm:p-5 flex flex-col justify-between space-y-3 min-w-0">
                      <div className="space-y-3 flex-1">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-100">
                          <div>
                            <h4 className="text-sm font-black text-slate-900 flex items-center gap-1.5" title="Design & Reference Files">
                              Reference Files
                              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-bold font-mono">
                                {referenceFiles.length}
                              </span>
                            </h4>
                            <p className="mt-0.5 text-[11px] text-slate-500">For design guidance and customer instructions.</p>
                          </div>
                          <label className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 cursor-pointer shadow-2xs transition-colors shrink-0 self-start sm:self-auto ${uploadingCategory === 'Reference' ? 'opacity-60 pointer-events-none' : ''}`}>
                            <Paperclip className="w-3.5 h-3.5 text-indigo-600" />
                            <span>{uploadingCategory === 'Reference' ? 'Uploading to Cloudinary…' : 'Upload Reference Files'}</span>
                            <input
                              type="file"
                              multiple
                              className="hidden"
                              disabled={uploadingCategory !== null}
                              onChange={(e) => handleFileUpload(e, 'Client Reference')}
                            />
                          </label>
                        </div>

                        {referenceFiles.length === 0 ? (
                          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 text-center text-xs text-slate-400 font-medium my-auto">
                            No reference files attached yet.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {visibleRefFiles.map((media: any) => (
                              <div key={media.id} className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 transition-all hover:bg-slate-50">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-600 shadow-2xs">
                                  <Paperclip className="w-4 h-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-xs font-bold text-slate-900 flex items-center gap-1.5">
                                    <span>{media.name}</span>
                                    {media.isDeletedFromCloud && (
                                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                        Freed on Delivery
                                      </span>
                                    )}
                                  </div>
                                  <div className="mt-0.5 text-[10px] text-slate-400 font-medium">
                                    {(media.extension || 'FILE').toUpperCase()} • {media.size ? `${Math.round(media.size / 1024)} KB` : '—'}
                                    {media.cloudinaryUrl && !media.isDeletedFromCloud && ' • Cloudinary'}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  {media.cloudinaryUrl && !media.isDeletedFromCloud && (
                                    <button
                                      type="button"
                                      title={`Preview ${media.name}`}
                                      onClick={() => window.open(media.cloudinaryUrl, '_blank')}
                                      className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 cursor-pointer shadow-2xs transition-colors"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  {media.cloudinaryUrl && !media.isDeletedFromCloud && (
                                    <button
                                      type="button"
                                      title={`Download ${media.name}`}
                                      onClick={() => window.open(media.cloudinaryUrl, '_blank')}
                                      className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 cursor-pointer shadow-2xs transition-colors"
                                    >
                                      <Download className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    title="Remove file"
                                    onClick={() => handleDeleteMedia(media)}
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

                      {referenceFiles.length > 3 && (
                        <div className="pt-1 border-t border-slate-100 flex justify-end">
                          <button
                            type="button"
                            onClick={() => setViewAllCategory('Reference')}
                            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            View all files ({referenceFiles.length}) →
                          </button>
                        </div>
                      )}
                    </div>

                    {/* RIGHT CARD: READY TO GO */}
                    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 sm:p-5 flex flex-col justify-between space-y-3 min-w-0">
                      <div className="space-y-3 flex-1">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-100">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                                Ready to Go
                                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold font-mono">
                                  {readyToGoFiles.length}
                                </span>
                              </h4>
                              <span className="px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase tracking-wider">
                                Print-Ready
                              </span>
                            </div>
                            <p className="mt-0.5 text-[11px] text-slate-500">Final approved files ready for printing and production.</p>
                          </div>
                          <label className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-xs font-bold text-emerald-800 cursor-pointer shadow-2xs transition-colors shrink-0 self-start sm:self-auto ${uploadingCategory === 'Ready to Go' ? 'opacity-60 pointer-events-none' : ''}`}>
                            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{uploadingCategory === 'Ready to Go' ? 'Uploading to Cloudinary…' : 'Upload Print-Ready Files'}</span>
                            <input
                              type="file"
                              multiple
                              className="hidden"
                              disabled={uploadingCategory !== null}
                              onChange={(e) => handleFileUpload(e, 'Ready to Go')}
                            />
                          </label>
                        </div>

                        {readyToGoFiles.length === 0 ? (
                          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 text-center my-auto space-y-1">
                            <p className="text-xs font-bold text-slate-700">No print-ready files yet.</p>
                            <p className="text-[11px] text-slate-400">Upload the final approved artwork when it is ready for production.</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {visibleReadyFiles.map((media: any) => (
                              <div key={media.id} className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 transition-all hover:bg-slate-50">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white border border-emerald-200 text-emerald-700 shadow-2xs">
                                  <Sparkles className="w-4 h-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-xs font-bold text-slate-900 flex items-center gap-1.5">
                                    <span>{media.name}</span>
                                    {media.isDeletedFromCloud && (
                                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                        Freed on Delivery
                                      </span>
                                    )}
                                  </div>
                                  <div className="mt-0.5 text-[10px] text-slate-400 font-medium">
                                    {(media.extension || 'FILE').toUpperCase()} • {media.size ? `${Math.round(media.size / 1024)} KB` : '—'}
                                    {media.cloudinaryUrl && !media.isDeletedFromCloud && ' • Cloudinary'}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  {media.cloudinaryUrl && !media.isDeletedFromCloud && (
                                    <button
                                      type="button"
                                      title={`Preview ${media.name}`}
                                      onClick={() => window.open(media.cloudinaryUrl, '_blank')}
                                      className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-emerald-50 hover:text-emerald-900 cursor-pointer shadow-2xs transition-colors"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  {media.cloudinaryUrl && !media.isDeletedFromCloud && (
                                    <button
                                      type="button"
                                      title={`Download ${media.name}`}
                                      onClick={() => window.open(media.cloudinaryUrl, '_blank')}
                                      className="p-1.5 rounded-lg border border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer shadow-2xs transition-colors"
                                    >
                                      <Download className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    title="Remove file"
                                    onClick={() => handleDeleteMedia(media)}
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

                      {readyToGoFiles.length > 3 && (
                        <div className="pt-1 border-t border-slate-100 flex justify-end">
                          <button
                            type="button"
                            onClick={() => setViewAllCategory('Ready to Go')}
                            className="text-xs font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            View all files ({readyToGoFiles.length}) →
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* VIEW ALL FILES POPUP MODAL */}
      {viewAllCategory && (
        <div
          className="fixed inset-0 z-[75] flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm animate-fade-in"
          onClick={(e) => { if (e.target === e.currentTarget) setViewAllCategory(null); }}
        >
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h4 className="font-black text-sm text-slate-900 flex items-center gap-2">
                  {viewAllCategory === 'Ready to Go' ? 'All Ready to Go Files' : 'All Reference Files'}
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold font-mono ${viewAllCategory === 'Ready to Go' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>
                    {viewAllCategory === 'Ready to Go' ? readyToGoFiles.length : referenceFiles.length}
                  </span>
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  {viewAllCategory === 'Ready to Go' ? 'Final approved files ready for printing and production.' : 'For design guidance and customer instructions.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewAllCategory(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex-1 space-y-2.5">
              {(viewAllCategory === 'Ready to Go' ? readyToGoFiles : referenceFiles).map((media: any) => (
                <div key={media.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-bold text-slate-900">{media.name}</div>
                    <div className="mt-0.5 text-[10px] text-slate-400">
                      {(media.extension || 'FILE').toUpperCase()} • {media.size ? `${Math.round(media.size / 1024)} KB` : '—'}
                      {media.cloudinaryUrl && !media.isDeletedFromCloud && ' • Cloudinary'}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {media.cloudinaryUrl && !media.isDeletedFromCloud && (
                      <button
                        type="button"
                        title={`Preview ${media.name}`}
                        onClick={() => window.open(media.cloudinaryUrl, '_blank')}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 cursor-pointer shadow-2xs transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {media.cloudinaryUrl && !media.isDeletedFromCloud && (
                      <button
                        type="button"
                        title={`Download ${media.name}`}
                        onClick={() => handleDownloadFile(media.cloudinaryUrl, media.name)}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer shadow-2xs transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      title="Remove file"
                      onClick={() => handleDeleteMedia(media)}
                      className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 cursor-pointer shadow-2xs transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-3 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setViewAllCategory(null)}
                className="px-4 py-1.5 border border-slate-200 bg-white rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {paymentPromptOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 bg-slate-900 text-white">
              <h3 className="font-black text-lg">Select Payment Method</h3>
              <p className="text-xs text-slate-300 mt-1">Choose payment before marking Done / Ready.</p>
            </div>
            <div className="p-5 space-y-3">
              <button type="button" onClick={() => completeWithPayment('Pay')} className="w-full p-4 rounded-xl border-2 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-black text-left cursor-pointer">Pay (Cash)</button>
              <button type="button" onClick={() => completeWithPayment('Online')} className="w-full p-4 rounded-xl border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-800 font-black text-left cursor-pointer">Online</button>
              <button type="button" onClick={() => completeWithPayment('Credit')} className="w-full p-4 rounded-xl border-2 border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 font-black text-left cursor-pointer">Credit</button>
              <button type="button" onClick={() => setPaymentPromptOpen(false)} className="w-full py-2 text-xs font-bold text-slate-500 cursor-pointer">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Activity Modal */}
      {isActivityOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[80vh]">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h4 className="font-black text-sm text-slate-900">Order Activity</h4>
                <p className="text-xs text-slate-500">{order.orderNumber} • {clientName}</p>
              </div>
              <button type="button" onClick={() => setIsActivityOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex-1 space-y-3 text-xs">
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="font-bold text-slate-900">Order Created</span>
                <p className="text-slate-500 mt-0.5">{storageService.displayDate(order.orderDate)}</p>
              </div>
              {(order.history || []).map((h, i) => (
                <div key={i} className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="font-bold text-slate-900">Status: {h.status}</span>
                  {h.note && <p className="text-slate-500 mt-0.5">{h.note}</p>}
                </div>
              ))}
            </div>
            <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button type="button" onClick={() => setIsActivityOpen(false)} className="px-4 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Drawer Modal */}
      {isNotificationOpen && (
        <NotificationModal
          order={order}
          isOpen={isNotificationOpen}
          onClose={() => setIsNotificationOpen(false)}
          triggerType="status_update"
        />
      )}

      {/* Confirm Dialog */}
      {confirmDialog && (
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          variant={confirmDialog.variant}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </>
  );
};
