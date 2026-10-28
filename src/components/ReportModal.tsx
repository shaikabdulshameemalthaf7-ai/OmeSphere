import React, { useState } from 'react';
import { Flag, X, AlertTriangle, ShieldAlert } from 'lucide-react';
import { soundEffects } from '../utils/soundEffects';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitReport: (reason: string, comment: string) => void;
  peerId: string;
}

const REPORT_REASONS = [
  { id: 'nudity', label: 'Nudity or Sexual Content', desc: 'Displaying explicit content or inappropriate exposure' },
  { id: 'harassment', label: 'Harassment, Hate Speech or Threats', desc: 'Abusive language, bullying, or discrimination' },
  { id: 'bot_spam', label: 'Automated Bot, Scam or Commercial Spam', desc: 'Pre-recorded video, promotional links, or scam' },
  { id: 'underage', label: 'Underage User Concern', desc: 'Suspected user under 18 years of age' },
  { id: 'other', label: 'Other Terms of Service Violation', desc: 'Any other violation of community safety rules' },
];

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  onSubmitReport,
  peerId,
}) => {
  const [selectedReason, setSelectedReason] = useState(REPORT_REASONS[0].id);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    soundEffects.playClick();
    onSubmitReport(selectedReason, comment);
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <Flag className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Report Stranger</h3>
              <p className="text-xs text-neutral-400">Help keep OmeSphere safe and respectful</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-white rounded-xl hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {submitted ? (
          <div className="py-8 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <h4 className="text-base font-bold text-white">Report Submitted</h4>
            <p className="text-xs text-neutral-400 max-w-xs mx-auto">
              This stranger has been reported and blocked from matching with you again. Disconnecting now.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-400 block">
                Select Reason
              </label>
              <div className="space-y-2">
                {REPORT_REASONS.map((reason) => (
                  <label
                    key={reason.id}
                    className={`flex items-start p-3 rounded-xl border cursor-pointer transition-all ${
                      selectedReason === reason.id
                        ? 'bg-red-500/10 border-red-500/40 text-white'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="report_reason"
                      value={reason.id}
                      checked={selectedReason === reason.id}
                      onChange={() => setSelectedReason(reason.id)}
                      className="mt-1 text-red-600 focus:ring-red-500"
                    />
                    <div className="ml-3">
                      <span className="text-xs font-semibold block">{reason.label}</span>
                      <span className="text-[11px] text-neutral-400 block mt-0.5">{reason.desc}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-400 block mb-1">
                Additional details (optional)
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Describe what occurred..."
                rows={2}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-red-500 resize-none"
              />
            </div>

            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Submitting will immediately disconnect and skip to the next stranger.</span>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg shadow-red-600/30 transition-colors cursor-pointer"
              >
                Report & Block
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
