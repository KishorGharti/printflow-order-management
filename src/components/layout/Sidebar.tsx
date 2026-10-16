import React from 'react';
import { LayoutDashboard, ShoppingBag, ArrowLeftRight, Users, Package, Settings, Printer, X } from 'lucide-react';

export type NavTab = 'dashboard' | 'orders' | 'transactions' | 'customers' | 'products' | 'settings';

interface SidebarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  isOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, isOpen, onCloseMobile }) => {
  const navItems = [
    { id: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'orders' as const, label: 'Orders', icon: ShoppingBag },
    { id: 'transactions' as const, label: 'All Transactions', icon: ArrowLeftRight },
    { id: 'customers' as const, label: 'Customers', icon: Users },
    { id: 'products' as const, label: 'Products', icon: Package },
    { id: 'settings' as const, label: 'Settings', icon: Settings },
  ];

  const navigation = (
    <>
      <div className="h-16 px-6 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center"><Printer className="w-5 h-5" /></div>
          <div><h1 className="font-extrabold text-white">PrintFlow</h1><p className="text-[10px] text-indigo-400 uppercase">Shop Manager</p></div>
        </div>
        <button onClick={onCloseMobile} className="lg:hidden text-slate-400" aria-label="Close menu"><X className="w-5 h-5" /></button>
      </div>
      <nav className="flex-1 px-4 py-6 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return <button key={item.id} onClick={() => { setActiveTab(item.id); onCloseMobile(); }} className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold ${activeTab === item.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><Icon className="w-5 h-5" />{item.label}</button>;
        })}
      </nav>
    </>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 bg-slate-900 lg:flex lg:flex-col">{navigation}</aside>
      {isOpen && <div className="fixed inset-0 z-50 flex lg:hidden"><button className="absolute inset-0 bg-slate-950/60" onClick={onCloseMobile} aria-label="Close menu overlay" /><aside className="relative flex w-72 flex-col bg-slate-900">{navigation}</aside></div>}
    </>
  );
};
