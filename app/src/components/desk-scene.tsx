import { FileText, Monitor, ClipboardList, Clock, PiggyBank } from "lucide-react";

export type DeskItemId = "paper" | "monitor" | "clipboard" | "clock" | "vault";

type DeskItem = {
  id: DeskItemId;
  label: string;
  kicker: string;
  hint: string;
  Icon: typeof FileText;
  tone: "amber" | "cyan" | "violet" | "mint" | "rose";
  style: React.CSSProperties;
  rotate: number;
  size: "sm" | "md" | "lg";
  // Drop-in delay (ms) from the moment the item becomes visible
  delay: number;
};

const ITEMS: DeskItem[] = [
  {
    id: "paper",
    label: "Literature",
    kicker: "01 · The Paper",
    hint: "Novelty signal & references",
    Icon: FileText,
    tone: "amber",
    style: { top: "12%", left: "8%" },
    rotate: -7,
    size: "md",
    delay: 0,
  },
  {
    id: "monitor",
    label: "Overview",
    kicker: "02 · The Screen",
    hint: "Goal · approach · success criteria",
    Icon: Monitor,
    tone: "cyan",
    style: { top: "8%", left: "40%" },
    rotate: 0,
    size: "lg",
    delay: 80,
  },
  {
    id: "clipboard",
    label: "Protocol",
    kicker: "03 · The Checklist",
    hint: "Step-by-step methodology",
    Icon: ClipboardList,
    tone: "violet",
    style: { top: "10%", right: "8%" },
    rotate: 6,
    size: "md",
    delay: 200,
  },
  {
    id: "clock",
    label: "Timeline",
    kicker: "04 · The Clock",
    hint: "10-week phased breakdown",
    Icon: Clock,
    tone: "rose",
    style: { bottom: "10%", left: "18%" },
    rotate: -4,
    size: "md",
    delay: 320,
  },
  {
    id: "vault",
    label: "Budget",
    kicker: "05 · The Vault",
    hint: "Reagents · suppliers · cost",
    Icon: PiggyBank,
    tone: "mint",
    style: { bottom: "8%", right: "16%" },
    rotate: 5,
    size: "md",
    delay: 440,
  },
];

const TONE: Record<DeskItem["tone"], { glow: string; ring: string; accent: string }> = {
  amber: {
    glow: "hover:shadow-[0_30px_60px_-20px_oklch(0.62_0.13_70/0.6),0_0_0_1px_oklch(0.62_0.13_70/0.4)]",
    ring: "before:bg-signal-amber/20",
    accent: "text-signal-amber",
  },
  cyan: {
    glow: "hover:shadow-[0_30px_60px_-20px_oklch(0.5_0.1_220/0.6),0_0_0_1px_oklch(0.5_0.1_220/0.4)]",
    ring: "before:bg-signal-cyan/20",
    accent: "text-signal-cyan",
  },
  violet: {
    glow: "hover:shadow-[0_30px_60px_-20px_oklch(0.5_0.13_295/0.6),0_0_0_1px_oklch(0.5_0.13_295/0.4)]",
    ring: "before:bg-signal-violet/20",
    accent: "text-signal-violet",
  },
  mint: {
    glow: "hover:shadow-[0_30px_60px_-20px_oklch(0.55_0.11_160/0.6),0_0_0_1px_oklch(0.55_0.11_160/0.4)]",
    ring: "before:bg-signal-mint/20",
    accent: "text-signal-mint",
  },
  rose: {
    glow: "hover:shadow-[0_30px_60px_-20px_oklch(0.55_0.15_20/0.6),0_0_0_1px_oklch(0.55_0.15_20/0.4)]",
    ring: "before:bg-signal-rose/20",
    accent: "text-signal-rose",
  },
};

const SIZE: Record<DeskItem["size"], { box: string; icon: string }> = {
  sm: { box: "w-28 h-28 sm:w-32 sm:h-32", icon: "size-10" },
  md: { box: "w-36 h-36 sm:w-44 sm:h-44", icon: "size-14" },
  lg: { box: "w-48 h-40 sm:w-60 sm:h-48", icon: "size-16" },
};

export function DeskScene({
  visibleItems,
  onItemClick,
  centerSlot,
}: {
  /** Which items are currently dropped onto the desk. */
  visibleItems: DeskItemId[];
  onItemClick: (id: DeskItemId) => void;
  /** Optional content rendered in the center of the desk (e.g. the notebook input). */
  centerSlot?: React.ReactNode;
}) {
  return (
    <div className="desk-surface relative mx-auto w-full max-w-6xl aspect-[16/10] rounded-[2rem] overflow-hidden">
      {/* Edge vignette to suggest depth */}
      <div className="pointer-events-none absolute inset-0 rounded-[2rem] shadow-[inset_0_0_120px_60px_oklch(0.35_0.05_55/0.25)]" />

      {/* Lamp pool */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 50% 45% at 50% 40%, oklch(1 0 0 / 0.18), transparent 70%)",
        }}
      />

      {/* Engraved monogram */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <p className="font-display italic text-[14vw] sm:text-[10rem] leading-none text-foreground/[0.04] select-none">
          desk
        </p>
      </div>

      {/* Center slot — holds the notebook in State 1 */}
      {centerSlot && (
        <div className="absolute inset-0 flex items-center justify-center px-6 z-10 pointer-events-none">
          <div className="pointer-events-auto w-full max-w-xl">{centerSlot}</div>
        </div>
      )}

      {ITEMS.map((it) => {
        const tone = TONE[it.tone];
        const size = SIZE[it.size];
        const isVisible = visibleItems.includes(it.id);
        if (!isVisible) return null;
        return (
          <button
            key={it.id}
            onClick={() => onItemClick(it.id)}
            style={{
              ...it.style,
              ["--rot" as string]: `${it.rotate}deg`,
              animationDelay: `${it.delay}ms`,
            }}
            className={[
              "desk-object desk-drop group absolute",
              size.box,
              "rounded-2xl bg-card/95 backdrop-blur-sm",
              "border border-border-strong",
              "flex flex-col items-center justify-center gap-2",
              "transition-[transform,box-shadow] duration-300 ease-out will-change-transform",
              "hover:!translate-y-[-10px] hover:scale-[1.04] hover:z-20",
              tone.glow,
              "before:content-[''] before:absolute before:inset-0 before:rounded-2xl before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300 before:pointer-events-none",
              tone.ring,
            ].join(" ")}
            aria-label={it.label}
          >
            <it.Icon
              className={`${size.icon} ${tone.accent} relative z-10`}
              strokeWidth={1.4}
            />
            <div className="relative z-10 text-center px-2">
              <p className="mono text-[9px] sm:text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {it.kicker}
              </p>
              <p className="font-display italic text-base sm:text-lg leading-tight text-foreground">
                {it.label}
              </p>
              <p className="mt-0.5 text-[10px] sm:text-[11px] text-muted-foreground/80 hidden sm:block">
                {it.hint}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
