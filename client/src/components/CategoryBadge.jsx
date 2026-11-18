import React from 'react';
import { Monitor, Laptop, Wifi, KeyRound, HelpCircle } from 'lucide-react';

const CATEGORY_ICONS = {
  Hardware: Laptop,
  Software: Monitor,
  Network: Wifi,
  Access: KeyRound,
  Other: HelpCircle,
};

export default function CategoryBadge({ category }) {
  const IconComponent = CATEGORY_ICONS[category] || HelpCircle;

  return (
    <span className="inline-flex items-center text-xs font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
      <IconComponent className="w-3 h-3 mr-1 text-slate-500" />
      {category}
    </span>
  );
}
