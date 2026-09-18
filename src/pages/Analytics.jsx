import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { consultationApi, commentApi, analyticsApi } from "@/api/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { Cpu, Zap, Brain, TrendingUp, Database, AlertCircle } from "lucide-react";

// ── Inline SentimentDonut (avoids import path issues) ─────────────
import { PieChart as RPieChart, Pie as RPie, Cell as RCell, Tooltip as RTooltip, ResponsiveContainer as RRC } from "recharts";

function SentimentDonut({ data }) {
  const COLORS = { positive:"#10b981", negative:"#ef4444", neutral:"#94a3b8", mixed:"#f59e0b" };
  const chartData = Object.entries(data)
    .map(([name, value]) => ({ name, value }))
    .filter((d) => d.value > 0);
  const total = chartData.reduce((s, d) => s + d.value, 0);

  if (total === 0) return (
    <div className="flex items-center justify-center h-48 text-slate-400 text-sm">No data available</div>
  );

  return (
    <div className="relative h-48">
      <RRC width="100%" height="100%">
        <RPieChart>
          <RPie data={chartData} innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
            {chartData.map((entry, i) => (
              <RCell key={i} fill={COLORS[entry.name]} stroke="none" />
            ))}
          </RPie>
          <RTooltip formatter={(v, n) => [`${v} comments`, n]}
            contentStyle={{ borderRadius:8, border:"1px solid #e2e8f0" }} />
        </RPieChart>
      </RRC>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-center">
          <p className="text-2xl font-bold text-slate-900">{total}</p>
          <p className="text-xs text-slate-400">Total</p>
        </div>
      </div>
    </div>
  );
}

// ── Word Cloud ─────────────────────────────────────────────────────
function WordCloud({ keywords }) {
  const freq = {};
  (keywords || []).forEach((w) => { const k = w.toLowerCase().trim(); if (k) freq[k] = (freq[k]||0)+1; });
  const words = Object.entries(freq).sort(([,a],[,b])=>b-a).slice(0,60);
  if (words.length === 0) return (
    <div className="flex items-center justify-center h-32 text-slate-400 text-sm">No keywords yet</div>
  );
  const maxF = words[0]?.[1] || 1;
  const COLORS = ["text-blue-600","text-indigo-600","text-purple-600","text-emerald-600",
    "text-teal-600","text-cyan-600","text-rose-600","text-orange-600","text-amber-600","text-slate-700"];
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 py-4 px-2">
      {words.map(([word, count], i) => {
        const ratio = count / maxF;
        return (
          <span key={word} className={`${COLORS[i%COLORS.length]} font-medium cursor-default hover:scale-110 transition-transform`}
            style={{ fontSize:`${Math.max(0.75, 0.75+ratio*1.75)}rem`, opacity:Math.max(0.5,0.5+ratio*0.5) }}
            title={`${word}: ${count}`}>
            {word}
          </span>
        );
      })}
    </div>
  );
}

// ── Constants ──────────────────────────────────────────────────────
const SENT_COLORS = { positive:"#10b981", negative:"#ef4444", neutral:"#94a3b8", mixed:"#f59e0b" };
const STK_COLORS  = ["#6366f1","#8b5cf6","#ec4899","#f97316","#14b8a6","#3b82f6","#eab308","#64748b"];

