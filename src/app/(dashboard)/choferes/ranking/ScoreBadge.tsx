import { Minus } from "lucide-react";

interface Props {
  score: number | null;
  size?: "sm" | "md";
}

export default function ScoreBadge({ score, size = "md" }: Props) {
  const px = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-0.5 text-xs";

  if (score === null) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded font-medium bg-muted text-muted-foreground ${px}`}
      >
        <Minus size={10} />
        Sin actividad
      </span>
    );
  }
  if (score >= 80) {
    return (
      <span
        className={`inline-flex items-center rounded font-semibold bg-[#ECFDF5] text-[#064E3B] ${px}`}
      >
        {score}
      </span>
    );
  }
  if (score >= 60) {
    return (
      <span
        className={`inline-flex items-center rounded font-semibold bg-[#FFFBEB] text-[#78350F] ${px}`}
      >
        {score}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center rounded font-semibold bg-[#FEF2F2] text-[#7F1D1D] ${px}`}
    >
      {score}
    </span>
  );
}
