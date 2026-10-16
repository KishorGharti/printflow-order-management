import React from 'react';
import { storageService } from '../services/storageService';
import { Order } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';
import { ShoppingBag, Clock, CheckCircle2, AlertTriangle, ArrowUpRight, Sparkles, Eye, Plus } from 'lucide-react';

interface DashboardPageProps {
  onOpenOrder: (order: Order) => void;
  onOpenNewOrder: () => void;
  onNavigateTab: (tab: 'orders' | 'customers' | 'products' | 'transactions') => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onOpenOrder, onOpenNewOrder, onNavigateTab }) => {
  const orders = storageService.getOrders();
  const today = new Date().toISOString().split('T')[0];

  const todayOrders = orders.filter((o) => o.orderDate === today);
  const todayRevenue = todayOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const newOrders = todayOrders.filter((o) => o.status === 'New').length;
  const inProgressOrders = todayOrders.filter((o) => ['In Design', 'Printing', 'Finishing'].includes(o.status)).length;
  const readyOrders = todayOrders.filter((o) => ['Done', 'Ready'].includes(o.status)).length;
  const overdueOrders = orders.filter((o) => o.dueDate < today && !['Done', 'Cancelled'].includes(o.status));
  const dueTodayOrders = orders.filter((o) => o.dueDate === today && !['Done', 'Cancelled'].includes(o.status));
  const urgentCount = overdueOrders.length + dueTodayOrders.length;
  const recentOrders = [...todayOrders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 8);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 bg-gradient-to-r from-slate-950 via-indigo-950 to-indigo-900 text-white p-6 sm:p-8 rounded-3xl shadow-xl overflow-hidden">
        <div className="space-y-1.5 min-w-0">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-xs font-semibold text-indigo-200 border border-white/10 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Print Shop Manager
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Print Order Dashboard</h1>
          <p className="text-sm text-indigo-200/90">{todayOrders.length} orders today · {inProgressOrders} active in production</p>
        </div>
        <button onClick={onOpenNewOrder} className="shrink-0 flex items-center gap-2 px-5 py-3 bg-white hover:bg-indigo-50 text-indigo-950 font-black text-sm rounded-xl shadow-md transition-all">
          <Plus className="w-4 h-4 text-indigo-600" /> Create Order
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <button onClick={() => onNavigateTab('transactions')} className="text-left bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer">
          <div className="flex justify-between text-xs font-bold uppercase text-slate-500"><span>Today Revenue</span><ShoppingBag className="w-4 h-4 text-indigo-600" /></div>
          <div className="text-2xl font-black text-indigo-700 mt-1">{storageService.formatCurrency(todayRevenue)}</div>
        </button>
        <div className="bg-sky-50/40 p-5 rounded-2xl border border-sky-200 shadow-xs">
          <div className="flex justify-between text-xs font-bold uppercase text-sky-700"><span>Today Orders</span><span className="w-2.5 h-2.5 rounded-full bg-sky-500" /></div>
          <div className="text-3xl font-black text-sky-950 mt-1">{todayOrders.length}</div>
          <div className="text-[10px] font-bold text-sky-600 mt-1">{newOrders} new</div>
        </div>
        <div className="bg-amber-50/40 p-5 rounded-2xl border border-amber-200 shadow-xs">
          <div className="flex justify-between text-xs font-bold uppercase text-amber-700"><span>In Progress</span><Clock className="w-4 h-4" /></div>
          <div className="text-3xl font-black text-amber-950 mt-1">{inProgressOrders}</div>
        </div>
        <div className="bg-emerald-50/40 p-5 rounded-2xl border border-emerald-200 shadow-xs">
          <div className="flex justify-between text-xs font-bold uppercase text-emerald-700"><span>Done / Ready</span><CheckCircle2 className="w-4 h-4" /></div>
          <div className="text-3xl font-black text-emerald-950 mt-1">{readyOrders}</div>
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div><h2 className="text-lg font-extrabold text-slate-900">Today&apos;s Orders</h2><p className="text-xs text-slate-500">Only orders created today</p></div>
          <button onClick={() => onNavigateTab('orders')} className="text-xs font-bold text-indigo-600 flex items-center gap-1">View All Orders <ArrowUpRight className="w-3.5 h-3.5" /></button>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full min-w-[900px] table-fixed text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
              <tr><th className="px-4 py-3 w-28">Job Number</th><th className="px-4 py-3 w-48">Company</th><th className="px-4 py-3 w-60">Product</th><th className="px-4 py-3 w-36">Due Date</th><th className="px-4 py-3 w-36">Status</th><th className="px-4 py-3 w-28 text-right">Total</th><th className="px-4 py-3 w-16 text-center"></th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentOrders.map((order) => {
                const products = order.items.map((i) => i.productName).join(', ');
                const overdue = order.dueDate < today && !['Done', 'Cancelled'].includes(order.status);
                return <tr key={order.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-4 font-bold font-mono text-indigo-600">{order.orderNumber}</td>
                  <td className="px-4 py-4 font-bold text-slate-900 truncate">{storageService.getCompanyName(order.customerId, order.customerName)}</td>
                  <td className="px-4 py-4 text-slate-700 truncate" title={products}>{products}</td>
                  <td className="px-4 py-4">{overdue ? <span className="text-rose-600 font-bold">{storageService.displayDate(order.dueDate)} · Overdue</span> : storageService.displayDate(order.dueDate)}</td>
                  <td className="px-4 py-4"><StatusBadge status={order.status} /></td>
                  <td className="px-4 py-4 text-right font-black font-mono">{storageService.formatCurrency(order.totalAmount)}</td>
                  <td className="px-4 py-4 text-center"><button onClick={() => onOpenOrder(order)} className="p-1.5 text-slate-400 hover:text-indigo-600"><Eye className="w-4 h-4" /></button></td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between"><h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-500" />Needing Attention</h2><span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 text-xs font-bold rounded-full">{urgentCount}</span></div>
        {urgentCount === 0 ? <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-sm font-semibold text-slate-500">No overdue orders.</div> : <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...overdueOrders, ...dueTodayOrders].map((o) => <button key={`${o.id}-${o.dueDate}`} onClick={() => onOpenOrder(o)} className="text-left p-4 bg-slate-900 text-white rounded-2xl border border-slate-800 hover:bg-slate-800">
            <div className="flex justify-between gap-3"><span className="text-[10px] font-bold text-rose-300 uppercase">{o.dueDate < today ? 'Overdue' : 'Due Today'}</span><span className="font-mono text-xs font-bold">{o.orderNumber}</span></div>
            <p className="font-extrabold mt-1 truncate">{storageService.getCompanyName(o.customerId, o.customerName)}</p>
            <p className="text-xs text-slate-300 truncate">{o.items.map((i) => i.productName).join(', ')}</p>
          </button>)}
        </div>}
      </section>
    </div>
  );
};