// ── Main ───────────────────────────────────────────────────────────
export default function Analytics() {
  const [selectedConsultation, setSelectedConsultation] = useState("all");

  const { data: consultations = [], isLoading: loadingC, isError } = useQuery({
    queryKey: ["consultations"],
    queryFn: consultationApi.list,
    retry: 1,
  });

  const { data: allComments = [], isLoading: loadingComm } = useQuery({
    queryKey: ["all-comments"],
    queryFn: () => commentApi.list(),
    retry: 1,
  });

  const { data: modelStats } = useQuery({
    queryKey: ["model-stats"],
    queryFn: analyticsApi.modelStats,
    retry: 1,
  });

  const isLoading = loadingC || loadingComm;

  // Filter comments by selected consultation
  const comments = selectedConsultation === "all"
    ? allComments
    : allComments.filter((c) => c.consultation_id === selectedConsultation);

  const analysed = comments.filter((c) => c.is_analysed);

  // Sentiment counts
  const sentimentCounts = {
    positive: analysed.filter((c) => c.sentiment === "positive").length,
    negative: analysed.filter((c) => c.sentiment === "negative").length,
    neutral:  analysed.filter((c) => c.sentiment === "neutral").length,
    mixed:    analysed.filter((c) => c.sentiment === "mixed").length,
  };

  // Stakeholder breakdown
  const stakeholderData = Object.entries(
    analysed.reduce((acc, c) => {
      const t = (c.stakeholder_type || "unknown").replace(/_/g, " ");
      acc[t] = (acc[t] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  // Sentiment by stakeholder
  const sentByStakeholder = Object.entries(
    analysed.reduce((acc, c) => {
      const t = (c.stakeholder_type || "unknown").replace(/_/g, " ");
      if (!acc[t]) acc[t] = { positive:0, negative:0, neutral:0, mixed:0 };
      if (c.sentiment) acc[t][c.sentiment]++;
      return acc;
    }, {})
  ).map(([name, d]) => ({ name, ...d }));

  // Sentiment by comment type
  const sentByType = ["overall","provision_specific"].map((type) => ({
    name: type === "overall" ? "Overall" : "Provision",
    ...analysed.filter((c) => c.comment_type === type).reduce(
      (acc, c) => { if (c.sentiment) acc[c.sentiment] = (acc[c.sentiment]||0)+1; return acc; },
      { positive:0, negative:0, neutral:0, mixed:0 }
    ),
  }));

  const allKeywords  = analysed.flatMap((c) => c.keywords || []);
  const corrections  = analysed.filter((c) => c.vader_raw && c.sentiment !== c.vader_raw?.sentiment);

  // ── Offline banner ──
  if (isError) return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
      <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-red-800">Cannot connect to backend</p>
          <code className="block mt-2 text-xs bg-red-100 text-red-800 px-3 py-2 rounded font-mono">
            cd backend &amp;&amp; python main.py
          </code>
        </div>
      </div>
    </div>
  );

  if (isLoading) return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[1,2,3,4].map((i) => <Skeleton key={i} className="h-64" />)}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
          <p className="text-slate-500 text-sm mt-1">Sentiment analysis & model insights</p>
        </div>
        <select value={selectedConsultation}
          onChange={(e) => setSelectedConsultation(e.target.value)}
          className="h-9 w-64 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all">All Consultations</option>
          {consultations.map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>
      </div>

      {/* ── Pipeline Card ── */}
      <Card className="border-blue-100 bg-blue-50/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Cpu className="w-4 h-4 text-blue-600" /> Analysis Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {[
              { icon:<Zap className="w-4 h-4 text-amber-500"/>, label:"VADER", sub:"Rule-based NLP" },
              null,
              { icon:<Database className="w-4 h-4 text-purple-500"/>, label:"ML Model",
                sub: modelStats?.accuracy ? `Acc: ${(modelStats.accuracy*100).toFixed(1)}%` : "Logistic Regression" },
              null,
              { icon:<Brain className="w-4 h-4 text-blue-500"/>, label:"Gemini 2.0 Flash", sub:"Correction + Summary" },
            ].map((item, i) =>
              item === null
                ? <span key={i} className="text-slate-400 font-bold text-lg">→</span>
                : (
                  <div key={i} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border shadow-sm">
                    {item.icon}
                    <div>
                      <p className="font-medium text-slate-800 text-xs">{item.label}</p>
                      <p className="text-xs text-slate-500">{item.sub}</p>
                    </div>
                  </div>
                )
            )}
          </div>

          <div className="flex flex-wrap gap-3 mt-3">
            {modelStats?.vader_accuracy !== undefined && (
              <>
                <Badge variant="outline" className="bg-white text-xs">
                  VADER: {(modelStats.vader_accuracy*100).toFixed(1)}%
                </Badge>
                <Badge variant="outline" className="bg-white text-green-700 border-green-200 text-xs">
                  ML Model: {(modelStats.accuracy*100).toFixed(1)}%
                  {modelStats.improvement_over_vader_pct > 0 && ` (+${modelStats.improvement_over_vader_pct}%)`}
                </Badge>
              </>
            )}
            {analysed.length > 0 && corrections.length > 0 && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                Gemini corrected {corrections.length}/{analysed.length} predictions
                ({Math.round((corrections.length/analysed.length)*100)}%)
              </Badge>
            )}
            {modelStats?.datasets?.length > 0 && (
              <span className="text-xs text-slate-500 self-center">
                Trained on: {modelStats.datasets.map((d)=>d.name).join(", ")}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── No data state ── */}
      {analysed.length === 0 ? (
        <Card className="p-12 text-center">
          <Brain className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No analysed comments yet</p>
          <p className="text-slate-400 text-sm mt-1">
            Go to a consultation, submit some comments, then click "Analyse Comments".
          </p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Sentiment donut */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Overall Sentiment Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <SentimentDonut data={sentimentCounts} />
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {Object.entries(sentimentCounts).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-2 text-sm">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SENT_COLORS[key] }} />
                      <span className="text-slate-600 capitalize">{key}</span>
                      <span className="text-slate-400 ml-auto">{val}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Stakeholder pie */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Stakeholder Type Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                {stakeholderData.length === 0 ? (
                  <div className="h-64 flex items-center justify-center text-slate-400 text-sm">No data</div>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={stakeholderData} innerRadius={45} outerRadius={80}
                          paddingAngle={3} dataKey="value">
                          {stakeholderData.map((_, i) => (
                            <Cell key={i} fill={STK_COLORS[i%STK_COLORS.length]} stroke="none" />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize:12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Sentiment by stakeholder */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Sentiment by Stakeholder Type</CardTitle>
              </CardHeader>
              <CardContent>
                {sentByStakeholder.length === 0 ? (
                  <div className="h-64 flex items-center justify-center text-slate-400 text-sm">No data</div>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={sentByStakeholder} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis type="number" fontSize={12} />
                        <YAxis type="category" dataKey="name" fontSize={11} width={110} />
                        <Tooltip />
                        {["positive","neutral","negative","mixed"].map((s) => (
                          <Bar key={s} dataKey={s} fill={SENT_COLORS[s]} stackId="a" />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Sentiment by comment type */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Sentiment by Comment Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sentByType}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="name" fontSize={12} />
                      <YAxis fontSize={12} />
                      <Tooltip />
                      {["positive","neutral","negative","mixed"].map((s) => (
                        <Bar key={s} dataKey={s} fill={SENT_COLORS[s]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Word cloud */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Keyword Word Cloud</CardTitle>
            </CardHeader>
            <CardContent>
              <WordCloud keywords={allKeywords} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}