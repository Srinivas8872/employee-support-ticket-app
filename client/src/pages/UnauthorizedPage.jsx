import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export default function UnauthorizedPage() {
  return (
    <div className="max-w-md mx-auto my-12 p-6 bg-white rounded-2xl shadow-sm border border-slate-200 text-center">
      <div className="w-14 h-14 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <ShieldAlert className="w-7 h-7" />
      </div>
      <h1 className="text-xl font-bold text-slate-900 mb-2">Access Denied</h1>
      <p className="text-xs text-slate-600 mb-6 leading-relaxed">
        You do not have the required permissions to view this resource. This section is restricted to specific user roles.
      </p>
      <Link
        to="/tickets"
        className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
      >
        <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
        Return to Dashboard
      </Link>
    </div>
  );
}
