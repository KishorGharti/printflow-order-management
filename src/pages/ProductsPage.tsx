import React, { useState } from 'react';
import { MasterProduct } from '../types';
import { storageService } from '../services/storageService';
import { ProductModal } from '../components/products/ProductModal';
import { 
  Package, 
  Plus, 
  Search, 
  Edit3, 
  CheckCircle2, 
  XCircle, 
} from 'lucide-react';

export const ProductsPage: React.FC = () => {
  const [products, setProducts] = useState<MasterProduct[]>(storageService.getProducts());
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<MasterProduct | null>(null);

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.unit.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSaved = () => {
    setProducts(storageService.getProducts());
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2.5">
            <Package className="w-7 h-7 text-indigo-600" />
            <span>Master Products</span>
          </h1>
          <p className="text-sm text-slate-500">Standard catalog available to all shop customers automatically</p>
        </div>

        <button
          onClick={() => {
            setEditingProduct(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl font-bold text-sm shadow-md shadow-indigo-200 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Create Master Product</span>
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products by name, category, or unit..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
          />
        </div>
      </div>

      {/* Grid of Master Products */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredProducts.map((p) => (
          <div
            key={p.id}
            className="bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-indigo-200 transition-all flex flex-col justify-between p-5 space-y-4 group"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-md inline-block mb-1 border border-indigo-100">
                    {p.category}
                  </span>
                  <h3 className="font-extrabold text-slate-900 text-base group-hover:text-indigo-600 transition-colors">
                    {p.name}
                  </h3>
                </div>

                <button
                  onClick={() => {
                    setEditingProduct(p);
                    setIsModalOpen(true);
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  title="Edit Master Product"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                {p.description || 'No description provided.'}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Default Rate</span>
                <span className="text-xl font-black text-slate-900 font-mono">
                  {storageService.formatCurrency(p.defaultPrice)}{' '}
                  <span className="text-xs font-semibold text-slate-500 font-sans">/ {p.unit}</span>
                </span>
              </div>

              <div>
                {p.isActive ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
                    <XCircle className="w-3.5 h-3.5 text-slate-400" /> Inactive
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Product Modal */}
      {isModalOpen && (
        <ProductModal
          product={editingProduct}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
};
