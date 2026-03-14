import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { consultationApi, commentApi, analyticsApi } from "@/api/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";
import SentimentDonut from "../components/dashboard/SentimentDonut";
import WordCloudDisplay from "../components/analysis/WordCloudDisplay";
import { Cpu, Zap, Brain, TrendingUp, Database } from "lucide-react";

const COLORS = {
  positive: "#10b981",
  negative: "#ef4444",
  neutral: "#94a3b8",
  mixed: "#f59e0b",
};

const STAKEHOLDER_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f97316",
  "#14b8a6", "#3b82f6", "#eab308", "#64748b",
];

export default function Analytics() {
  const [selectedConsultation, setSelectedConsultation] = useState("all");

  const { data: consultations = [], isLoading: loadingC } = useQuery({
    queryKey: ["consultations"],
    queryFn: () => consultationApi.list(),
  });

  const { data: allComments = [], isLoading: loadingComm } = useQuery({
    queryKey: ["all-comments"],
    queryFn: () => commentApi.list(),
  });

  const { data: modelStats } = useQuery({
    queryKey: ["model-stats"],
    queryFn: () => analyticsApi.modelStats(),
  });

  const isLoading = loadingC || loadingComm;

  const comments = selectedConsultation === "all"
    ? allComments
    : allComments.filter((c) => c.consultation_id === selectedConsultation);

  const analysed = comments.filter((c) => c.is_analysed);

  const sentimentCounts = {
    positive: analysed.filter((c) => c.sentiment === "positive").length,
    negative: analysed.filter((c) => c.sentiment === "negative").length,
    neutral: analysed.filter((c) => c.sentiment === "neutral").length,
    mixed: analysed.filter((c) => c.sentiment === "mixed").length,
  };

  const stakeholderData = Object.entries(
    analysed.reduce((acc, c) => {
      const type = c.stakeholder_type || "unknown";
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name: name.replace(/_/g, " "), value }));

  const sentimentByStakeholder = Object.entries(
    analysed.reduce((acc, c) => {
      const type = (c.stakeholder_type || "unknown").replace(/_/g, " ");
      if (!acc[type]) acc[type] = { positive: 0, negative: 0, neutral: 0, mixed: 0 };
      if (c.sentiment) acc[type][c.sentiment]++;
      return acc;
    }, {})
  ).map(([name, data]) => ({ name, ...data }));

  const sentimentByType = [
    {
      name: "Overall",
      ...analysed.filter((c) => c.comment_type === "overall").reduce((acc, c) => {
        if (c.sentiment) acc[c.sentiment] = (acc[c.sentiment] || 0) + 1;
        return acc;
      }, { positive: 0, negative: 0, neutral: 0, mixed: 0 }),
    },
    {
      name: "Provision-Specific",
      ...analysed.filter((c) => c.comment_type === "provision_specific").reduce((acc, c) => {
        if (c.sentiment) acc[c.sentiment] = (acc[c.sentiment] || 0) + 1;
        return acc;
      }, { positive: 0, negative: 0, neutral: 0, mixed: 0 }),
    },
  ];

  const allKeywords = analysed.flatMap((c) => c.keywords || []);
  const corrections = analysed.filter((c) => c.vader_raw && c.sentiment !== c.vader_raw?.sentiment);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-64" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
          <p className="text-slate-500 text-sm mt-1">In-depth sentiment analysis & model insights</p>
        </div>
        <Select value={selectedConsultation} onValueChange={setSelectedConsultation}>
          <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Consultations</SelectItem>
            {consultations.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Model Pipeline Card */}
      <Card className="border-blue-100 bg-blue-50/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Cpu className="w-4 h-4 text-blue-600" />
            Analysis Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border shadow-sm">
              <Zap className="w-4 h-4 text-amber-500" />
              <div>
                <p className="font-medium text-slate-800">VADER</p>
                <p className="text-xs text-slate-500">Rule-based NLP</p>
              </div>
            </div>
            <span className="text-slate-400 font-bold">→</span>
            <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border shadow-sm">
              <Database className="w-4 h-4 text-purple-500" />
              <div>
                <p className="font-medium text-slate-800">ML Model</p>
                <p className="text-xs text-slate-500">
                  {modelStats?.accuracy ? `Accuracy: ${(modelStats.accuracy * 100).toFixed(1)}%` : "Logistic Regression"}
                </p>
              </div>
            </div>
            <span className="text-slate-400 font-bold">→</span>
            <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border shadow-sm">
              <Brain className="w-4 h-4 text-blue-500" />
              <div>
                <p className="font-medium text-slate-800">Gemini 2.0 Flash</p>
                <p className="text-xs text-slate-500">Correction + Summary</p>
              </div>
            </div>
            {modelStats?.datasets?.length > 0 && (
              <>
                <span className="text-slate-400 font-bold mx-1">|</span>
                <div className="text-xs text-slate-500">
                  Trained on: {modelStats.datasets.map((d) => d.name).join(", ")}
                </div>
              </>
            )}
          </div>

          {analysed.length > 0 && corrections.length > 0 && (
            <div className="mt-3 text-xs text-blue-700 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              Gemini corrected {corrections.length}/{analysed.length} VADER predictions 
              ({Math.round((corrections.length / analysed.length) * 100)}% correction rate)
            </div>
          )}

          {modelStats?.improvement_over_vader_pct !== undefined && (
            <div className="mt-2 flex flex-wrap gap-3 text-xs">
              <Badge variant="outline" className="bg-white">
                VADER Baseline: {(modelStats.vader_accuracy * 100).toFixed(1)}%
              </Badge>
              <Badge variant="outline" className="bg-white text-green-700 border-green-200">
                ML Model: {(modelStats.accuracy * 100).toFixed(1)}%
                {modelStats.improvement_over_vader_pct > 0 && ` (+${modelStats.improvement_over_vader_pct}%)`}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {analysed.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-slate-400">No analysed comments yet. Run AI analysis on a consultation to see insights here.</p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Overall Sentiment Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <SentimentDonut data={sentimentCounts} />
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {Object.entries(sentimentCounts).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-2 text-sm">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[key] }} />
                      <span className="text-slate-600 capitalize">{key}</span>
                      <span className="text-slate-400 ml-auto">{val}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Stakeholder Type Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={stakeholderData} innerRadius={45} outerRadius={80} paddingAngle={3} dataKey="value">
                        {stakeholderData.map((_, i) => (
                          <Cell key={i} fill={STAKEHOLDER_COLORS[i % STAKEHOLDER_COLORS.length]} stroke="none" />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Sentiment by Stakeholder Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sentimentByStakeholder} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis type="number" fontSize={12} />
                      <YAxis type="category" dataKey="name" fontSize={11} width={100} />
                      <Tooltip />
                      <Bar dataKey="positive" fill={COLORS.positive} stackId="a" />
                      <Bar dataKey="neutral" fill={COLORS.neutral} stackId="a" />
                      <Bar dataKey="negative" fill={COLORS.negative} stackId="a" />
                      <Bar dataKey="mixed" fill={COLORS.mixed} stackId="a" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Sentiment by Comment Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sentimentByType}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="name" fontSize={12} />
                      <YAxis fontSize={12} />
                      <Tooltip />
                      <Bar dataKey="positive" fill={COLORS.positive} />
                      <Bar dataKey="neutral" fill={COLORS.neutral} />
                      <Bar dataKey="negative" fill={COLORS.negative} />
                      <Bar dataKey="mixed" fill={COLORS.mixed} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Keyword Word Cloud</CardTitle>
            </CardHeader>
            <CardContent>
              <WordCloudDisplay keywords={allKeywords} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}