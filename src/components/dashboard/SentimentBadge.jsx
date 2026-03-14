import React from "react";
import { Badge } from "@/components/ui/badge";

const sentimentConfig = {
  positive: { label: "Positive", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  negative: { label: "Negative", className: "bg-red-50 text-red-700 border-red-200" },
  neutral: { label: "Neutral", className: "bg-slate-50 text-slate-700 border-slate-200" },
  mixed: { label: "Mixed", className: "bg-amber-50 text-amber-700 border-amber-200" },
};

export default function SentimentBadge({ sentiment }) {
  const config = sentimentConfig[sentiment] || sentimentConfig.neutral;
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}