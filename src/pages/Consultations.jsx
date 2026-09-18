import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { consultationApi } from "@/api/api";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, ArrowRight, Calendar, Loader2, CheckCircle2, AlertCircle, X } from "lucide-react";
import { format } from "date-fns";

const CATEGORIES = [
  { value: "company_law",     label: "Company Law" },
  { value: "llp_act",         label: "LLP Act" },
  { value: "insolvency_code", label: "Insolvency Code" },
  { value: "securities_law",  label: "Securities Law" },
  { value: "competition_act", label: "Competition Act" },
  { value: "other",           label: "Other" },
];

const STATUS_STYLES = {
  open:     "bg-green-50 text-green-700 border-green-200",
  closed:   "bg-slate-50 text-slate-600 border-slate-200",
  analysed: "bg-blue-50 text-blue-600 border-blue-200",
  draft:    "bg-amber-50 text-amber-600 border-amber-200",
};

const INPUT_CLS = "w-full h-9 rounded-md border border-gray-300 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

const EMPTY_FORM = { title:"", description:"", category:"other", start_date:"", end_date:"", provisions:[] };

export default function Consultations() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch]         = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [form, setForm]             = useState(EMPTY_FORM);
  const [provInput, setProvInput]   = useState({ section_number:"", section_title:"" });
  const [createError, setCreateError] = useState("");
  const [justCreated, setJustCreated] = useState(false);

  const queryClient = useQueryClient();

  const { data: consultations = [], isLoading, isError, error } = useQuery({
    queryKey: ["consultations"],
    queryFn: consultationApi.list,
    retry: 1,
  });

  const createMutation = useMutation({
    mutationFn: (data) => consultationApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["consultations"] });
      setJustCreated(true);
      setTimeout(() => { setDialogOpen(false); setJustCreated(false); setForm(EMPTY_FORM); setCreateError(""); }, 900);
    },
    onError: (err) => setCreateError(err.message || "Failed. Is backend running at localhost:8000?"),
  });

  const addProv = () => {
    if (!provInput.section_number.trim()) return;
    setForm(f => ({ ...f, provisions: [...f.provisions, { ...provInput }] }));
    setProvInput({ section_number:"", section_title:"" });
  };

  const filtered = consultations.filter((c) =>
    c.title?.toLowerCase().includes(search.toLowerCase()) &&
    (statusFilter === "all" || c.status === statusFilter)
  );

  if (isError) return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">Consultations</h1>
      <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-red-800">Cannot connect to backend</p>
          <code className="block mt-2 text-xs bg-red-100 text-red-800 px-3 py-2 rounded font-mono">
            cd backend &amp;&amp; python main.py
          </code>
          <p className="text-xs text-red-400 mt-1">{error?.message}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Consultations</h1>
          <p className="text-slate-500 text-sm mt-1">Manage draft legislations and amendments</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => { setDialogOpen(true); setCreateError(""); }}>
          <Plus className="w-4 h-4 mr-2" /> New Consultation
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={(e)=>setSearch(e.target.value)}
            placeholder="Search consultations..."
            className="w-full h-9 pl-9 pr-3 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value)}
          className="h-9 w-40 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
          <option value="analysed">Analysed</option>
        </select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map((i)=><Skeleton key={i} className="h-24"/>)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm">
          {consultations.length === 0 ? 'No consultations yet. Click "New Consultation" to create one.' : "No results match your filters."}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => (
            <Link key={c.id} to={`/ConsultationDetail?id=${c.id}`}>
              <Card className="hover:shadow-md transition-all hover:border-blue-200 group cursor-pointer mb-2">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors truncate">{c.title}</h3>
                      <p className="text-sm text-slate-500 mt-0.5 line-clamp-1">{c.description}</p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Badge variant="outline" className={`text-xs ${STATUS_STYLES[c.status]||STATUS_STYLES.draft}`}>{c.status}</Badge>
                        {c.category && <Badge variant="outline" className="text-xs capitalize">{c.category.replace(/_/g," ")}</Badge>}
                        <span className="text-xs text-slate-400">{c.total_comments||0} comments</span>
                        {c.end_date && (
                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3"/>{format(new Date(c.end_date),"MMM d, yyyy")}
                          </span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition-colors flex-shrink-0 mt-1"/>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* ── Custom Dialog (no shadcn) ── */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={()=>{ setDialogOpen(false); setCreateError(""); }} />

          {/* Modal */}
          <div className="relative z-50 bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b">
              <h2 className="text-lg font-semibold text-slate-900">Create New Consultation</h2>
              <button onClick={()=>{ setDialogOpen(false); setCreateError(""); }}
                className="text-slate-400 hover:text-slate-600 transition-colors rounded-md p-1 hover:bg-slate-100">
                <X className="w-5 h-5"/>
              </button>
            </div>

            {/* Modal body */}
            <div className="px-6 py-5 space-y-4">
              {createError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5"/>{createError}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Title <span className="text-red-500">*</span></label>
                <input value={form.title} onChange={(e)=>setForm(f=>({...f,title:e.target.value}))}
                  placeholder="e.g. Draft Companies (Amendment) Act 2025" className={INPUT_CLS}/>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Description <span className="text-red-500">*</span></label>
                <textarea value={form.description} onChange={(e)=>setForm(f=>({...f,description:e.target.value}))}
                  placeholder="Describe the proposed amendment..." rows={3}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"/>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Category</label>
                <select value={form.category} onChange={(e)=>setForm(f=>({...f,category:e.target.value}))}
                  className={INPUT_CLS}>
                  {CATEGORIES.map((c)=><option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Start Date</label>
                  <input type="date" value={form.start_date} onChange={(e)=>setForm(f=>({...f,start_date:e.target.value}))} className={INPUT_CLS}/>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">End Date</label>
                  <input type="date" value={form.end_date} onChange={(e)=>setForm(f=>({...f,end_date:e.target.value}))} className={INPUT_CLS}/>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Provisions / Sections <span className="text-slate-400 text-xs">(optional)</span></label>
                <div className="flex gap-2">
                  <input placeholder="Section #" value={provInput.section_number}
                    onChange={(e)=>setProvInput(p=>({...p,section_number:e.target.value}))}
                    onKeyDown={(e)=>e.key==="Enter"&&addProv()}
                    className="w-28 h-9 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                  <input placeholder="Section title" value={provInput.section_title}
                    onChange={(e)=>setProvInput(p=>({...p,section_title:e.target.value}))}
                    onKeyDown={(e)=>e.key==="Enter"&&addProv()}
                    className="flex-1 h-9 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                  <button onClick={addProv}
                    className="px-3 h-9 rounded-md border border-gray-300 bg-white text-sm hover:bg-gray-50 transition-colors">
                    Add
                  </button>
                </div>
                {form.provisions.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {form.provisions.map((p,i)=>(
                      <span key={i} onClick={()=>setForm(f=>({...f,provisions:f.provisions.filter((_,j)=>j!==i)}))}
                        className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-full cursor-pointer hover:bg-red-100 hover:text-red-700 transition-colors">
                        §{p.section_number} {p.section_title} ×
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={()=>{ if(form.title.trim()&&form.description.trim()) createMutation.mutate({...form,status:"draft"}); }}
                disabled={!form.title.trim()||!form.description.trim()||createMutation.isPending||justCreated}
                className="w-full h-10 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
                {justCreated ? (
                  <><CheckCircle2 className="w-4 h-4"/> Created!</>
                ) : createMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin"/> Creating...</>
                ) : "Create Consultation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}