import React, { useState, useEffect } from 'react';
import { MasterProduct, UnitType } from '../../types';
import { storageService } from '../../services/storageService';
import { X, PackagePlus, Save } from 'lucide-react';

interface ProductModalProps {
  product?: MasterProduct | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (product: MasterProduct) => void;
}

export const ProductModal: React.FC<ProductModalProps> = ({
  product,
  isOpen,
  onClose,
  onSaved,
}) => {
  const [formData, setFormData] = useState({
    name: '',
    category: 'General',
    defaultPrice: 10,
    unit: 'each' as UnitType,
    description: '',
    isActive: true,
  });

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || '',
        category: product.category || 'General',
        defaultPrice: product.defaultPrice || 0,
        unit: product.unit || 'each',
        description: product.description || '',
        isActive: product.isActive ?? true,
      });
    } else {
      setFormData({
        name: '',
        category: 'General',
        defaultPrice: 10,
        unit: 'each',
        description: '',
        isActive: true,
      });
    }
  }, [product, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Please enter a product name.');
      return;
    }

    const saved = storageService.saveProduct({
      id: product?.id,
      name: formData.name.trim(),
      category: formData.category.trim(),
      defaultPrice: Number(formData.defaultPrice),
      unit: formData.unit,
      description: formData.description.trim(),
      isActive: formData.isActive,
    });

    onSaved(saved);
    onClose();
  };

  const units: UnitType[] = [
    'meter',
    'foot',
    'sq.ft',
    'pcs',
    'dozen',
    'each',
    'set',
    'sheet',
    'roll',
    'pack',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center border border-indigo-500/30">
              <PackagePlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg leading-tight">
                {product ? 'Edit Master Product' : 'Create Master Product'}
              </h3>
              <p className="text-xs text-slate-400">Available to all shop customers automatically</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Product Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Vinyl Banner (13oz)"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Category
              </label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="e.g. Large Format, Apparel, Stationery"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Production Unit *
              </label>
              <select
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value as UnitType })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white font-medium"
              >
                {units.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Default Master Price *
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={formData.defaultPrice}
                  onChange={(e) => setFormData({ ...formData, defaultPrice: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none font-semibold text-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Product Status
              </label>
              <div className="flex items-center h-10 gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                  <input
                    type="radio"
                    name="isActive"
                    checked={formData.isActive === true}
                    onChange={() => setFormData({ ...formData, isActive: true })}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Active</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                  <input
                    type="radio"
                    name="isActive"
                    checked={formData.isActive === false}
                    onChange={() => setFormData({ ...formData, isActive: false })}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Inactive</span>
                </label>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Description
            </label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Product specs, turnaround notes, finishing options..."
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl shadow-sm transition-all"
            >
              <Save className="w-4 h-4" />
              <span>{product ? 'Update Master Product' : 'Save Master Product'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
