interface Props {
  type: "error" | "warning" | "info" | "success";
  message: string;
  className?: string;
}

const STYLES = {
  error:   "bg-red-50 border-red-200 text-red-800",
  warning: "bg-amber-50 border-amber-200 text-amber-800",
  info:    "bg-blue-50 border-blue-200 text-blue-800",
  success: "bg-emerald-50 border-emerald-200 text-emerald-800",
};

const ICONS = {
  error:   "✕",
  warning: "⚠",
  info:    "ℹ",
  success: "✓",
};

export default function ValidationMessage({ type, message, className = "" }: Props) {
  return (
    <div className={`flex items-start gap-2 border rounded-lg px-3 py-2 text-sm ${STYLES[type]} ${className}`}>
      <span className="font-bold shrink-0 mt-0.5">{ICONS[type]}</span>
      <span>{message}</span>
    </div>
  );
}
