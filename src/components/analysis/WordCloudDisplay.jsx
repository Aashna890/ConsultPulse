import React, { useMemo } from "react";

export default function WordCloudDisplay({ keywords }) {
  const wordFreq = useMemo(() => {
    const freq = {};
    (keywords || []).forEach((word) => {
      const w = word.toLowerCase().trim();
      if (w) freq[w] = (freq[w] || 0) + 1;
    });
    return Object.entries(freq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 60);
  }, [keywords]);

  if (wordFreq.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
        No keywords to display
      </div>
    );
  }

  const maxFreq = wordFreq[0]?.[1] || 1;

  const colors = [
    "text-blue-600", "text-indigo-600", "text-purple-600",
    "text-emerald-600", "text-teal-600", "text-cyan-600",
    "text-rose-600", "text-orange-600", "text-amber-600",
    "text-slate-700",
  ];

  const shuffled = useMemo(() => {
    const arr = [...wordFreq];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [wordFreq]);

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 py-4 px-2">
      {shuffled.map(([word, count], i) => {
        const ratio = count / maxFreq;
        const size = Math.max(0.75, 0.75 + ratio * 1.75);
        const opacity = Math.max(0.5, 0.5 + ratio * 0.5);
        const colorClass = colors[i % colors.length];

        return (
          <span
            key={word}
            className={`${colorClass} font-medium cursor-default transition-transform hover:scale-110`}
            style={{ fontSize: `${size}rem`, opacity }}
            title={`${word}: ${count} occurrence${count > 1 ? "s" : ""}`}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
}