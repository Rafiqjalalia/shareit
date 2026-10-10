'use client';

import React from 'react';
import {
  Crown,
  Check,
  X,
  Zap,
  Globe,
  Lock,
  Clock,
  HardDrive,
  Sparkles,
} from 'lucide-react';
import { FREE_TIER_LIMITS, PREMIUM_TIER_LIMITS } from '@/lib/types';

interface PremiumModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PremiumModal: React.FC<PremiumModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-indigo-500/30 rounded-3xl p-6 md:p-8 shadow-2xl shadow-indigo-950/50 overflow-hidden">
        {/* Ambient Top Glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-48 bg-gradient-to-b from-indigo-500/30 via-purple-500/20 to-transparent blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center space-y-2 mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full text-amber-300 text-xs font-bold">
            <Crown className="w-4 h-4 text-amber-400" />
            Monetization & Upgrade Tier
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white">
            ShaeIt Premium Plan
          </h2>
          <p className="text-xs md:text-sm text-slate-400">
            Unlock maximum cloud file storage, 7-day link retention, and password protection
          </p>
        </div>

        {/* Plan Comparison Table */}
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          {/* Free Tier Card */}
          <div className="p-5 bg-slate-950/60 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-white text-base">Free Plan</h3>
                <p className="text-[11px] text-slate-400">Default for all users</p>
              </div>
              <span className="text-lg font-extrabold text-slate-300">$0</span>
            </div>

            <ul className="space-y-3 text-xs text-slate-300">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>P2P Wi-Fi Transfer: Up to 2GB</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Temp Cloud Share: Max 100MB</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Link Expiration: 1 Hour</span>
              </li>
              <li className="flex items-center gap-2 text-slate-500 line-through">
                <X className="w-4 h-4 shrink-0" />
                <span>Password Protection</span>
              </li>
              <li className="flex items-center gap-2 text-slate-500 line-through">
                <X className="w-4 h-4 shrink-0" />
                <span>Custom Short URLs</span>
              </li>
            </ul>
          </div>

          {/* Premium Tier Card */}
          <div className="relative p-5 bg-gradient-to-b from-indigo-950/50 to-slate-950/80 rounded-2xl border-2 border-indigo-500/50 space-y-4 shadow-lg shadow-indigo-950/40">
            <div className="absolute -top-3 right-4 px-2.5 py-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-[10px] font-extrabold text-white rounded-full uppercase tracking-wider shadow-md">
              POPULAR
            </div>

            <div className="flex items-center justify-between border-b border-indigo-500/30 pb-3">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  Premium Pro
                </h3>
                <p className="text-[11px] text-indigo-300">For heavy file power users</p>
              </div>
              <div className="text-right">
                <span className="text-lg font-extrabold text-amber-400">$4.99</span>
                <span className="text-[10px] text-slate-400">/month</span>
              </div>
            </div>

            <ul className="space-y-3 text-xs text-slate-200">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-bold text-white">Unlimited P2P File Transfers</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-bold text-white">Temp Cloud Share: Up to 5GB</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Link Expiration: Up to 7 Days (168h)</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Password Protected Share Links</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Custom Short URL Alias</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Call to Action */}
        <div className="space-y-3">
          <button
            onClick={() => {
              alert('Monetization Ready! You can connect Stripe, Razorpay, or JazzCash API here.');
            }}
            className="w-full py-3.5 bg-gradient-to-r from-amber-500 via-indigo-600 to-purple-600 hover:opacity-95 text-white font-extrabold rounded-xl shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 text-sm transition-all"
          >
            <Crown className="w-5 h-5 text-amber-300" />
            Unlock Premium Access ($4.99 / mo)
          </button>

          <p className="text-center text-[11px] text-slate-500">
            Cancel anytime • Guaranteed zero VPS server maintenance costs
          </p>
        </div>
      </div>
    </div>
  );
};
