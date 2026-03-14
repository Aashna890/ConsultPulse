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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, ArrowRight, Calendar } from "lucide-react";
import { format } from "date-fns";

const CATEGORIES = [
  { value: "company_law", label: "Company Law" },
  { value: "llp_act", label: "LLP Act" },
  { value: "insolvency_code", label: "Insolvency Code" },
  { value: "securities_law", label: "Securities Law" },
  { value: "competition_act", label: "Competition Act" },
  { value: "other", label: "Other" },
];

export default function Consultations() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [form, setForm] = useState({ title: "", description: "", category: "", start_date: "", end_date: "", provisions: [] });
  const [provisionInput, setProvisionInput] = useState({ section_number: "", section_title: "" });

  const queryClient = useQueryClient();

  const { data: consultations = [], isLoading } = useQuery({
    queryKey: ["consultations"],
    queryFn: () => consultationApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => consultationApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["consultations"] });
      setDialogOpen(false);
      setForm({ title: "", description: "", category: "", start_date: "", end_date: "", provisions: [] });
    },
  });

  const handleCreate = () => {
    createMutation.mutate({ ...form, status: "draft" });
  };

  const addProvision = () => {
    if (provisionInput.section_number) {
      setForm({ ...form, provisions: [...form.provisions, { ...provisionInput }] });
      setProvisionInput({ section_number: "", section_title: "" });
    }
  };

  const filtered = consultations.filter((c) => {
    const matchSearch = c.title?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Consultations</h1>
          <p className="text-slate-500 text-sm mt-1">Manage draft legislations and amendments</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" /> New Consultation
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Consultation</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label>Title *</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Draft Amendment Title" />
              </div>
              <div>
                <Label>Description *</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe the proposed amendment..." rows={3} />
              </div>
              <div>
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Start Date</Label>
                  <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                </div>
                <div>
                  <Label>End Date</Label>
                  <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Provisions / Sections</Label>
                <div className="flex gap-2 mt-1">
                  <Input placeholder="Section #" value={provisionInput.section_number} onChange={(e) => setProvisionInput({ ...provisionInput, section_number: e.target.value })} className="w-28" />
                  <Input placeholder="Title" value={provisionInput.section_title} onChange={(e) => setProvisionInput({ ...provisionInput, section_title: e.target.value })} className="flex-1" />
                  <Button type="button" variant="outline" size="sm" onClick={addProvision}>Add</Button>
                </div>
                {form.provisions.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {form.provisions.map((p, i) => (
                      <Badge key={i} variant="secondary" className="cursor-pointer" onClick={() => setForm({ ...form, provisions: form.provisions.filter((_, j) => j !== i) })}>
                        §{p.section_number} {p.section_title} ×
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <Button onClick={handleCreate} disabled={!form.title || !form.description || createMutation.isPending} className="w-full bg-blue-600 hover:bg-blue-700">
                {createMutation.isPending ? "Creating..." : "Create Consultation"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Search consultations..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
            <SelectItem value="analysed">Analysed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">No consultations found</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => (
            <Link key={c.id} to={`/ConsultationDetail?id=${c.id}`}>
              <Card className="hover:shadow-md transition-all hover:border-blue-200 group cursor-pointer">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">{c.title}</h3>
                      <p className="text-sm text-slate-500 mt-1 line-clamp-1">{c.description}</p>
                      <div className="flex items-center gap-3 mt-3 flex-wrap">
                        <Badge variant="outline" className={`text-xs ${
                          c.status === "open" ? "bg-green-50 text-green-700 border-green-200" :
                          c.status === "closed" ? "bg-slate-50 text-slate-600 border-slate-200" :
                          c.status === "analysed" ? "bg-blue-50 text-blue-600 border-blue-200" :
                          "bg-amber-50 text-amber-600 border-amber-200"
                        }`}>{c.status}</Badge>
                        {c.category && <Badge variant="outline" className="text-xs">{c.category?.replace(/_/g, " ")}</Badge>}
                        <span className="text-xs text-slate-400">{c.total_comments || 0} comments</span>
                        {c.end_date && (
                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(c.end_date), "MMM d, yyyy")}
                          </span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition-colors mt-1 flex-shrink-0 ml-4" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}