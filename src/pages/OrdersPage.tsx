import React, { useState } from 'react';
import { Order } from '../types';
import { storageService } from '../services/storageService';
import { StatusBadge } from '../components/common/StatusBadge';
import { 
  ShoppingBag, 
  Search, 
  Plus, 
  Eye, 
} from 'lucide-react';

interface OrdersPageProps {
  onOpenOrder: (order: Order) => void;
  onOpenNewOrder: () => void;
  globalSearchQuery: string;
}

export const OrdersPage: React.FC<OrdersPageProps> = ({
  onOpenOrder,
  onOpenNewOrder,
  globalSearchQuery,
}) => {
  const orders = storageService.getOrders();
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [localSearch, setLocalSearch] = useState<string>('');

  const today = new Date().toISOString().split('T')[0];
  const query = (globalSearchQuery || localSearch).toLowerCase().trim();

  const filteredOrders = orders.filter((o) => {
    const matchesStatus = selectedStatus === 'ALL' || o.status === selectedStatus;
    const matchesSearch =
      o.orderNumber.toLowerCase().includes(query) ||
      o.customerName.toLowerCase().includes(query) ||
      storageService.getCompanyName(o.customerId, o.customerName).toLowerCase().includes(query) ||
      String(o.customerPhone || '').toLowerCase().includes(query) ||
      o.items.some((i) => i.productName.toLowerCase().includes(query));

    return matchesStatus && matchesSearch;
  });


  const getDueDayLabel = (dueDate: string, status: string) => {
    if (!dueDate || ['Ready', 'Done', 'Cancelled'].includes(status)) return '';
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const due = new Date(`${dueDate}T00:00:00`);
    const days = Math.ceil((due.getTime() - now.getTime()) / 86400000);
    if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`;
    if (days === 0) return 'Due today';
    return `${days} day${days === 1 ? '' : 's'} left`;
  };

  const statuses: { id: string; label: string }[] = [
    { id: 'ALL', label: 'All Orders' },
    { id: 'New', label: 'New' },
    { id: 'In Design', label: 'In Design' },
    { id: 'Printing', label: 'Printing' },
    { id: 'Finishing', label: 'Finishing' },
    { id: 'Done', label: 'Done' },
    { id: 'Cancelled', label: 'Cancelled' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2.5">
            <ShoppingBag className="w-7 h-7 text-indigo-600" />
            <span>Print Orders</span>
          </h1>
          <p className="text-sm text-slate-500">Track and manage all print production jobs</p>
        </div>

        <button
          onClick={onOpenNewOrder}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl font-bold text-sm shadow-md shadow-indigo-200 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>New Order</span>
        </button>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Search by Job Number (e.g. JOB-1042), Customer Name, or Product..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
            />
          </div>
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {statuses.map((st) => {
            const count =
              st.id === 'ALL'
                ? orders.length
                : orders.filter((o) => o.status === st.id).length;
            const isActive = selectedStatus === st.id;

            return (
              <button
                key={st.id}
                onClick={() => setSelectedStatus(st.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-medium text-xs whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white font-bold shadow-xs'
                    : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/80'
                }`}
              >
                <span>{st.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-12 text-slate-500 space-y-2">
            <ShoppingBag className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="font-semibold text-sm">No orders matching criteria found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-left text-xs">
              <thead className="bg-slate-900 text-slate-200 uppercase tracking-wider font-bold border-b border-slate-800 sticky top-0 z-10">
                <tr>
                  <th className="px-5 py-3.5 text-center">S.N.</th>
                  <th className="px-5 py-3.5">Job Number</th>
                  <th className="px-5 py-3.5">Customer</th>
                  <th className="px-5 py-3.5">Products Summary</th>
                  <th className="px-5 py-3.5">Order Date</th>
                  <th className="px-5 py-3.5">Due Date</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-center">Payment</th>
                  <th className="px-5 py-3.5 text-right">Total</th>
                  <th className="px-5 py-3.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {filteredOrders.map((o, rowIndex) => {
                  const isOverdue =
                    o.dueDate < today && !['Ready', 'Done', 'Cancelled'].includes(o.status);
                  const isDueToday =
                    o.dueDate === today && !['Ready', 'Done', 'Cancelled'].includes(o.status);

                  return (
                    <tr
                      key={o.id}
                      className={`transition-colors ${
                        o.status === 'Cancelled'
                          ? 'bg-rose-100 hover:bg-rose-200 text-rose-950'
                          : 'hover:bg-slate-50/70'
                      }`}
                    >
                      <td className="px-5 py-4 text-center font-bold text-slate-400">{rowIndex + 1}</td>
                      <td
                        onClick={() => onOpenOrder(o)}
                        className="px-5 py-4 font-bold font-mono text-indigo-600 cursor-pointer hover:underline"
                      >
                        {o.orderNumber}
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-900">{storageService.getCompanyName(o.customerId, o.customerName)}</p>
                      </td>
                      <td className="px-5 py-4 font-medium text-slate-700">
                        <div className="space-y-1">
                          {o.items.map((item, idx) => (
                            <div key={item.id || idx} className="leading-snug">
                              <div>{item.productName}{item.quantity > 1 ? ` × ${item.quantity} ${item.unit}` : ` × 1 ${item.unit}`}</div>
                              {item.itemDescription && <div className="mt-0.5 text-[10px] text-slate-500 whitespace-pre-wrap max-w-sm">{item.itemDescription}</div>}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-600">{storageService.displayDate(o.orderDate)}</td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        {isOverdue ? (
                          <span className="text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200 text-[11px]">
                            {o.dueDate} (Overdue)
                          </span>
                        ) : isDueToday ? (
                          <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[11px]">
                            Today
                          </span>
                        ) : (
                          <div>
                            <span className="text-slate-600">{storageService.displayDate(o.dueDate)}</span>
                            <span className="block mt-1 text-[10px] font-black text-emerald-600">{getDueDayLabel(o.dueDate, o.status)}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <StatusBadge status={o.status} />
                      </td>
                      <td className="px-5 py-4 text-center">
                        {o.paymentMethod ? (
                          <span className={`inline-flex px-2.5 py-1 rounded-lg text-[10px] font-black border ${o.paymentMethod === 'Pay' ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm' : o.paymentMethod === 'Online' ? 'bg-blue-600 text-white border-blue-700 shadow-sm' : 'bg-rose-600 text-white border-rose-700 shadow-sm'}`}>{o.paymentMethod}</span>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-5 py-4 text-right font-black text-slate-900 font-mono text-sm">
                        {storageService.formatCurrency(o.totalAmount)}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <button
                          onClick={() => onOpenOrder(o)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors inline-flex items-center gap-1"
                          title="View Order Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
