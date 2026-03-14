import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, User, FileText } from "lucide-react";
import SentimentBadge from "../dashboard/SentimentBadge";

export default function CommentCard({ comment }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
          <User className="w-4 h-4 text-slate-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-slate-900">{comment.stakeholder_name}</span>
            <Badge variant="outline" className="text-xs">
              {comment.stakeholder_type?.replace(/_/g, " ")}
            </Badge>
            {comment.sentiment && <SentimentBadge sentiment={comment.sentiment} />}
          </div>

          {comment.provision_reference && (
            <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
              <FileText className="w-3 h-3" />
              <span>Section: {comment.provision_reference}</span>
            </div>
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
                <span key={i} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                  {kw}
                </span>
              ))}
            </div>
          )}

          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-blue-600 mt-2 hover:text-blue-800 transition-colors"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? "Show less" : "Show more"}
          </button>
        </div>

        {comment.sentiment_score != null && (
          <div className="text-right flex-shrink-0">
            <p className="text-lg font-bold text-slate-900">
              {(comment.sentiment_score * 100).toFixed(0)}
            </p>
            <p className="text-xs text-slate-400">Score</p>
          </div>
        )}
      </div>
    </Card>
  );
}