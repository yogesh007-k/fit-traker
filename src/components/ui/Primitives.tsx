import React from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { Exercise } from '../../types/fitness';
import { ToastItem } from '../../context/FitnessContext';

export const PageHeader: React.FC<{
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}> = ({ title, subtitle, actions }) => (
  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between border-b border-white/10 pb-5 mb-6">
    <div>
      <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#F5F7F5] [text-wrap:balance]">
        {title}
      </h1>
      {subtitle && <p className="text-sm text-[#A0AAA7] mt-1 max-w-2xl">{subtitle}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-3 shrink-0">{actions}</div>}
  </div>
);

export const Card: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => (
  <div
    className={`bg-[#151D20] border border-white/10 rounded-xl p-5 transition-colors duration-200 ${className}`}
  >
    {children}
  </div>
);

export const PrimaryButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }
> = ({ children, className = '', loading, disabled, ...props }) => (
  <button
    {...props}
    disabled={disabled || loading}
    className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-[#B7FF67] text-[#080B0D] hover:bg-[#c8ff8a] active:scale-[0.99] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0 cursor-pointer ${className}`}
  >
    {loading && (
      <span className="w-4 h-4 border-2 border-[#080B0D]/30 border-t-[#080B0D] rounded-full animate-spin" />
    )}
    {children}
  </button>
);

export const SecondaryButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({
  children,
  className = '',
  ...props
}) => (
  <button
    {...props}
    className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-[#101619] text-[#F5F7F5] border border-white/15 hover:border-[#40E0D0]/60 hover:text-[#40E0D0] transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0 cursor-pointer ${className}`}
  >
    {children}
  </button>
);

export const EmptyState: React.FC<{
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ title, description, actionLabel, onAction }) => (
  <div className="bg-[#101619] border border-dashed border-white/15 rounded-xl p-8 text-center flex flex-col items-center justify-center">
    <h3 className="text-base font-semibold text-[#F5F7F5]">{title}</h3>
    <p className="text-sm text-[#A0AAA7] mt-1.5 max-w-md">{description}</p>
    {actionLabel && onAction && (
      <PrimaryButton onClick={onAction} className="mt-4">
        {actionLabel}
      </PrimaryButton>
    )}
  </div>
);

export const ProgressBar: React.FC<{
  value: number;
  max: number;
  color?: 'lime' | 'cyan' | 'amber' | 'red';
  label?: string;
}> = ({ value, max, color = 'lime', label }) => {
  const pct = Math.max(0, Math.min(100, max > 0 ? Math.round((value / max) * 100) : 0));
  const colorClass =
    color === 'cyan'
      ? 'bg-[#40E0D0]'
      : color === 'amber'
        ? 'bg-amber-400'
        : color === 'red'
          ? 'bg-red-500'
          : 'bg-[#B7FF67]';

  return (
    <div>
      {label && (
        <div className="flex justify-between text-xs text-[#A0AAA7] mb-1.5 tabular-nums">
          <span>{label}</span>
          <span>
            {Math.round(value)} / {Math.round(max)} ({pct}%)
          </span>
        </div>
      )}
      <div className="w-full h-2 rounded-full bg-[#080B0D] overflow-hidden border border-white/5">
        <div
          className={`h-full rounded-full transition-all duration-300 ${colorClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

export const CircularProgress: React.FC<{
  value: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  accent?: string;
}> = ({ value, size = 104, strokeWidth = 8, label, accent = '#B7FF67' }) => {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke={accent}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-xl font-bold font-mono tabular-nums text-[#F5F7F5]">{clamped}</span>
        {label && <span className="text-[11px] text-[#A0AAA7]">{label}</span>}
      </div>
    </div>
  );
};

export const ToastContainer: React.FC<{
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full px-4 sm:px-0 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className="pointer-events-auto flex items-start gap-3 bg-[#151D20] border border-white/15 rounded-xl px-4 py-3 shadow-xl text-sm text-[#F5F7F5]"
        >
          {t.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-[#B7FF67] shrink-0 mt-0.5" />
          ) : t.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          ) : (
            <Info className="w-4 h-4 text-[#40E0D0] shrink-0 mt-0.5" />
          )}
          <span className="flex-1">{t.message}</span>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => onDismiss(t.id)}
            className="text-[#A0AAA7] hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};

export const ConfirmDialog: React.FC<{
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ open, title, message, confirmLabel = 'Confirm', danger, onConfirm, onCancel }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="bg-[#151D20] border border-white/15 rounded-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold text-[#F5F7F5]">{title}</h3>
        <p className="text-sm text-[#A0AAA7] mt-2">{message}</p>
        <div className="flex justify-end gap-3 mt-6">
          <SecondaryButton onClick={onCancel}>Cancel</SecondaryButton>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer ${
              danger
                ? 'bg-red-500 text-white hover:bg-red-400'
                : 'bg-[#B7FF67] text-[#080B0D] hover:bg-[#c8ff8a]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Clean biomechanical SVG demonstration card for each exercise pose category.
 * Ensures every single one of the 181 exercises renders a crisp technical diagram.
 */
export const ExercisePoseDiagram: React.FC<{ pose: Exercise['visualPose']; label: string }> = ({
  pose,
  label,
}) => {
  const accent = '#B7FF67';
  const secondary = '#40E0D0';

  return (
    <div className="relative w-full h-28 rounded-lg bg-[#080B0D] border border-white/10 overflow-hidden flex items-center justify-center">
      <svg viewBox="0 0 180 96" className="w-full h-full" aria-label={`${label} movement diagram`}>
        <defs>
          <pattern id={`grid-${pose}`} width="16" height="16" patternUnits="userSpaceOnUse">
            <path d="M 16 0 L 0 0 0 16" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="180" height="96" fill={`url(#grid-${pose})`} />
        <line x1="20" y1="84" x2="160" y2="84" stroke="rgba(255,255,255,0.14)" strokeWidth="1.5" />

        {pose === 'press' && (
          <g strokeLinecap="round" strokeLinejoin="round" fill="none">
            <rect x="44" y="64" width="92" height="7" rx="3" fill="#1E292E" stroke="#33434A" />
            <circle cx="58" cy="56" r="6" stroke="#F5F7F5" strokeWidth="2" />
            <line x1="64" y1="58" x2="108" y2="58" stroke="#F5F7F5" strokeWidth="3" />
            <line x1="86" y1="58" x2="86" y2="24" stroke={accent} strokeWidth="3" />
            <line x1="56" y1="24" x2="116" y2="24" stroke={secondary} strokeWidth="3" />
            <circle cx="56" cy="24" r="5" fill={secondary} />
            <circle cx="116" cy="24" r="5" fill={secondary} />
            <path d="M 86 40 L 86 15 M 82 19 L 86 15 L 90 19" stroke={accent} strokeWidth="1.5" />
          </g>
        )}

        {pose === 'pull' && (
          <g strokeLinecap="round" strokeLinejoin="round" fill="none">
            <line x1="40" y1="14" x2="140" y2="14" stroke={secondary} strokeWidth="3" />
            <line x1="68" y1="14" x2="80" y2="38" stroke={accent} strokeWidth="2.5" />
            <line x1="112" y1="14" x2="100" y2="38" stroke={accent} strokeWidth="2.5" />
            <circle cx="90" cy="30" r="6" stroke="#F5F7F5" strokeWidth="2" />
            <line x1="90" y1="36" x2="90" y2="62" stroke="#F5F7F5" strokeWidth="3" />
            <line x1="90" y1="62" x2="82" y2="82" stroke="#A0AAA7" strokeWidth="2.5" />
            <line x1="90" y1="62" x2="98" y2="82" stroke="#A0AAA7" strokeWidth="2.5" />
            <path d="M 128 52 L 128 28 M 124 32 L 128 28 L 132 32" stroke={accent} strokeWidth="1.5" />
          </g>
        )}

        {pose === 'squat' && (
          <g strokeLinecap="round" strokeLinejoin="round" fill="none">
            <circle cx="88" cy="24" r="6" stroke="#F5F7F5" strokeWidth="2" />
            <line x1="66" y1="30" x2="110" y2="30" stroke={secondary} strokeWidth="3" />
            <line x1="88" y1="30" x2="76" y2="54" stroke={accent} strokeWidth="3" />
            <line x1="76" y1="54" x2="102" y2="60" stroke={accent} strokeWidth="3" />
            <line x1="102" y1="60" x2="94" y2="83" stroke="#F5F7F5" strokeWidth="3" />
            <circle cx="102" cy="60" r="3" fill={secondary} />
            <path d="M 130 34 L 130 58 M 126 54 L 130 58 L 134 54" stroke={accent} strokeWidth="1.5" />
          </g>
        )}

        {pose === 'hinge' && (
          <g strokeLinecap="round" strokeLinejoin="round" fill="none">
            <circle cx="116" cy="36" r="6" stroke="#F5F7F5" strokeWidth="2" />
            <line x1="112" y1="40" x2="76" y2="52" stroke={accent} strokeWidth="3" />
            <line x1="76" y1="52" x2="84" y2="83" stroke="#F5F7F5" strokeWidth="3" />
            <line x1="104" y1="44" x2="104" y2="74" stroke={secondary} strokeWidth="2.5" />
            <circle cx="104" cy="76" r="6" stroke={secondary} strokeWidth="2.5" />
            <path d="M 52 54 A 24 24 0 0 1 70 36" stroke={accent} strokeWidth="1.5" />
          </g>
        )}

        {(pose === 'curl' || pose === 'extension') && (
          <g strokeLinecap="round" strokeLinejoin="round" fill="none">
            <circle cx="86" cy="20" r="6" stroke="#F5F7F5" strokeWidth="2" />
            <line x1="86" y1="26" x2="86" y2="56" stroke="#F5F7F5" strokeWidth="3" />
            <line x1="86" y1="56" x2="82" y2="83" stroke="#A0AAA7" strokeWidth="2.5" />
            <line x1="86" y1="32" x2="86" y2="50" stroke={secondary} strokeWidth="2.5" />
            <line x1="86" y1="50" x2="112" y2="38" stroke={accent} strokeWidth="3" />
            <circle cx="114" cy="37" r="4" fill={accent} />
            <path d="M 118 52 A 20 20 0 0 0 116 26" stroke={accent} strokeWidth="1.5" />
          </g>
        )}

        {pose === 'core' && (
          <g strokeLinecap="round" strokeLinejoin="round" fill="none">
            <circle cx="132" cy="54" r="6" stroke="#F5F7F5" strokeWidth="2" />
            <line x1="126" y1="58" x2="54" y2="70" stroke={accent} strokeWidth="3.5" />
            <line x1="120" y1="60" x2="120" y2="83" stroke={secondary} strokeWidth="2.5" />
            <line x1="54" y1="70" x2="46" y2="83" stroke="#F5F7F5" strokeWidth="2.5" />
          </g>
        )}

        {(pose === 'carry' || pose === 'cardio' || pose === 'mobility') && (
          <g strokeLinecap="round" strokeLinejoin="round" fill="none">
            <circle cx="90" cy="22" r="6" stroke="#F5F7F5" strokeWidth="2" />
            <line x1="90" y1="28" x2="90" y2="56" stroke={accent} strokeWidth="3" />
            <line x1="90" y1="34" x2="72" y2="48" stroke={secondary} strokeWidth="2.5" />
            <line x1="90" y1="34" x2="108" y2="48" stroke={secondary} strokeWidth="2.5" />
            <line x1="90" y1="56" x2="74" y2="82" stroke="#F5F7F5" strokeWidth="2.5" />
            <line x1="90" y1="56" x2="106" y2="82" stroke="#F5F7F5" strokeWidth="2.5" />
            <circle cx="70" cy="52" r="3.5" fill={accent} />
            <circle cx="110" cy="52" r="3.5" fill={accent} />
          </g>
        )}
      </svg>
    </div>
  );
};
