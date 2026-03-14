import React from "react";
import { useQuery } from "@tanstack/react-query";
import { consultationApi, commentApi } from "@/api/api";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, MessageSquare, TrendingUp, Clock, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import StatCard from "../components/dashboard/StatCard";
import SentimentDonut from "../components/dashboard/SentimentDonut";

export default function Dashboard() {
  const { data: consultations = [], isLoading: loadingC } = useQuery({
    queryKey: ["consultations"],
    queryFn: () => consultationApi.list(),
  });

  const { data: comments = [], isLoading: loadingComm } = useQuery({
    queryKey: ["comments"],
    queryFn: () => commentApi.list(),
  });

  const isLoading = loadingC || loadingComm;

  const openConsultations = consultations.filter((c) => c.status === "open");
  const analysedComments = comments.filter((c) => c.is_analysed);

  const sentimentCounts = {
    positive: comments.filter((c) => c.sentiment === "positive").length,
    negative: comments.filter((c) => c.sentiment === "negative").length,
    neutral: comments.filter((c) => c.sentiment === "neutral").length,
    mixed: comments.filter((c) => c.sentiment === "mixed").length,
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">
          Overview of eConsultation sentiment analysis
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Consultations"
          value={consultations.length}
          subtitle={`${openConsultations.length} currently open`}
          icon={FileText}
          color="blue"
        />
        <StatCard
          title="Total Comments"
          value={comments.length}
          subtitle={`${analysedComments.length} analysed`}
          icon={MessageSquare}
          color="purple"
        />
        <StatCard
          title="Positive Sentiment"
          value={sentimentCounts.positive ? `${Math.round((sentimentCounts.positive / Math.max(analysedComments.length, 1)) * 100)}%` : "—"}
          subtitle={`${sentimentCounts.positive} comments`}
          icon={TrendingUp}
          color="green"
        />
        <StatCard
          title="Pending Analysis"
          value={comments.length - analysedComments.length}
          subtitle="Awaiting AI processing"
          icon={Clock}
          color="amber"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Overall Sentiment</CardTitle>
          </CardHeader>
          <CardContent>
            <SentimentDonut data={sentimentCounts} />
            <div className="grid grid-cols-2 gap-2 mt-4">
              {Object.entries(sentimentCounts).map(([key, val]) => (
                <div key={key} className="flex items-center gap-2 text-sm">
                  <div className={`w-2.5 h-2.5 rounded-full ${
                    key === "positive" ? "bg-emerald-500" :
                    key === "negative" ? "bg-red-500" :
                    key === "neutral" ? "bg-slate-400" : "bg-amber-500"
                  }`} />
                  <span className="text-slate-600 capitalize">{key}</span>
                  <span className="text-slate-400 ml-auto">{val}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Recent Consultations</CardTitle>
              <Link to="/Consultations" className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {consultations.slice(0, 5).map((c) => (
                <Link
                  key={c.id}
                  to={`/ConsultationDetail?id=${c.id}`}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors group"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                      {c.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          c.status === "open" ? "bg-green-50 text-green-700 border-green-200" :
                          c.status === "closed" ? "bg-slate-50 text-slate-600 border-slate-200" :
                          c.status === "analysed" ? "bg-blue-50 text-blue-600 border-blue-200" :
                          "bg-amber-50 text-amber-600 border-amber-200"
                        }`}
                      >
                        {c.status}
                      </Badge>
                      <span className="text-xs text-slate-400">
                        {c.total_comments || 0} comments
                      </span>
                      {c.end_date && (
                        <span className="text-xs text-slate-400">
                          · Due {format(new Date(c.end_date), "MMM d, yyyy")}
                        </span>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
                </Link>
              ))}
              {consultations.length === 0 && (
                <div className="text-center py-8 text-slate-400 text-sm">
                  No consultations yet. Create one to get started.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}