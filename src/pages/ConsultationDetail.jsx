import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { consultationApi, commentApi } from "@/api/api";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import {
  ArrowLeft, Brain, Loader2, Calendar, MessageSquare,
  FileText, Cpu, Zap, ChevronDown, ChevronUp, User,
} from "lucide-react";
import { format } from "date-fns";
import SentimentDonut from "../components/dashboard/SentimentDonut";
import SentimentBadge from "../components/dashboard/SentimentBadge";
import WordCloudDisplay from "../components/analysis/WordCloudDisplay";

// ── Inline CommentCard (avoids import path issues) ──────────────────
function CommentCard({ comment }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
          <User className="w-4 h-4 text-slate-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-slate-900">{comment.stakeholder_name}</span>
            {comment.stakeholder_type && (
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                {comment.stakeholder_type.replace(/_/g, " ")}
              </span>
            )}
            {comment.sentiment && <SentimentBadge sentiment={comment.sentiment} />}
          </div>
          {comment.provision_reference && (
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
              <FileText className="w-3 h-3" /> Section: {comment.provision_reference}
            </p>
          )}
          <p className={`text-sm text-slate-600 mt-2 ${expanded ? "" : "line-clamp-2"}`}>
            {comment.comment_text}
          </p>
          {comment.ai_summary && expanded && (
            <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-xs font-medium text-blue-700 mb-1">AI Summary</p>
              <p className="text-sm text-blue-800">{comment.ai_summary}</p>
            </div>
          )}
          {comment.keywords?.length > 0 && expanded && (
            <div className="flex flex-wrap gap-1 mt-2">
              {comment.keywords.map((kw, i) => (
                <span key={i} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{kw}</span>
              ))}
            </div>
          )}
          {comment.vader_raw && expanded && (
            <div className="mt-2 text-xs text-slate-400">
              VADER: {comment.vader_raw.sentiment} ({comment.vader_raw.score?.toFixed(2)})
              {comment.sentiment !== comment.vader_raw.sentiment && (
                <span className="ml-2 text-amber-600 font-medium">→ Gemini corrected to: {comment.sentiment}</span>
              )}
            </div>
          )}
          <button onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-blue-600 mt-2 hover:text-blue-800 transition-colors">
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? "Show less" : "Show more"}
          </button>
        </div>
        {comment.sentiment_score != null && (
          <div className="text-right flex-shrink-0">
            <p className="text-lg font-bold text-slate-900">{(comment.sentiment_score * 100).toFixed(0)}</p>
            <p className="text-xs text-slate-400">Score</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tabs ─────────────────────────────────────────────────────────────
function Tabs({ tabs, activeTab, setActiveTab }) {
  return (
    <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
      {tabs.map((t) => (
        <button key={t.value} onClick={() => setActiveTab(t.value)}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            activeTab === t.value
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ── Status badge styles ───────────────────────────────────────────────
const STATUS_STYLES = {
  open:     "bg-green-50 text-green-700 border-green-200",
  analysed: "bg-blue-50 text-blue-600 border-blue-200",
  closed:   "bg-slate-50 text-slate-600 border-slate-200",
  draft:    "bg-amber-50 text-amber-600 border-amber-200",
};

// ── Main component ────────────────────────────────────────────────────
export default function ConsultationDetail() {
  const id = new URLSearchParams(window.location.search).get("id");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("analysis");
  const [sentimentFilter, setSentimentFilter] = useState("all");
  const [analysing, setAnalysing] = useState(false);
  const [analyseProgress, setAnalyseProgress] = useState("");

  // ── Data fetching ──
  const { data: consultation, isLoading: loadingC } = useQuery({
    queryKey: ["consultation", id],
    queryFn: async () => {
      const all = await consultationApi.list();
      return all.find((c) => c.id === id) || null;
    },
    enabled: !!id,
  });

  const { data: comments = [], isLoading: loadingComm } = useQuery({
    queryKey: ["comments", id],
    queryFn: () => commentApi.list(id),
    enabled: !!id,
  });

  // ── Status mutation ──
  const statusMutation = useMutation({
    mutationFn: ({ status }) => consultationApi.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["consultation", id] });
      queryClient.invalidateQueries({ queryKey: ["consultations"] });
    },
  });

  // ── AI Analysis ──
  const analyseAllComments = async () => {
    setAnalysing(true);
    const unanalysed = comments.filter((c) => !c.is_analysed);
    if (unanalysed.length === 0) { setAnalysing(false); return; }

    setAnalyseProgress(`Sending ${unanalysed.length} comments through VADER → ML → Gemini...`);
    try {
      const result = await commentApi.analyseAll(unanalysed.map((c) => c.id), id);
      queryClient.invalidateQueries({ queryKey: ["consultation", id] });
      queryClient.invalidateQueries({ queryKey: ["comments", id] });
      queryClient.invalidateQueries({ queryKey: ["consultations"] });
      toast({
        title: "Analysis Complete",
        description: `${result.analysed_count} comments analysed via VADER + Gemini pipeline.`,
      });
    } catch (err) {
      toast({ title: "Analysis Failed", description: err.message, variant: "destructive" });
    } finally {
      setAnalysing(false);
      setAnalyseProgress("");
    }
  };

  // ── Loading ──
  if (loadingC || loadingComm) return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-48" />
      <Skeleton className="h-64" />
    </div>
  );

  if (!consultation) return (
    <div className="text-center py-16">
      <p className="text-slate-500">Consultation not found</p>
      <Link to="/Consultations">
        <Button variant="link" className="mt-2">Back to Consultations</Button>
      </Link>
    </div>
  );

  // ── Derived data ──
  const analysedComments = comments.filter((c) => c.is_analysed);
  const unanalysedCount  = comments.length - analysedComments.length;

  const sentimentCounts = {
    positive: analysedComments.filter((c) => c.sentiment === "positive").length,
    negative: analysedComments.filter((c) => c.sentiment === "negative").length,
    neutral:  analysedComments.filter((c) => c.sentiment === "neutral").length,
    mixed:    analysedComments.filter((c) => c.sentiment === "mixed").length,
  };

  const allKeywords = analysedComments.flatMap((c) => c.keywords || []);

  const filteredComments = sentimentFilter === "all"
    ? comments
    : comments.filter((c) => c.sentiment === sentimentFilter);

  const corrections = analysedComments.filter(
    (c) => c.vader_raw && c.sentiment !== c.vader_raw?.sentiment
  );

  const TABS = [
    { value: "analysis",  label: "Analysis" },
    { value: "comments",  label: `Comments (${comments.length})` },
    { value: "wordcloud", label: "Word Cloud" },
  ];

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <Link to="/Consultations"
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 mb-2">
            <ArrowLeft className="w-3 h-3" /> Back to Consultations
          </Link>
          <h1 className="text-xl font-bold text-slate-900">{consultation.title}</h1>
          <p className="text-sm text-slate-500 mt-1">{consultation.description}</p>
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <Badge variant="outline" className={`text-xs ${STATUS_STYLES[consultation.status] || ""}`}>
              {consultation.status}
            </Badge>
            {consultation.end_date && (
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Due {format(new Date(consultation.end_date), "MMM d, yyyy")}
              </span>
            )}
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <MessageSquare className="w-3 h-3" /> {comments.length} comments
            </span>
          </div>
        </div>

        <div className="flex gap-2 flex-shrink-0 flex-wrap">
          {consultation.status === "draft" && (
            <Button variant="outline" size="sm"
              onClick={() => statusMutation.mutate({ status: "open" })}>
              Open for Comments
            </Button>
          )}
          {consultation.status === "open" && (
            <Button variant="outline" size="sm"
              onClick={() => statusMutation.mutate({ status: "closed" })}>
              Close Consultation
            </Button>
          )}
          {comments.length > 0 && (
            <Button size="sm" onClick={analyseAllComments}
              disabled={analysing || unanalysedCount === 0}
              className="bg-blue-600 hover:bg-blue-700">
              {analysing
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analysing...</>
                : <><Brain className="w-4 h-4 mr-2" />
                    {unanalysedCount > 0 ? `Analyse ${unanalysedCount} Comments` : "All Analysed"}
                  </>
              }
            </Button>
          )}
        </div>
      </div>

      {/* ── Progress banner ── */}
      {analyseProgress && (
        <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
          <div>
            <p className="font-medium">Running Analysis Pipeline</p>
            <p className="text-blue-600 text-xs mt-0.5">{analyseProgress}</p>
            <div className="flex items-center gap-3 mt-1 text-xs">
              <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> VADER</span>
              <span>→</span>
              <span className="flex items-center gap-1"><Cpu className="w-3 h-3" /> ML Model</span>
              <span>→</span>
              <span className="flex items-center gap-1"><Brain className="w-3 h-3" /> Gemini</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Correction stats ── */}
      {analysedComments.length > 0 && corrections.length > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center gap-2">
          <Brain className="w-4 h-4 flex-shrink-0" />
          Gemini corrected <strong className="mx-1">{corrections.length}</strong> of {analysedComments.length} VADER
          predictions ({Math.round((corrections.length / analysedComments.length) * 100)}% correction rate)
        </div>
      )}

      {/* ── Tabs ── */}
      <Tabs tabs={TABS} activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* ── Analysis Tab ── */}
      {activeTab === "analysis" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Sentiment Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <SentimentDonut data={sentimentCounts} />
                <div className="space-y-2 mt-4">
                  {Object.entries(sentimentCounts).map(([key, val]) => (
                    <div key={key} className="flex items-center justify-between text-sm">
                      <SentimentBadge sentiment={key} />
                      <span className="text-slate-600 font-medium">{val}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Overall Summary</CardTitle>
              </CardHeader>
              <CardContent>
                {consultation.overall_sentiment?.summary ? (
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                    <p className="text-sm text-blue-900 leading-relaxed">
                      {consultation.overall_sentiment.summary}
                    </p>
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <Brain className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">
                      Run AI analysis to generate an overall summary
                    </p>
                  </div>
                )}

                {consultation.provisions?.length > 0 && (
                  <div className="mt-6">
                    <p className="text-sm font-medium text-slate-700 mb-2">Provisions</p>
                    <div className="flex flex-wrap gap-2">
                      {consultation.provisions.map((p, i) => {
                        const n = analysedComments.filter((c) => c.provision_reference === p.section_number).length;
                        return (
                          <Badge key={i} variant="outline" className="text-xs">
                            <FileText className="w-3 h-3 mr-1" />
                            §{p.section_number} — {n} comments
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ── Comments Tab ── */}
      {activeTab === "comments" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <select value={sentimentFilter}
              onChange={(e) => setSentimentFilter(e.target.value)}
              className="h-9 w-44 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="all">All Sentiments</option>
              <option value="positive">Positive</option>
              <option value="negative">Negative</option>
              <option value="neutral">Neutral</option>
              <option value="mixed">Mixed</option>
            </select>
            <span className="text-sm text-slate-400">{filteredComments.length} comments</span>
          </div>

          <div className="space-y-3">
            {filteredComments.map((comment) => (
              <CommentCard key={comment.id} comment={comment} />
            ))}
          </div>

          {filteredComments.length === 0 && (
            <div className="text-center py-12 text-slate-400 text-sm">No comments found</div>
          )}
        </div>
      )}

      {/* ── Word Cloud Tab ── */}
      {activeTab === "wordcloud" && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Keyword Word Cloud</CardTitle>
          </CardHeader>
          <CardContent>
            <WordCloudDisplay keywords={allKeywords} />
            {allKeywords.length === 0 && (
              <p className="text-center text-sm text-slate-400 py-4">
                Run AI analysis to generate keyword data
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}