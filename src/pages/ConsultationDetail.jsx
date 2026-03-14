import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { consultationApi, commentApi } from "@/api/api";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Brain, Loader2, Calendar, MessageSquare, FileText, Cpu, Zap } from "lucide-react";
import { format } from "date-fns";
import SentimentDonut from "../components/dashboard/SentimentDonut";
import SentimentBadge from "../components/dashboard/SentimentBadge";
import WordCloudDisplay from "../components/analysis/WordCloudDisplay";
import CommentCard from "../components/analysis/CommentCard";

export default function ConsultationDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get("id");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [sentimentFilter, setSentimentFilter] = useState("all");
  const [analysing, setAnalysing] = useState(false);
  const [analyseProgress, setAnalyseProgress] = useState("");

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

  const statusMutation = useMutation({
    mutationFn: ({ status }) => consultationApi.update(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["consultation", id] }),
  });

  const analyseAllComments = async () => {
    setAnalysing(true);
    const unanalysed = comments.filter((c) => !c.is_analysed);
    if (unanalysed.length === 0) {
      setAnalysing(false);
      return;
    }

    setAnalyseProgress(`Sending ${unanalysed.length} comments through VADER → ML → Gemini pipeline...`);

    try {
      const result = await commentApi.analyseAll(
        unanalysed.map((c) => c.id),
        id
      );
      queryClient.invalidateQueries({ queryKey: ["consultation", id] });
      queryClient.invalidateQueries({ queryKey: ["comments", id] });
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

  const isLoading = loadingC || loadingComm;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!consultation) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500">Consultation not found</p>
        <Link to="/Consultations"><Button variant="link" className="mt-2">Back to Consultations</Button></Link>
      </div>
    );
  }

  const analysedComments = comments.filter((c) => c.is_analysed);
  const unanalysedCount = comments.length - analysedComments.length;

  const sentimentCounts = {
    positive: analysedComments.filter((c) => c.sentiment === "positive").length,
    negative: analysedComments.filter((c) => c.sentiment === "negative").length,
    neutral: analysedComments.filter((c) => c.sentiment === "neutral").length,
    mixed: analysedComments.filter((c) => c.sentiment === "mixed").length,
  };

  const allKeywords = analysedComments.flatMap((c) => c.keywords || []);
  const filteredComments = sentimentFilter === "all" ? comments : comments.filter((c) => c.sentiment === sentimentFilter);

  // Stats on model corrections
  const corrections = analysedComments.filter((c) => c.vader_raw && c.sentiment !== c.vader_raw?.sentiment);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <Link to="/Consultations" className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 mb-2">
            <ArrowLeft className="w-3 h-3" /> Back to Consultations
          </Link>
          <h1 className="text-xl font-bold text-slate-900">{consultation.title}</h1>
          <p className="text-sm text-slate-500 mt-1">{consultation.description}</p>
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <Badge variant="outline" className={`text-xs ${
              consultation.status === "open" ? "bg-green-50 text-green-700 border-green-200" :
              consultation.status === "analysed" ? "bg-blue-50 text-blue-600 border-blue-200" :
              "bg-slate-50 text-slate-600 border-slate-200"
            }`}>{consultation.status}</Badge>
            {consultation.end_date && (
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Due {format(new Date(consultation.end_date), "MMM d, yyyy")}
              </span>
            )}
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <MessageSquare className="w-3 h-3" /> {comments.length} comments
            </span>
          </div>
        </div>

        <div className="flex gap-2 flex-shrink-0 flex-wrap">
          {consultation.status === "draft" && (
            <Button variant="outline" size="sm" onClick={() => statusMutation.mutate({ status: "open" })}>
              Open for Comments
            </Button>
          )}
          {consultation.status === "open" && (
            <Button variant="outline" size="sm" onClick={() => statusMutation.mutate({ status: "closed" })}>
              Close Consultation
            </Button>
          )}
          {comments.length > 0 && (
            <Button size="sm" onClick={analyseAllComments} disabled={analysing || unanalysedCount === 0} className="bg-blue-600 hover:bg-blue-700">
              {analysing ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analysing...</>
              ) : (
                <><Brain className="w-4 h-4 mr-2" /> {unanalysedCount > 0 ? `Analyse ${unanalysedCount} Comments` : "All Analysed"}</>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Analysis pipeline progress */}
      {analyseProgress && (
        <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
          <div>
            <p className="font-medium">Running Analysis Pipeline</p>
            <p className="text-blue-600 text-xs mt-0.5">{analyseProgress}</p>
            <div className="flex items-center gap-4 mt-2">
              <span className="flex items-center gap-1 text-xs"><Zap className="w-3 h-3" /> VADER (rule-based)</span>
              <span className="text-slate-400">→</span>
              <span className="flex items-center gap-1 text-xs"><Cpu className="w-3 h-3" /> ML Model (Kaggle-trained)</span>
              <span className="text-slate-400">→</span>
              <span className="flex items-center gap-1 text-xs"><Brain className="w-3 h-3" /> Gemini (correction + summary)</span>
            </div>
          </div>
        </div>
      )}

      {/* Model correction stats */}
      {analysedComments.length > 0 && corrections.length > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center gap-2">
          <Brain className="w-4 h-4 flex-shrink-0" />
          Gemini corrected <strong>{corrections.length}</strong> of {analysedComments.length} VADER predictions 
          ({Math.round((corrections.length / analysedComments.length) * 100)}% correction rate)
        </div>
      )}

      <Tabs defaultValue="analysis" className="space-y-4">
        <TabsList>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
          <TabsTrigger value="comments">Comments ({comments.length})</TabsTrigger>
          <TabsTrigger value="wordcloud">Word Cloud</TabsTrigger>
        </TabsList>

        <TabsContent value="analysis" className="space-y-6">
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
                    <p className="text-sm text-blue-900 leading-relaxed">{consultation.overall_sentiment.summary}</p>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 py-8 text-center">
                    Run AI analysis to generate an overall summary
                  </p>
                )}

                {consultation.provisions?.length > 0 && (
                  <div className="mt-6">
                    <p className="text-sm font-medium text-slate-700 mb-2">Provisions</p>
                    <div className="flex flex-wrap gap-2">
                      {consultation.provisions.map((p, i) => {
                        const provComments = analysedComments.filter((c) => c.provision_reference === p.section_number);
                        return (
                          <Badge key={i} variant="outline" className="text-xs">
                            <FileText className="w-3 h-3 mr-1" />
                            §{p.section_number} — {provComments.length} comments
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="comments" className="space-y-4">
          <div className="flex items-center gap-3">
            <Select value={sentimentFilter} onValueChange={setSentimentFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sentiments</SelectItem>
                <SelectItem value="positive">Positive</SelectItem>
                <SelectItem value="negative">Negative</SelectItem>
                <SelectItem value="neutral">Neutral</SelectItem>
                <SelectItem value="mixed">Mixed</SelectItem>
              </SelectContent>
            </Select>
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
        </TabsContent>

        <TabsContent value="wordcloud">
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
        </TabsContent>
      </Tabs>
    </div>
  );
}