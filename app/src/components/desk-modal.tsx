import { X } from "lucide-react";
import { useEffect } from "react";

export function DeskModal({
  open,
  onClose,
  title,
  kicker,
  children,
  footer,
  toneClass = "text-primary",
  size = "lg",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  kicker: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  toneClass?: string;
  size?: "md" | "lg" | "xl";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = {
    md: "max-w-xl",
    lg: "max-w-3xl",
    xl: "max-w-5xl",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Blurred backdrop */}
      <div className="absolute inset-0 bg-foreground/40 backdrop-blur-md" aria-hidden />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full ${widths[size]} max-h-[88vh] overflow-hidden rounded-3xl bg-card border border-border-strong shadow-[0_40px_120px_-20px_oklch(0.2_0.02_60/0.5)] animate-in zoom-in-95 slide-in-from-bottom-2 duration-300`}
      >
        <header className="flex items-start justify-between gap-4 px-6 sm:px-8 pt-6 sm:pt-7 pb-4 border-b border-border">
          <div>
            <p className={`text-[11px] uppercase tracking-[0.18em] mono ${toneClass}`}>{kicker}</p>
            <h2 className="font-display italic text-3xl sm:text-4xl leading-tight mt-1">{title}</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="size-9 grid place-items-center rounded-full border border-border-strong bg-surface hover:bg-surface-2 hover:border-foreground/40 transition-colors shrink-0"
          >
            <X className="size-4" strokeWidth={2} />
          </button>
        </header>

        <div className="overflow-y-auto px-6 sm:px-8 py-6 max-h-[calc(88vh-180px)] scrollbar-thin">
          {children}
        </div>

        {footer && (
          <footer className="px-6 sm:px-8 py-4 border-t border-border bg-surface/50 flex items-center justify-end gap-3">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
