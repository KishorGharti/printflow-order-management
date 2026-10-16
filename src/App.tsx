import React, { useState, useEffect } from 'react';
import { Customer, Order } from './types';
import { storageService } from './services/storageService';
import { Sidebar, NavTab } from './components/layout/Sidebar';
import { Navbar } from './components/layout/Navbar';
import { DashboardPage } from './pages/DashboardPage';
import { OrdersPage } from './pages/OrdersPage';
import { CustomersPage } from './pages/CustomersPage';
import { CustomerProfilePage } from './pages/CustomerProfilePage';
import { ProductsPage } from './pages/ProductsPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { SettingsPage } from './pages/SettingsPage';
import { NewOrderModal } from './components/orders/NewOrderModal';
import { OrderDetailModal } from './components/orders/OrderDetailModal';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState<boolean>(false);
  const [newOrderCustomerId, setNewOrderCustomerId] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // ─── Boot: load all business data from database into in-memory cache ─────
  useEffect(() => {
    const bootData = async () => {
      await storageService.loadAllDataFromServer();
      refreshState();
    };
    bootData().catch(console.warn);
  }, []);

  // When tab changes, clear individual profile view if switching top-level
  const handleTabChange = (tab: NavTab) => {
    setActiveTab(tab);
    setSelectedCustomer(null);
  };

  const handleOpenCustomerProfile = (cust: Customer) => {
    setSelectedCustomer(cust);
    setActiveTab('customers');
  };

  const handleOpenOrder = (order: Order) => {
    setSelectedOrder(order);
  };

  const handleOpenNewOrder = (customerId?: string) => {
    setNewOrderCustomerId(customerId);
    setIsNewOrderModalOpen(true);
  };

  const handleOrderCreated = (createdOrder: Order) => {
    setSelectedOrder(createdOrder);
  };

  const refreshState = () => {
    // Triggers re-render when storage updates
    if (selectedCustomer) {
      const updatedCust = storageService.getCustomerById(selectedCustomer.id);
      if (updatedCust) setSelectedCustomer(updatedCust);
    }
    if (selectedOrder) {
      const updatedOrd = storageService.getOrderById(selectedOrder.id);
      if (updatedOrd) setSelectedOrder(updatedOrd);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 font-sans antialiased flex">
      {/* Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        isOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Navbar */}
        <Navbar
          searchQuery={searchQuery}
          setSearchQuery={(q) => {
            setSearchQuery(q);
            if (q.trim().length > 0 && activeTab !== 'orders') {
              setActiveTab('orders');
            }
          }}
          onOpenNewOrder={() => handleOpenNewOrder()}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
        />

        {/* View Container */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* Dashboard View */}
          {activeTab === 'dashboard' && (
            <DashboardPage
              onOpenOrder={handleOpenOrder}
              onOpenNewOrder={() => handleOpenNewOrder()}
              onNavigateTab={(tab) => handleTabChange(tab as any)}
            />
          )}

          {/* Orders View */}
          {activeTab === 'orders' && (
            <OrdersPage
              onOpenOrder={handleOpenOrder}
              onOpenNewOrder={() => handleOpenNewOrder()}
              globalSearchQuery={searchQuery}
            />
          )}

          {/* Transactions View */}
          {activeTab === 'transactions' && (
            <TransactionsPage
              onOpenOrder={handleOpenOrder}
            />
          )}

          {/* Customers View (Or Customer Profile View) */}
          {activeTab === 'customers' && (
            selectedCustomer ? (
              <CustomerProfilePage
                customer={selectedCustomer}
                onBack={() => setSelectedCustomer(null)}
                onOpenOrder={handleOpenOrder}
                onOpenNewOrderForCustomer={(custKey) => handleOpenNewOrder(custKey)}
              />
            ) : (
              <CustomersPage
                onOpenCustomerProfile={handleOpenCustomerProfile}
                searchQuery={searchQuery}
              />
            )
          )}

          {/* Products View */}
          {activeTab === 'products' && <ProductsPage />}

          {/* Settings View */}
          {activeTab === 'settings' && <SettingsPage />}
        </main>
      </div>

      {/* Global Modals */}
      {isNewOrderModalOpen && (
        <NewOrderModal
          isOpen={isNewOrderModalOpen}
          onClose={() => setIsNewOrderModalOpen(false)}
          onOrderCreated={handleOrderCreated}
          initialCustomerId={newOrderCustomerId}
        />
      )}

      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          isOpen={!!selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onOrderUpdated={refreshState}
        />
      )}
    </div>
  );
};
