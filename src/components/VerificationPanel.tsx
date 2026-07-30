import React, { useState } from 'react';
import { VerificationReport } from '../types';
import { ShieldCheck, ChevronDown, ChevronRight, CheckCircle2, AlertTriangle, AlertCircle, HelpCircle, XCircle } from 'lucide-react';

interface VerificationPanelProps {
  verification: VerificationReport;
  onQuoteClick: (quote: string) => void;
}

export function VerificationPanel({ verification, onQuoteClick }: VerificationPanelProps) {
  const [expanded, setExpanded] = useState(false);

  const getVerdictIcon = (verdict: string) => {
    switch (verdict) {
      case 'confirmed': return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />;
      case 'probable': return <HelpCircle className="w-3.5 h-3.5 text-amber-500" />;
      case 'gap': return <HelpCircle className="w-3.5 h-3.5 text-white/40" />;
      case 'disputed': return <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />;
      case 'fabricated': return <XCircle className="w-3.5 h-3.5 text-rose-500" />;
      default: return null;
    }
  };

  const getVerdictColor = (verdict: string) => {
    switch (verdict) {
      case 'confirmed': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
      case 'probable': return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
      case 'gap': return 'text-white/60 bg-white/5 border-white/10';
      case 'disputed': return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
      case 'fabricated': return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
      default: return '';
    }
  };

  return (
    <div className="space-y-4 mb-8">
      {verification.flagged && (
        <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-sm font-medium">
          <AlertCircle className="w-4 h-4 shrink-0" />
          This analysis contains claims the transcript does not support.
        </div>
      )}

      <div className="bg-[#121214] border border-white/10 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-500" />
            <h3 className="text-sm font-bold uppercase tracking-widest text-white/80">Verification Pass</h3>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            {Object.entries(verification.counts).map(([verdict, count]) => {
              if (count === 0) return null;
              return (
                <div key={verdict} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${getVerdictColor(verdict)}`}>
                  {getVerdictIcon(verdict)}
                  <span className="capitalize">{verdict}</span>
                  <span className="opacity-80 ml-1">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-white/10 pt-4">
          <div className="flex items-center gap-3">
            <div className="group relative">
              <span className="text-lg font-serif text-white/90 underline decoration-white/20 decoration-dashed cursor-help">
                {verification.supportScore !== null ? `${verification.supportScore}% Supported` : 'No claims extracted'}
              </span>
              <div className="absolute left-0 bottom-full mb-2 w-64 p-2 bg-[#1a1a1a] border border-white/10 rounded-lg text-xs text-white/70 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-xl">
                Confirmed counts full, probable counts half, gap counts zero. Disputed and fabricated count zero.
              </div>
            </div>
            <span className="text-xs text-white/40">Verified by {verification.judgeModel}</span>
          </div>

          <button 
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-amber-500/80 hover:text-amber-500 transition-colors"
          >
            {expanded ? 'Hide Claims' : 'View Claims'}
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>

        {expanded && (
          <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
            {verification.claims.map((claim) => (
              <div key={claim.id} className="p-3 bg-white/5 rounded-lg border border-white/5 space-y-2">
                <div className="flex items-start justify-between gap-4">
                  <p className="text-sm text-white/90 font-medium leading-relaxed">{claim.claim}</p>
                  <div className={`shrink-0 flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider ${getVerdictColor(claim.verdict)}`}>
                    {getVerdictIcon(claim.verdict)}
                    {claim.verdict}
                  </div>
                </div>
                
                <div className="text-xs text-white/50 bg-black/20 p-2 rounded">
                  <span className="font-semibold text-white/70">Reasoning:</span> {claim.reasoning}
                </div>
                
                {claim.quote && (
                  <button 
                    onClick={() => onQuoteClick(claim.quote!)}
                    className="text-xs text-amber-500/80 hover:text-amber-500 italic text-left w-full hover:bg-amber-500/10 p-2 rounded transition-colors"
                  >
                    "{claim.quote}"
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
