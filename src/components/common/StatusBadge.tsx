import React from 'react';
import { OrderStatus } from '../../types';

interface StatusBadgeProps {
  status: OrderStatus;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const getBadgeStyle = (status: OrderStatus) => {
    switch (status) {
      case 'New':
        return 'bg-sky-50 text-sky-700 border-sky-200/80';
      case 'In Design':
        return 'bg-purple-50 text-purple-700 border-purple-200/80';
      case 'Printing':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200/80';
      case 'Finishing':
        return 'bg-amber-50 text-amber-700 border-amber-200/80';
      case 'Done':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200/80';
      case 'Cancelled':
        return 'bg-rose-50 text-rose-700 border-rose-200/80';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs font-semibold';

  return (
    <span
      className={`inline-flex items-center rounded-full border ${getBadgeStyle(
        status
      )} ${sizeClasses} transition-all`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 opacity-80" />
      {status}
    </span>
  );
};
