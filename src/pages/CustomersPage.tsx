import React, { useState } from 'react';
import { Customer } from '../types';
import { storageService } from '../services/storageService';
import { CustomerModal } from '../components/customers/CustomerModal';
import { 
  Users, 
  Search, 
  Plus, 
  ChevronRight, 
  Edit3,
} from 'lucide-react';

interface CustomersPageProps {
  onOpenCustomerProfile: (customer: Customer) => void;
  searchQuery: string;
}

export const CustomersPage: React.FC<CustomersPageProps> = ({
  onOpenCustomerProfile,
  searchQuery,
}) => {
  const [customers, setCustomers] = useState<Customer[]>(storageService.getCustomers());
  const [localSearch, setLocalSearch] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const effectiveSearch = (searchQuery || localSearch).toLowerCase().trim();

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(effectiveSearch) ||
      c.businessName.toLowerCase().includes(effectiveSearch)
  );

  const handleSaved = () => {
    setCustomers(storageService.getCustomers());
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2.5">
            <Users className="w-7 h-7 text-indigo-600" />
            <span>Customer Profiles</span>
          </h1>
          <p className="text-sm text-slate-500">Manage client contacts, custom pricing, and order histories</p>
        </div>

        <button
          onClick={() => {
            setEditingCustomer(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl font-bold text-sm shadow-md shadow-indigo-200 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Add Customer</span>
        </button>
      </div>

      {/* Filter / Search bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Search company..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
          />
        </div>
      </div>

      {/* Customers Cards / Table */}
      {filteredCustomers.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-600 font-semibold text-base">No customers found</p>
          <p className="text-slate-400 text-xs mt-1">Try adjusting your search criteria or add a new customer.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCustomers.map((cust) => {
            const custOrders = storageService.getOrdersByCustomerId(cust.id);
            const totalSpent = custOrders.filter((o) => o.status !== 'Cancelled').reduce((sum, o) => sum + o.totalAmount, 0);
            const paidAmount = custOrders.filter((o) => ['Pay', 'Online'].includes(o.paymentMethod || '')).reduce((sum, o) => sum + o.totalAmount, 0);
            const dueAmount = custOrders.filter((o) => o.paymentMethod === 'Credit').reduce((sum, o) => sum + o.totalAmount, 0);

            return (
              <div
                key={cust.id}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-indigo-200 transition-all flex flex-col justify-between overflow-hidden group"
              >
                <div className="p-5 space-y-4">
                  {/* Top line */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-700 font-black text-sm flex items-center justify-center border border-indigo-100 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        {(cust.businessName || cust.name)
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .toUpperCase()
                          .slice(0, 2)}
                      </div>
                      <div>
                        <h3
                          onClick={() => onOpenCustomerProfile(cust)}
                          className="font-bold text-slate-900 text-base hover:text-indigo-600 cursor-pointer transition-colors"
                        >
                          {cust.businessName || cust.name}
                        </h3>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setEditingCustomer(cust);
                        setIsModalOpen(true);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                      title="Edit Customer"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </div>
                  {/* Notes */}

                  {cust.notes && (
                    <p className="text-xs text-amber-800 bg-amber-50/80 p-2.5 rounded-xl border border-amber-200/80 italic line-clamp-2">
                      "{cust.notes}"
                    </p>
                  )}
                </div>

                <div className="px-5 pb-4 grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-rose-50 border border-rose-200 p-3">
                    <span className="block text-[10px] uppercase font-black text-rose-500">Due</span>
                    <span className="block mt-1 font-black text-rose-700">{storageService.formatCurrency(dueAmount)}</span>
                  </div>
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3">
                    <span className="block text-[10px] uppercase font-black text-emerald-500">Pay</span>
                    <span className="block mt-1 font-black text-emerald-700">{storageService.formatCurrency(paidAmount)}</span>
                  </div>
                  <div className="rounded-xl bg-indigo-50 border border-indigo-200 p-3">
                    <span className="block text-[10px] uppercase font-black text-indigo-500">Total</span>
                    <span className="block mt-1 font-black text-indigo-700">{storageService.formatCurrency(totalSpent)}</span>
                  </div>
                </div>
                <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-500">{custOrders.length} orders</span>
                  <button onClick={() => onOpenCustomerProfile(cust)} className="flex items-center gap-1 font-bold text-indigo-600 hover:text-indigo-800">
                    <span>Open Profile</span><ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Customer Modal */}
      {isModalOpen && (
        <CustomerModal
          customer={editingCustomer}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
};
