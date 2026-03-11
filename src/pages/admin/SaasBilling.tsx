import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type BillingRow = {
  id: string;
  payment_id: string;
  tenant_id: string;
  plan_code: string | null;
  pricing_stage: string | null;
  status: string;
  status_detail: string | null;
  amount: number | null;
  expected_amount: number | null;
  currency: string | null;
  payment_method: string | null;
  payer_email: string | null;
  requires_manual_review: boolean;
  created_at: string;
  applied_at: string | null;
  tenant?: {
    name?: string | null;
    saas_paid_cycle_count?: number | null;
    subscription_status?: string | null;
  } | null;
  plan?: {
    name?: string | null;
  } | null;
};

const stageLabels: Record<string, string> = {
  trial_conversion: "Trial conversion",
  intro_renewal: "Intro renewal",
  standard_renewal: "Standard renewal",
  "mismatch/manual_review": "Manual review",
};

const statusVariant = (status: string, requiresManualReview: boolean) => {
  if (requiresManualReview) return "destructive";
  if (status === "approved") return "default";
  if (status === "pending" || status === "in_process") return "secondary";
  return "destructive";
};

const formatAmount = (currency: string | null, amount: number | null) =>
  amount != null ? `${currency ?? "CLP"} ${Number(amount).toLocaleString("es-CL")}` : "-";

export default function SaasBilling() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<BillingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [reviewFilter, setReviewFilter] = useState("all");
  const [amountFilter, setAmountFilter] = useState("");

  useEffect(() => {
    void loadRows();
  }, []);

  const loadRows = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("saas_payment_logs")
      .select("*, tenant:tenants(name, saas_paid_cycle_count, subscription_status), plan:saas_plans(name)")
      .order("created_at", { ascending: false });

    setRows((data ?? []) as BillingRow[]);
    setLoading(false);
  };

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const expectedAmount = Number(amountFilter || 0);

    return rows.filter((row) => {
      const matchesSearch = !term || [
        row.payment_id,
        row.payer_email,
        row.tenant?.name,
        row.plan?.name,
        row.status,
        row.pricing_stage,
      ].some((value) => String(value ?? "").toLowerCase().includes(term));

      const matchesStatus = statusFilter === "all" || row.status === statusFilter;
      const matchesStage = stageFilter === "all" || (row.pricing_stage ?? "none") === stageFilter;
      const matchesReview =
        reviewFilter === "all" ||
        (reviewFilter === "review" ? row.requires_manual_review : !row.requires_manual_review);
      const matchesAmount = !amountFilter || Number(row.amount ?? 0) === expectedAmount || Number(row.expected_amount ?? 0) === expectedAmount;

      return matchesSearch && matchesStatus && matchesStage && matchesReview && matchesAmount;
    });
  }, [rows, search, statusFilter, stageFilter, reviewFilter, amountFilter]);

  const metrics = useMemo(() => ({
    total: filteredRows.length,
    approved: filteredRows.filter((row) => row.status === "approved").length,
    pending: filteredRows.filter((row) => row.status === "pending" || row.status === "in_process").length,
    review: filteredRows.filter((row) => row.requires_manual_review).length,
    collected: filteredRows
      .filter((row) => row.status === "approved" && !row.requires_manual_review)
      .reduce((sum, row) => sum + Number(row.amount ?? 0), 0),
  }), [filteredRows]);

  const availableStages = Array.from(new Set(rows.map((row) => row.pricing_stage).filter(Boolean))) as string[];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate("/admin")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Billing SaaS</h1>
          <p className="text-muted-foreground">Transacciones, pricing stage y revisiones operativas de Mercado Pago.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Transacciones</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{metrics.total}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Aprobadas</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">{metrics.approved}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Pendientes</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-amber-600">{metrics.pending}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Manual review</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-red-600">{metrics.review}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Recaudado</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">${metrics.collected.toLocaleString("es-CL")}</div></CardContent></Card>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap">
        <div className="relative flex-1 min-w-[250px]">
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por tenant, email, payment_id o stage..." className="pl-9" />
        </div>
        <Input
          value={amountFilter}
          onChange={(e) => setAmountFilter(e.target.value)}
          placeholder="Monto exacto"
          className="w-full md:w-36"
          type="number"
          min="0"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-44"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_process">In process</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-full md:w-52"><SelectValue placeholder="Stage" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los stages</SelectItem>
            {availableStages.map((stage) => (
              <SelectItem key={stage} value={stage}>{stageLabels[stage] ?? stage}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={reviewFilter} onValueChange={setReviewFilter}>
          <SelectTrigger className="w-full md:w-48"><SelectValue placeholder="Revisión" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="ok">Sin inconsistencias</SelectItem>
            <SelectItem value="review">Con inconsistencias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead>Payment ID</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Esperado</TableHead>
                <TableHead>Tenant status</TableHead>
                <TableHead>Ciclos pagados</TableHead>
                <TableHead>Fecha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="py-10 text-center">Cargando transacciones...</TableCell></TableRow>
              ) : filteredRows.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="py-10 text-center">No hay transacciones para los filtros actuales.</TableCell></TableRow>
              ) : filteredRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="font-medium">{row.tenant?.name ?? row.tenant_id}</div>
                    <div className="text-xs text-muted-foreground">{row.payer_email ?? "-"}</div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{row.payment_id}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{stageLabels[row.pricing_stage ?? ""] ?? row.pricing_stage ?? "-"}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Badge variant={statusVariant(row.status, row.requires_manual_review) as "default" | "secondary" | "destructive"}>
                        {row.requires_manual_review ? "manual review" : row.status}
                      </Badge>
                      {row.requires_manual_review && (
                        <div className="inline-flex items-center gap-1 text-xs text-red-600">
                          <AlertTriangle className="h-3 w-3" />
                          Monto inconsistente
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{formatAmount(row.currency, row.amount)}</TableCell>
                  <TableCell>{formatAmount(row.currency, row.expected_amount)}</TableCell>
                  <TableCell>{row.tenant?.subscription_status ?? "-"}</TableCell>
                  <TableCell>{row.tenant?.saas_paid_cycle_count ?? 0}</TableCell>
                  <TableCell>{new Date(row.created_at).toLocaleString("es-CL")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
