import React from 'react';
import { ArrowUp, ArrowRight, ArrowDown } from 'lucide-react';

const PRIORITY_STYLES = {
  High: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    Icon: ArrowUp,
  },
  Medium: {
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    border: 'border-orange-200',
    Icon: ArrowRight,
  },
  Low: {
    bg: 'bg-slate-50',
    text: 'text-slate-600',
    border: 'border-slate-200',
    Icon: ArrowDown,
  },
};

export default function PriorityBadge({ priority, size = 'sm' }) {
  const style = PRIORITY_STYLES[priority] || {
    bg: 'bg-slate-50',
    text: 'text-slate-700',
    border: 'border-slate-200',
    Icon: ArrowRight,
  };

  const IconComponent = style.Icon;
  const sizeClasses =
    size === 'lg'
      ? 'px-3 py-1 text-xs'
      : 'px-2.5 py-0.5 text-[11px]';

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full border ${style.bg} ${style.text} ${style.border} ${sizeClasses}`}
    >
      <IconComponent className="w-3 h-3 mr-1" />
      {priority}
    </span>
  );
}
