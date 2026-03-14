import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { consultationApi, commentApi } from "@/api/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { Send, CheckCircle } from "lucide-react";

const STAKEHOLDER_TYPES = [
  { value: "individual", label: "Individual" },
  { value: "company", label: "Company" },
  { value: "professional_body", label: "Professional Body" },
  { value: "law_firm", label: "Law Firm" },
  { value: "academic", label: "Academic Institution" },
  { value: "government_body", label: "Government Body" },
  { value: "ngo", label: "NGO" },
  { value: "other", label: "Other" },
];

export default function SubmitComment() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [submitted, setSubmitted] = useState(false);

  const [form, setForm] = useState({
    consultation_id: "",
    stakeholder_name: "",
    stakeholder_email: "",
    stakeholder_type: "",
    comment_type: "overall",
    provision_reference: "",
    comment_text: "",
  });

  const { data: allConsultations = [], isLoading } = useQuery({
    queryKey: ["consultations"],
    queryFn: () => consultationApi.list(),
  });

  const consultations = allConsultations.filter((c) => c.status === "open");
  const selectedConsultation = consultations.find((c) => c.id === form.consultation_id);

  const submitMutation = useMutation({
    mutationFn: (data) => commentApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments"] });
      queryClient.invalidateQueries({ queryKey: ["consultations"] });
      setSubmitted(true);
    },
    onError: (err) => {
      toast({ title: "Submission Failed", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    submitMutation.mutate(form);
  };

  const resetForm = () => {
    setForm({
      consultation_id: "",
      stakeholder_name: "",
      stakeholder_email: "",
      stakeholder_type: "",
      comment_type: "overall",
      provision_reference: "",
      comment_text: "",
    });
    setSubmitted(false);
  };

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto mt-12 text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Comment Submitted Successfully</h2>
        <p className="text-slate-500 mt-2 text-sm">
          Thank you for your valuable feedback. Your comment will be analysed and considered.
        </p>
        <Button onClick={resetForm} className="mt-6 bg-blue-600 hover:bg-blue-700">
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
      ) : consultations.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-slate-500">No open consultations at the moment.</p>
        </Card>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Select Consultation</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={form.consultation_id} onValueChange={(v) => setForm({ ...form, consultation_id: v, provision_reference: "" })}>
                <SelectTrigger><SelectValue placeholder="Choose a consultation..." /></SelectTrigger>
                <SelectContent>
                  {consultations.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedConsultation && (
                <p className="text-sm text-slate-500 mt-2">{selectedConsultation.description}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Your Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Full Name *</Label>
                <Input value={form.stakeholder_name} onChange={(e) => setForm({ ...form, stakeholder_name: e.target.value })} placeholder="Enter your name" />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={form.stakeholder_email} onChange={(e) => setForm({ ...form, stakeholder_email: e.target.value })} placeholder="your@email.com" />
              </div>
              <div>
                <Label>Stakeholder Type</Label>
                <Select value={form.stakeholder_type} onValueChange={(v) => setForm({ ...form, stakeholder_type: v })}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    {STAKEHOLDER_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Your Comment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Comment Type</Label>
                <RadioGroup value={form.comment_type} onValueChange={(v) => setForm({ ...form, comment_type: v })} className="flex gap-4 mt-2">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="overall" id="overall" />
                    <Label htmlFor="overall" className="cursor-pointer">Overall Amendment</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="provision_specific" id="provision_specific" />
                    <Label htmlFor="provision_specific" className="cursor-pointer">Specific Provision</Label>
                  </div>
                </RadioGroup>
              </div>

              {form.comment_type === "provision_specific" && selectedConsultation?.provisions?.length > 0 && (
                <div>
                  <Label>Select Provision</Label>
                  <Select value={form.provision_reference} onValueChange={(v) => setForm({ ...form, provision_reference: v })}>
                    <SelectTrigger><SelectValue placeholder="Select section" /></SelectTrigger>
                    <SelectContent>
                      {selectedConsultation.provisions.map((p, i) => (
                        <SelectItem key={i} value={p.section_number}>§{p.section_number} — {p.section_title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {form.comment_type === "provision_specific" && !selectedConsultation?.provisions?.length && (
                <div>
                  <Label>Section/Provision Reference</Label>
                  <Input value={form.provision_reference} onChange={(e) => setForm({ ...form, provision_reference: e.target.value })} placeholder="e.g., Section 12(3)" />
                </div>
              )}

              <div>
                <Label>Your Observation / Suggestion *</Label>
                <Textarea
                  value={form.comment_text}
                  onChange={(e) => setForm({ ...form, comment_text: e.target.value })}
                  placeholder="Please share your detailed observation or suggestion..."
                  rows={6}
                />
              </div>
            </CardContent>
          </Card>

          <Button
            type="submit"
            disabled={!form.consultation_id || !form.stakeholder_name || !form.comment_text || submitMutation.isPending}
            className="w-full bg-blue-600 hover:bg-blue-700 h-11"
          >
            <Send className="w-4 h-4 mr-2" />
            {submitMutation.isPending ? "Submitting..." : "Submit Comment"}
          </Button>
        </form>
      )}
    </div>
  );
}