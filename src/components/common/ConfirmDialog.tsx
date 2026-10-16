import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning';
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  const isDanger = variant === 'danger';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className={`px-5 py-4 flex items-start gap-3 ${isDanger ? 'bg-rose-50 border-b border-rose-100' : 'bg-amber-50 border-b border-amber-100'}`}>
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isDanger ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
            {isDanger ? <Trash2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className={`font-black text-base ${isDanger ? 'text-rose-900' : 'text-amber-900'}`}>{title}</h3>
            <p className={`text-xs mt-0.5 font-medium leading-relaxed ${isDanger ? 'text-rose-700' : 'text-amber-700'}`}>{message}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="shrink-0 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white/60 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Actions */}
        <div className="px-5 py-4 flex items-center justify-end gap-3 bg-white">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-5 py-2 text-sm font-black text-white rounded-xl shadow-sm transition-all cursor-pointer ${
              isDanger
                ? 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 shadow-rose-200'
                : 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700 shadow-amber-200'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
