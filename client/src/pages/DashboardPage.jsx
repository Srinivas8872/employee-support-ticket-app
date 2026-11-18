import React from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Shield, Briefcase, CheckCircle2, ArrowRight, Layers, KeyRound } from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Welcome Banner */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-200">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 bg-blue-100 text-blue-700 rounded-2xl flex items-center justify-center font-bold text-xl shadow-inner">
              {user?.name ? user.name.charAt(0).toUpperCase() : <User className="w-7 h-7" />}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                  Welcome back, {user?.name}!
                </h1>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                {user?.email}
              </p>
            </div>
          </div>

          <div>
            {user?.role === 'Support' ? (
              <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
                <Shield className="w-3.5 h-3.5 mr-1.5 text-purple-600" />
                Support Staff Role
              </span>
            ) : (
              <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                <Briefcase className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                Employee Role
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Role-Aware Permissions & Phase 6 Status Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Authentication Status */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center space-x-3 text-emerald-600 mb-4">
            <div className="p-2 bg-emerald-50 rounded-xl">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <h2 className="text-base font-bold text-slate-900">
              Authentication Active
            </h2>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed mb-4">
            Your JWT token is securely verified by the backend. The session is restored automatically on refresh via <code>localStorage</code>.
          </p>
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">User ID:</span>
              <span className="font-mono text-[11px]">{user?.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Active Role:</span>
              <span className="font-semibold">{user?.role}</span>
            </div>
          </div>
        </div>

        {/* Role Permissions Card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center space-x-3 text-blue-600 mb-4">
            <div className="p-2 bg-blue-50 rounded-xl">
              <KeyRound className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-base font-bold text-slate-900">
              Role Permissions
            </h2>
          </div>
          {user?.role === 'Support' ? (
            <div className="text-xs text-slate-600 space-y-2">
              <p>As <strong>Support Staff</strong>, you have elevated authority to:</p>
              <ul className="list-disc list-inside space-y-1 text-slate-700 pl-1">
                <li>View all tickets in the system</li>
                <li>Triage ticket category and priority</li>
                <li>Advance status linearly (Open &rarr; In Progress &rarr; Resolved &rarr; Closed)</li>
                <li>Post comments on any ticket</li>
              </ul>
            </div>
          ) : (
            <div className="text-xs text-slate-600 space-y-2">
              <p>As an <strong>Employee</strong>, your privileges are scoped to:</p>
              <ul className="list-disc list-inside space-y-1 text-slate-700 pl-1">
                <li>Create new support requests</li>
                <li>View only tickets you have created</li>
                <li>Post comments on your own tickets</li>
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Phase Roadmap Card */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-6 text-slate-800">
        <div className="flex items-center space-x-2 text-blue-700 font-bold text-sm mb-2">
          <Layers className="w-4 h-4" />
          <span>Implementation Progress</span>
        </div>
        <p className="text-xs text-slate-600 mb-4">
          Phase 6 (Authentication, Routing & App Shell) is currently operational. Ticket listing, creation, and triage interfaces will be implemented in Phase 7.
        </p>
        <div className="flex items-center text-xs font-semibold text-blue-700">
          <span>Upcoming: Phase 7 (Frontend Ticket List, Creation & Triage)</span>
          <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
        </div>
      </div>
    </div>
  );
}
