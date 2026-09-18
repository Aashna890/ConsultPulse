import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { consultationApi, commentApi } from "@/api/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Send, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

const STAKEHOLDER_TYPES = [
  { value: "",                  label: "Select type..." },
  { value: "individual",        label: "Individual" },
  { value: "company",           label: "Company" },
  { value: "professional_body", label: "Professional Body" },
  { value: "law_firm",          label: "Law Firm" },
  { value: "academic",          label: "Academic Institution" },
  { value: "government_body",   label: "Government Body" },
  { value: "ngo",               label: "NGO" },
  { value: "other",             label: "Other" },
];

const SEL = "w-full h-9 rounded-md border border-gray-300 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

const EMPTY = {
  consultation_id: "", stakeholder_name: "", stakeholder_email: "",
  stakeholder_type: "", comment_type: "overall", provision_reference: "", comment_text: "",
};

export default function SubmitComment() {
  const queryClient = useQueryClient();
  const [submitted, setSubmitted]   = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [form, setForm]             = useState(EMPTY);

  const f = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

  const { data: allConsultations = [], isLoading } = useQuery({
    queryKey: ["consultations"],
    queryFn: consultationApi.list,
  });

  // Show open + closed consultations (not just open)
  // so users can always submit; admins can later choose what to accept
  const consultations = allConsultations.filter((c) => c.status === "open" || c.status === "closed");
  const openOnly      = allConsultations.filter((c) => c.status === "open");
  const selected      = allConsultations.find((c) => c.id === form.consultation_id);

  const submitMutation = useMutation({
    mutationFn: (data) => commentApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments"] });
      queryClient.invalidateQueries({ queryKey: ["consultations"] });
      setSubmitted(true);
      setSubmitError("");
    },
    onError: (err) => setSubmitError(err.message || "Submission failed. Is the backend running?"),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitError("");
    submitMutation.mutate(form);
  };

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
          <CheckCircle className="w-9 h-9 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Comment Submitted!</h2>
        <p className="text-slate-500 text-sm">Your feedback has been recorded and will be analysed.</p>
        <Button onClick={() => { setForm(EMPTY); setSubmitted(false); }} className="bg-blue-600 hover:bg-blue-700">
          Submit Another Comment
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Submit Your Comment</h1>
        <p className="text-slate-500 text-sm mt-1">
          Share your observations on proposed amendments and draft legislations
        </p>
      </div>

      {isLoading ? (
        <Skeleton className="h-96" />
      ) : allConsultations.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-slate-500">No consultations found. Create one first in the Consultations page.</p>
        </Card>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">

          {submitError && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{submitError}
            </div>
          )}

          {/* Select Consultation */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Select Consultation</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <select value={form.consultation_id}
                onChange={(e) => setForm((p) => ({ ...p, consultation_id: e.target.value, provision_reference: "" }))}
                className={SEL} required>
                <option value="">Choose a consultation...</option>
                {allConsultations.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} ({c.status})
                  </option>
                ))}
              </select>
              {selected && (
                <p className="text-sm text-slate-500 pt-1">{selected.description}</p>
              )}
              {openOnly.length === 0 && allConsultations.length > 0 && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-1">
                  No consultations are currently open. Go to Consultations → click a consultation → "Open for Comments".
                </p>
              )}
            </CardContent>
          </Card>

          {/* Your Details */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Your Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label>Full Name <span className="text-red-500">*</span></Label>
                <Input value={form.stakeholder_name} onChange={f("stakeholder_name")}
                  placeholder="Enter your full name" required />
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input type="email" value={form.stakeholder_email} onChange={f("stakeholder_email")}
                  placeholder="your@email.com" />
              </div>
              <div className="space-y-1">
                <Label>Stakeholder Type</Label>
                <select value={form.stakeholder_type} onChange={f("stakeholder_type")} className={SEL}>
                  {STAKEHOLDER_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Your Comment */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Your Comment</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label>Comment Type</Label>
                <div className="flex gap-6 mt-1">
                  {[["overall","Overall Amendment"],["provision_specific","Specific Provision"]].map(([val,lbl])=>(
                    <label key={val} className="flex items-center gap-2 cursor-pointer text-sm">
                      <input type="radio" name="comment_type" value={val}
                        checked={form.comment_type===val} onChange={f("comment_type")}
                        className="accent-blue-600"/>
                      {lbl}
                    </label>
                  ))}
                </div>
              </div>

              {form.comment_type === "provision_specific" && (
                <div className="space-y-1">
                  <Label>Provision Reference</Label>
                  {selected?.provisions?.length > 0 ? (
                    <select value={form.provision_reference} onChange={f("provision_reference")} className={SEL}>
                      <option value="">Select section...</option>
                      {selected.provisions.map((p,i)=>(
                        <option key={i} value={p.section_number}>§{p.section_number} — {p.section_title}</option>
                      ))}
                    </select>
                  ) : (
                    <Input value={form.provision_reference} onChange={f("provision_reference")}
                      placeholder="e.g. Section 12(3)"/>
                  )}
                </div>
              )}

              <div className="space-y-1">
                <Label>Your Observation / Suggestion <span className="text-red-500">*</span></Label>
                <Textarea value={form.comment_text} onChange={f("comment_text")}
                  placeholder="Please share your detailed observation or suggestion..."
                  rows={6} required/>
              </div>
            </CardContent>
          </Card>

          <Button type="submit"
            disabled={!form.consultation_id||!form.stakeholder_name.trim()||!form.comment_text.trim()||submitMutation.isPending}
            className="w-full bg-blue-600 hover:bg-blue-700 h-11">
            {submitMutation.isPending
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin"/>Submitting...</>
              : <><Send className="w-4 h-4 mr-2"/>Submit Comment</>}
          </Button>
        </form>
      )}
    </div>
  );
}