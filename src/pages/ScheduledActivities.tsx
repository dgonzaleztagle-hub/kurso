import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calendar,
  CheckCircle,
  ClipboardList,
  FileText,
  Gift,
  ListPlus,
  Pencil,
  Plus,
  RotateCcw,
  Share2,
  Trash2,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import jsPDF from "jspdf";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import { getPdfBranding, loadImageElement } from "@/lib/pdfBranding";
import { toast } from "sonner";

const COMMON_UNITS = [
  "gramos",
  "kg",
  "litros",
  "ml",
  "unidades",
  "paquetes",
  "cajas",
  "bolsas",
  "metros",
  "otros",
] as const;

interface ScheduledActivity {
  id: string;
  name: string;
  activity_date: string;
  amount: number;
  description: string | null;
  requires_management: boolean;
  is_with_fee: boolean;
  fee_amount: number | null;
  is_with_donations: boolean;
  completed: boolean;
}

interface Student {
  id: number | string;
  name: string;
}

interface Donation {
  id: string;
  student_id: number | string | null;
  amount: string;
  donated_at: string | null;
  name: string;
  unit: string;
  scheduled_activity_id: string;
  created_at: string;
  cantidad_original: string | null;
}

interface DonationItem {
  name: string;
  amount: string;
  unit: string;
}

interface CompletionRate {
  completed: number;
  total: number;
  received: number;
}

type ActivityRow = {
  id: string | number;
  name: string;
  activity_date: string;
  amount: number | string | null;
  description: string | null;
};

type StudentRow = {
  id: number | string;
  first_name: string | null;
  last_name: string | null;
};

type ScheduledActivityLookupRow = {
  id: string | number;
  name: string;
  scheduled_date: string;
};

type ScheduledActivityExclusionRow = {
  student_id: number | string;
  scheduled_activity_id: string | number;
};

type ActivityDonationInsert = TablesInsert<"activity_donations">;
type ScheduledActivityInsert = TablesInsert<"scheduled_activities">;

const SCHEDULED_ACTIVITY_EXCLUSIONS = "scheduled_activity_exclusions" as never;
const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Ocurrió un error inesperado";

const emptyDonationItem = (): DonationItem => ({ name: "", amount: "", unit: "" });

const parseMetadata = (description: string | null) => {
  if (!description) return {};
  try {
    const parsed = JSON.parse(description);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const buildDescription = (baseDescription: string | null, overrides: Record<string, unknown>) => {
  const base = parseMetadata(baseDescription);
  return JSON.stringify({ ...base, ...overrides });
};

const formatDateLabel = (value: string | null | undefined) => {
  if (!value) return "Sin fecha";
  try {
    return format(parseISO(value), "dd 'de' MMMM 'de' yyyy", { locale: es });
  } catch {
    return value;
  }
};

const parseNumeric = (value: string | null | undefined) => {
  const parsed = parseFloat(value || "0");
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildScheduleKey = (name: string, date: string | null | undefined) =>
  `${String(name || "").trim().toUpperCase()}|${String(date || "")}`;

export default function ScheduledActivities() {
  const { userRole } = useAuth();
  const { currentTenant, roleInCurrentTenant } = useTenant();
  const [activities, setActivities] = useState<ScheduledActivity[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<ScheduledActivity | null>(null);
  const [donationsDialogOpen, setDonationsDialogOpen] = useState(false);
  const [editDonationsDialogOpen, setEditDonationsDialogOpen] = useState(false);
  const [editStudentDonationDialogOpen, setEditStudentDonationDialogOpen] = useState(false);
  const [assignDonationDialogOpen, setAssignDonationDialogOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<ScheduledActivity | null>(null);
  const [editingDonationsActivity, setEditingDonationsActivity] = useState<ScheduledActivity | null>(null);
  const [editingStudentDonation, setEditingStudentDonation] = useState<Donation | null>(null);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [eligibleDonationStudents, setEligibleDonationStudents] = useState<Student[]>([]);
  const [activityCompletionRates, setActivityCompletionRates] = useState<Record<string, CompletionRate>>({});
  const [donationItems, setDonationItems] = useState<DonationItem[]>([emptyDonationItem()]);
  const [availableDonationItems, setAvailableDonationItems] = useState<DonationItem[]>([]);
  const [assignToStudentId, setAssignToStudentId] = useState<number | string | null>(null);
  const [selectedScheduledActivityId, setSelectedScheduledActivityId] = useState<string | null>(null);
  const [assignDonationForm, setAssignDonationForm] = useState<DonationItem>(emptyDonationItem());
  const [formData, setFormData] = useState({
    name: "",
    activity_date: "",
    requires_management: false,
    is_with_fee: false,
    fee_amount: "",
    is_with_donations: false,
  });

  const fetchActivities = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("activities")
        .select("*")
        .eq("tenant_id", currentTenant?.id ?? "")
        .order("activity_date", { ascending: true });

      if (error) throw error;

      setActivities(
        ((data as ActivityRow[] | null) || []).map((activity) => {
          const metadata = parseMetadata(activity.description);
          return {
            id: String(activity.id),
            name: activity.name,
            activity_date: activity.activity_date,
            amount: Number(activity.amount || 0),
            description: activity.description,
            requires_management: Boolean(metadata.requires_management),
            is_with_fee: Number(activity.amount || 0) > 0,
            fee_amount: Number(activity.amount || 0),
            is_with_donations: Boolean(metadata.is_with_donations),
            completed: Boolean(metadata.completed),
          };
        }),
      );
    } catch (error: unknown) {
      toast.error(`Error al cargar actividades: ${getErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  }, [currentTenant?.id]);

  const fetchStudents = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("students")
        .select("id, first_name, last_name")
        .eq("tenant_id", currentTenant?.id ?? "")
        .order("last_name");

      if (error) throw error;

      setStudents(
        ((data as StudentRow[] | null) || []).map((student) => ({
          id: student.id,
          name: `${student.first_name || ""} ${student.last_name || ""}`.trim() || "Sin Nombre",
        })),
      );
    } catch (error: unknown) {
      toast.error(`Error al cargar estudiantes: ${getErrorMessage(error)}`);
    }
  }, [currentTenant?.id]);

  const loadCompletionRates = useCallback(async () => {
    try {
      const rates: Record<string, CompletionRate> = {};
      const [activityExclusionsResult, scheduledExclusionsResult] = await Promise.all([
        supabase.from("activity_exclusions").select("student_id, activity_id"),
        supabase.from(SCHEDULED_ACTIVITY_EXCLUSIONS).select("student_id, scheduled_activity_id"),
      ]);
      const scheduledActivitiesResult = await supabase
        .from("scheduled_activities")
        .select("id, name, scheduled_date")
        .eq("tenant_id", currentTenant?.id ?? "");

      const activityExclusions = activityExclusionsResult.data || [];
      const scheduledExclusions = scheduledExclusionsResult.data || [];
      const scheduledByKey = new Map<string, string>();
      ((scheduledActivitiesResult.data as ScheduledActivityLookupRow[] | null) || []).forEach((row) => {
        scheduledByKey.set(buildScheduleKey(row.name, row.scheduled_date), String(row.id));
      });

      for (const activity of activities) {
        const scheduledActivityId = scheduledByKey.get(buildScheduleKey(activity.name, activity.activity_date));
        const excludedStudents = new Set<string>([
          ...activityExclusions
            .filter((row) => String(row.activity_id) === String(activity.id))
            .map((row) => String(row.student_id)),
          ...(((scheduledExclusionsResult.data as ScheduledActivityExclusionRow[] | null) || []))
            .filter((row) => String(row.scheduled_activity_id) === String(scheduledActivityId || ""))
            .map((row) => String(row.student_id)),
        ]);

        const eligibleStudentsCount = students.filter((student) => !excludedStudents.has(String(student.id))).length;
        let completed = 0;
        let total = eligibleStudentsCount;
        let received = 0;

        if (activity.is_with_donations && scheduledActivityId) {
            const { data: donationRows, error } = await supabase
              .from("activity_donations")
              .select("name, unit, amount, cantidad_original, donated_at, student_id")
              .eq("scheduled_activity_id", scheduledActivityId);

          if (error) throw error;

          const baseItems = (donationRows || []).filter((row) => row.student_id == null);
          const assignedItems = (donationRows || []).filter((row) => row.student_id != null);

          total = baseItems.reduce((sum, row) => sum + parseNumeric(row.cantidad_original || row.amount), 0);
          completed = assignedItems.reduce((sum, row) => sum + parseNumeric(row.amount), 0);
          received = assignedItems
            .filter((row) => row.donated_at)
            .reduce((sum, row) => sum + parseNumeric(row.amount), 0);
        } else if (activity.is_with_fee) {
          const { data: payments, error } = await supabase
            .from("payments")
            .select("student_id")
            .eq("activity_id", Number(activity.id));

          if (error) throw error;

          const paidStudentIds = new Set((payments || []).map((payment) => Number(payment.student_id)));
          completed = paidStudentIds.size;
          received = completed;
        }

        rates[activity.id] = { completed, total, received };
      }

      setActivityCompletionRates(rates);
    } catch (error) {
      console.error("Error al cargar tasas de cumplimiento:", error);
    }
  }, [activities, currentTenant?.id, students]);

  useEffect(() => {
    if (!currentTenant?.id) return;
    void fetchActivities();
    void fetchStudents();
  }, [currentTenant?.id, fetchActivities, fetchStudents]);

  useEffect(() => {
    if (!activities.length || !students.length) {
      setActivityCompletionRates({});
      return;
    }
    void loadCompletionRates();
  }, [activities, loadCompletionRates, students]);

  const resetForm = () => {
    setEditingActivity(null);
    setFormData({
      name: "",
      activity_date: "",
      requires_management: false,
      is_with_fee: false,
      fee_amount: "",
      is_with_donations: false,
    });
    setDonationItems([emptyDonationItem()]);
  };

  const getScheduledActivityId = async (activity: ScheduledActivity, createIfMissing = false) => {
    if (!currentTenant?.id) throw new Error("Tenant no disponible");

    const { data: existing, error: existingError } = await supabase
      .from("scheduled_activities")
      .select("id")
      .eq("tenant_id", currentTenant.id)
      .eq("name", activity.name)
      .eq("scheduled_date", activity.activity_date)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existing?.id) return String(existing.id);
    if (!createIfMissing) return null;

    const { data: created, error: createError } = await supabase
      .from("scheduled_activities")
      .insert({
        tenant_id: currentTenant.id,
        name: activity.name,
        scheduled_date: activity.activity_date,
        amount: Number(activity.amount || 0),
        is_with_donations: activity.is_with_donations,
        completed: activity.completed,
      } as ScheduledActivityInsert)
      .select("id")
      .single();

    if (createError) throw createError;
    return String(created.id);
  };

  const replaceBaseDonationItems = async (activity: ScheduledActivity) => {
    if (!currentTenant?.id) throw new Error("Tenant no disponible");
    const scheduledActivityId = await getScheduledActivityId(activity, true);
    if (!scheduledActivityId) throw new Error("No se pudo resolver actividad programada");

    await supabase.from("activity_donations").delete().eq("scheduled_activity_id", scheduledActivityId).is("student_id", null);

    const validItems = donationItems
      .filter((item) => item.name.trim() && item.amount.trim())
      .map((item) => ({
        tenant_id: currentTenant.id,
        scheduled_activity_id: scheduledActivityId,
        name: item.name.trim(),
        amount: item.amount.trim(),
        cantidad_original: item.amount.trim(),
        unit: item.unit.trim(),
        student_id: null,
        donated_at: null,
      }));

    if (!validItems.length) return;

    const { error } = await supabase.from("activity_donations").insert(validItems as ActivityDonationInsert[]);
    if (error) throw error;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!currentTenant?.id) {
      toast.error("No se pudo detectar el curso activo");
      return;
    }

    try {
      const nextDescription = buildDescription(editingActivity?.description || null, {
        requires_management: formData.requires_management,
        is_with_donations: formData.is_with_donations,
        fee_amount: formData.fee_amount,
        completed: editingActivity?.completed || false,
      });

      const payload: Record<string, unknown> = {
        tenant_id: currentTenant.id,
        name: formData.name.trim(),
        amount: formData.is_with_fee ? Number(formData.fee_amount || 0) : 0,
        activity_date: formData.activity_date,
        description: nextDescription,
      };

      let activityId = editingActivity?.id || "";

      if (editingActivity) {
        const { error: updateError } = await supabase
          .from("activities")
          .update(payload)
          .eq("id", Number(editingActivity.id))
          .eq("tenant_id", currentTenant.id);
        if (updateError) throw updateError;
      } else {
        const { data: insertData, error: insertError } = await supabase
          .from("activities")
          .insert(payload)
          .select()
          .single();
        if (insertError) throw insertError;
        activityId = String(insertData.id);
      }

      if (formData.is_with_donations && activityId) {
        await replaceBaseDonationItems({
          id: activityId,
          name: formData.name.trim(),
          activity_date: formData.activity_date,
          amount: formData.is_with_fee ? Number(formData.fee_amount || 0) : 0,
          description: nextDescription,
          requires_management: formData.requires_management,
          is_with_fee: formData.is_with_fee,
          fee_amount: formData.is_with_fee ? Number(formData.fee_amount || 0) : null,
          is_with_donations: formData.is_with_donations,
          completed: editingActivity?.completed || false,
        });
      }

      setDialogOpen(false);
      resetForm();
      await fetchActivities();
      await loadCompletionRates();
      toast.success(editingActivity ? "Actividad actualizada" : "Actividad creada");
    } catch (error: unknown) {
      toast.error(`Error al guardar actividad: ${getErrorMessage(error)}`);
    }
  };

  const handleEdit = async (activity: ScheduledActivity) => {
    setEditingActivity(activity);
    setFormData({
      name: activity.name,
      activity_date: activity.activity_date,
      requires_management: activity.requires_management,
      is_with_fee: activity.is_with_fee,
      fee_amount: activity.fee_amount?.toString() || "",
      is_with_donations: activity.is_with_donations,
    });

    if (activity.is_with_donations) {
      const scheduledActivityId = await getScheduledActivityId(activity, false);
      if (!scheduledActivityId) {
        setDonationItems([emptyDonationItem()]);
        setDialogOpen(true);
        return;
      }
      const { data } = await supabase
        .from("activity_donations")
        .select("name, amount, cantidad_original, unit")
        .eq("scheduled_activity_id", scheduledActivityId)
        .is("student_id", null);

      setDonationItems(
        data && data.length
          ? data.map((item) => ({
            name: item.name || "",
            amount: item.cantidad_original || item.amount || "",
            unit: item.unit || "",
          }))
          : [emptyDonationItem()],
      );
    } else {
      setDonationItems([emptyDonationItem()]);
    }

    setDialogOpen(true);
  };

  const toggleCompleted = async (activity: ScheduledActivity) => {
    try {
      const nextDescription = buildDescription(activity.description, {
        requires_management: activity.requires_management,
        is_with_donations: activity.is_with_donations,
        fee_amount: activity.fee_amount,
        completed: !activity.completed,
      });

      const { error: updateError } = await supabase
        .from("activities")
        .update({ description: nextDescription })
        .eq("id", Number(activity.id))
        .eq("tenant_id", currentTenant?.id as string);

      if (updateError) throw updateError;

      toast.success(activity.completed ? "Actividad reabierta" : "Actividad finalizada");
      await fetchActivities();
    } catch (error: unknown) {
      toast.error(`Error al actualizar actividad: ${getErrorMessage(error)}`);
    }
  };

  const handleDeleteActivity = async (activity: ScheduledActivity) => {
    try {
      const scheduledActivityId = await getScheduledActivityId(activity, false);
      if (scheduledActivityId) {
        await supabase.from("activity_donations").delete().eq("scheduled_activity_id", scheduledActivityId);
        await supabase.from("scheduled_activities").delete().eq("id", scheduledActivityId);
      }

      const { error: deleteError } = await supabase
        .from("activities")
        .delete()
        .eq("id", Number(activity.id))
        .eq("tenant_id", currentTenant?.id as string);

      if (deleteError) throw deleteError;

      toast.success("Actividad eliminada");
      await fetchActivities();
    } catch (error: unknown) {
      toast.error(`Error al eliminar actividad: ${getErrorMessage(error)}`);
    }
  };

  const openEditDonationsDialog = async (activity: ScheduledActivity) => {
    setEditingDonationsActivity(activity);
    const scheduledActivityId = await getScheduledActivityId(activity, false);
    if (!scheduledActivityId) {
      setDonationItems([emptyDonationItem()]);
      setEditDonationsDialogOpen(true);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("activity_donations")
        .select("name, amount, cantidad_original, unit")
        .eq("scheduled_activity_id", scheduledActivityId)
        .is("student_id", null);

      if (error) throw error;

      setDonationItems(
        data && data.length
          ? data.map((item) => ({
            name: item.name || "",
            amount: item.cantidad_original || item.amount || "",
            unit: item.unit || "",
          }))
          : [emptyDonationItem()],
      );
      setEditDonationsDialogOpen(true);
    } catch (error: unknown) {
      toast.error(`Error al cargar donaciones: ${getErrorMessage(error)}`);
    }
  };

  const saveDonationsOnly = async () => {
    if (!editingDonationsActivity) return;

    try {
      await replaceBaseDonationItems(editingDonationsActivity);
      setEditDonationsDialogOpen(false);
      setEditingDonationsActivity(null);
      await fetchActivities();
      await loadCompletionRates();
      toast.success("Items de donaciones actualizados");
    } catch (error: unknown) {
      toast.error(`Error al guardar donaciones: ${getErrorMessage(error)}`);
    }
  };

  const openDonationsDialog = async (activity: ScheduledActivity) => {
    setSelectedActivity(activity);
    const scheduledActivityId = await getScheduledActivityId(activity, false);
    setSelectedScheduledActivityId(scheduledActivityId);

    try {
      const [donationsResult, activityExclusionsResult, scheduledExclusionsResult] = await Promise.all([
        scheduledActivityId
          ? supabase.from("activity_donations").select("*").eq("scheduled_activity_id", scheduledActivityId).not("student_id", "is", null)
          : Promise.resolve({ data: [], error: null } as { data: Donation[]; error: null }),
        supabase.from("activity_exclusions").select("student_id, activity_id"),
        supabase.from(SCHEDULED_ACTIVITY_EXCLUSIONS).select("student_id, scheduled_activity_id"),
      ]);

      if (donationsResult.error) throw donationsResult.error;

      const excludedStudents = new Set<string>([
        ...(activityExclusionsResult.data || [])
          .filter((row) => String(row.activity_id) === String(activity.id))
          .map((row) => String(row.student_id)),
        ...(((scheduledExclusionsResult.data as ScheduledActivityExclusionRow[] | null) || []))
          .filter((row) => String(row.scheduled_activity_id) === String(scheduledActivityId || ""))
          .map((row) => String(row.student_id)),
      ]);

      setDonations((donationsResult.data || []) as Donation[]);
      setEligibleDonationStudents(students.filter((student) => !excludedStudents.has(String(student.id))));
      setDonationsDialogOpen(true);
    } catch (error: unknown) {
      toast.error(`Error al cargar donaciones: ${getErrorMessage(error)}`);
    }
  };

  const openEditStudentDonationDialog = (donation: Donation) => {
    setEditingStudentDonation(donation);
    setEditStudentDonationDialogOpen(true);
  };

  const handleUpdateStudentDonation = async () => {
    if (!editingStudentDonation) return;

    try {
      const payload = {
        name: editingStudentDonation.name.trim(),
        amount: editingStudentDonation.amount.trim(),
        unit: editingStudentDonation.unit.trim(),
      };

      const { error } = await supabase.from("activity_donations").update(payload).eq("id", editingStudentDonation.id);
      if (error) throw error;

      setDonations((current) => current.map((donation) => (donation.id === editingStudentDonation.id ? { ...donation, ...payload } : donation)));
      setEditStudentDonationDialogOpen(false);
      setEditingStudentDonation(null);
      await loadCompletionRates();
      toast.success("Donación actualizada");
    } catch (error: unknown) {
      toast.error(`Error al actualizar donación: ${getErrorMessage(error)}`);
    }
  };

  const handleDeleteStudentDonation = async (donationId: string) => {
    try {
      const { error } = await supabase.from("activity_donations").delete().eq("id", donationId);
      if (error) throw error;

      setDonations((current) => current.filter((donation) => donation.id !== donationId));
      await loadCompletionRates();
      toast.success("Donación eliminada");
    } catch (error: unknown) {
      toast.error(`Error al eliminar donación: ${getErrorMessage(error)}`);
    }
  };

  const toggleDonationReceived = async (donation: Donation) => {
    try {
      const donatedAt = donation.donated_at ? null : new Date().toISOString();
      const { error } = await supabase.from("activity_donations").update({ donated_at: donatedAt }).eq("id", donation.id);
      if (error) throw error;

      setDonations((current) => current.map((item) => (item.id === donation.id ? { ...item, donated_at: donatedAt } : item)));
      await loadCompletionRates();
      toast.success(donatedAt ? "Donación marcada como recibida" : "Donación marcada como pendiente");
    } catch (error: unknown) {
      toast.error(`Error al actualizar estado: ${getErrorMessage(error)}`);
    }
  };

  const openAssignDonationDialog = async (studentId: number | string) => {
    if (!selectedActivity) return;
    let scheduledActivityId = selectedScheduledActivityId;

    try {
      if (!scheduledActivityId) {
        scheduledActivityId = await getScheduledActivityId(selectedActivity, true);
        setSelectedScheduledActivityId(scheduledActivityId);
      }
      const { data, error } = await supabase
        .from("activity_donations")
        .select("name, cantidad_original, unit")
        .eq("scheduled_activity_id", scheduledActivityId)
        .is("student_id", null);

      if (error) throw error;

      setAvailableDonationItems(
        (data || []).map((item) => ({
          name: item.name || "",
          amount: item.cantidad_original || "",
          unit: item.unit || "",
        })),
      );
      setAssignToStudentId(studentId);
      setAssignDonationForm(emptyDonationItem());
      setAssignDonationDialogOpen(true);
    } catch (error: unknown) {
      toast.error(`Error al cargar items de donación: ${getErrorMessage(error)}`);
    }
  };

  const selectDonationItem = (value: string) => {
    const item = availableDonationItems.find((candidate) => candidate.name === value);
    if (!item) return;
    setAssignDonationForm({
      name: item.name,
      amount: "",
      unit: item.unit,
    });
  };

  const handleAssignDonation = async () => {
    if (!selectedActivity || assignToStudentId === null || !currentTenant?.id) {
      toast.error("No se pudo determinar alumno o actividad");
      return;
    }
    if (!assignDonationForm.name.trim() || !assignDonationForm.amount.trim()) {
      toast.error("Complete nombre y cantidad");
      return;
    }

    try {
      const scheduledActivityId = selectedScheduledActivityId || await getScheduledActivityId(selectedActivity, true);
      const payload: ActivityDonationInsert = {
        tenant_id: currentTenant.id,
        scheduled_activity_id: scheduledActivityId,
        student_id: assignToStudentId,
        name: assignDonationForm.name.trim(),
        amount: assignDonationForm.amount.trim(),
        unit: assignDonationForm.unit.trim(),
        donated_at: null,
      };

      const { data, error } = await supabase.from("activity_donations").insert(payload).select().single();
      if (error) throw error;

      setDonations((current) => [...current, data as Donation]);
      setAssignDonationDialogOpen(false);
      setAssignToStudentId(null);
      setAssignDonationForm(emptyDonationItem());
      await loadCompletionRates();
      toast.success("Donación asignada");
    } catch (error: unknown) {
      toast.error(`Error al asignar donación: ${getErrorMessage(error)}`);
    }
  };

  const handleShareDonations = async (activity: ScheduledActivity) => {
    const scheduledActivityId = await getScheduledActivityId(activity, true);
    if (!scheduledActivityId) {
      toast.error("No se pudo generar enlace de donaciones");
      return;
    }
    const donationUrl = `${window.location.origin}/donaciones/${scheduledActivityId}`;
    const shareText = `Selecciona tu donacion para la actividad "${activity.name}".`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: activity.name,
          text: shareText,
          url: donationUrl,
        });
        toast.success("Enlace de donaciones compartido");
        return;
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
      }
    }

    await navigator.clipboard.writeText(donationUrl);
    toast.success("Enlace de donaciones copiado");
  };

  const exportPendingDonationsPDF = () => {
    if (!selectedActivity) return;
    const pdfBranding = getPdfBranding(currentTenant);

    const pendingRows = eligibleDonationStudents
      .map((student) => {
        const studentDonations = donations.filter((donation) => String(donation.student_id) === String(student.id));
        if (studentDonations.length === 0) {
          return { student, detail: "Sin registrar" };
        }

        const pending = studentDonations.filter((donation) => !donation.donated_at);
        if (pending.length === 0) return null;

        return {
          student,
          detail: pending.map((donation) => `${donation.name} (${donation.amount} ${donation.unit || ""})`.trim()).join(", "),
        };
      })
      .filter(Boolean) as { student: Student; detail: string }[];

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Donaciones Pendientes", 105, 18, { align: "center" });
    doc.setFontSize(11);
    doc.text(selectedActivity.name, 105, 26, { align: "center" });
    doc.text(`Fecha: ${formatDateLabel(selectedActivity.activity_date)}`, 20, 38);
    doc.text(`Curso: ${pdfBranding.reportSubtitle}`, 20, 46);
    doc.text(`Pendientes: ${pendingRows.length}`, 20, 54);

    let y = 66;
    doc.setFontSize(9);

    if (!pendingRows.length) {
      doc.text("No hay donaciones pendientes.", 20, y);
    } else {
      pendingRows.forEach((row, index) => {
        if (y > 275) {
          doc.addPage();
          y = 20;
        }
        doc.text(`${index + 1}. ${row.student.name}`, 20, y);
        doc.text(row.detail, 90, y);
        y += 8;
      });
    }

    doc.save(`donaciones-pendientes-${selectedActivity.name.replace(/\s+/g, "-")}.pdf`);
    toast.success("Pendientes exportados a PDF");
  };

  const handleDownloadDonationsReport = async (activity: ScheduledActivity) => {
    const scheduledActivityId = await getScheduledActivityId(activity, false);
    if (!scheduledActivityId) {
      toast.error("No hay actividad programada asociada para generar reporte");
      return;
    }

    try {
      const pdfBranding = getPdfBranding(currentTenant);
      const [donationsResult, activityExclusionsResult, scheduledExclusionsResult] = await Promise.all([
        supabase.from("activity_donations").select("*").eq("scheduled_activity_id", scheduledActivityId).order("name", { ascending: true }),
        supabase.from("activity_exclusions").select("student_id, activity_id"),
        supabase.from(SCHEDULED_ACTIVITY_EXCLUSIONS).select("student_id, scheduled_activity_id"),
      ]);

      if (donationsResult.error) throw donationsResult.error;

      const donationsData = (donationsResult.data || []) as Donation[];
      const excludedStudents = new Set<string>([
        ...(activityExclusionsResult.data || [])
          .filter((row) => String(row.activity_id) === String(activity.id))
          .map((row) => String(row.student_id)),
        ...(((scheduledExclusionsResult.data as ScheduledActivityExclusionRow[] | null) || []))
          .filter((row) => String(row.scheduled_activity_id) === String(scheduledActivityId))
          .map((row) => String(row.student_id)),
      ]);

      const doc = new jsPDF();
      const logoImg = await loadImageElement(pdfBranding.logoUrl);
      if (logoImg) {
        doc.addImage(logoImg, "PNG", 15, 10, 26, 18);
      }
      doc.setFontSize(16);
      doc.text("Estado de Donaciones", 105, 18, { align: "center" });
      doc.setFontSize(10);
      doc.text(pdfBranding.reportSubtitle, 105, 25, { align: "center" });
      doc.text(formatDateLabel(activity.activity_date), 105, 31, { align: "center" });
      doc.line(15, 36, 195, 36);

      let y = 46;
      doc.setFontSize(11);
      doc.text(`Actividad: ${activity.name}`, 15, y);
      y += 8;

      const grouped = new Map<string, { name: string; unit: string; total: number; committed: number; received: number }>();
      donationsData.forEach((donation) => {
        const key = `${donation.name}|${donation.unit || ""}`;
        if (!grouped.has(key)) {
          grouped.set(key, {
            name: donation.name,
            unit: donation.unit || "",
            total: 0,
            committed: 0,
            received: 0,
          });
        }
        const item = grouped.get(key)!;
        if (donation.student_id == null) {
          item.total += parseNumeric(donation.cantidad_original || donation.amount);
        } else {
          item.committed += parseNumeric(donation.amount);
          if (donation.donated_at) item.received += parseNumeric(donation.amount);
        }
      });

      const rows = Array.from(grouped.values());
      if (!rows.length) {
        doc.setFontSize(10);
        doc.text("No hay datos de donaciones para esta actividad.", 15, y);
      } else {
        rows.forEach((row, index) => {
          if (y > 260) {
            doc.addPage();
            y = 20;
          }
          doc.setFontSize(10);
          doc.text(`${index + 1}. ${row.name}`, 15, y);
          y += 6;
          doc.setFontSize(9);
          doc.text(`Solicitado: ${row.total} ${row.unit}`, 20, y);
          y += 5;
          doc.text(`Comprometido: ${row.committed} ${row.unit}`, 20, y);
          y += 5;
          doc.text(`Recibido: ${row.received} ${row.unit}`, 20, y);
          y += 8;
        });
      }

      const studentsWhoDonated = new Set(
        donationsData.filter((donation) => donation.student_id != null).map((donation) => String(donation.student_id)),
      );
      const studentsWithoutDonation = students.filter(
        (student) => !studentsWhoDonated.has(String(student.id)) && !excludedStudents.has(String(student.id)),
      );

      if (y > 235) {
        doc.addPage();
        y = 20;
      }

      doc.setFontSize(11);
      doc.text("Alumnos sin donación registrada", 15, y);
      y += 8;
      doc.setFontSize(9);
      if (!studentsWithoutDonation.length) {
        doc.text("Todos los alumnos tienen al menos una donación registrada.", 20, y);
        y += 6;
      } else {
        studentsWithoutDonation.forEach((student) => {
          if (y > 270) {
            doc.addPage();
            y = 20;
          }
          doc.text(`- ${student.name}`, 20, y);
          y += 5;
        });
      }

      if (y > 240) {
        doc.addPage();
        y = 20;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(pdfBranding.signatureCourseLine, 15, y + 16);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(pdfBranding.signatureInstitutionLine, 15, y + 22);
      doc.save(`Estado_Cumplimiento_${activity.name.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("Reporte de donaciones generado");
    } catch (error: unknown) {
      toast.error(`Error al generar reporte: ${getErrorMessage(error)}`);
    }
  };

  const getActivityStatus = (activity: ScheduledActivity) => {
    if (activity.completed) return { label: "Completada", className: "text-green-600 border-green-200" };

    const activityDate = new Date(activity.activity_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    activityDate.setHours(0, 0, 0, 0);
    const daysUntil = Math.ceil((activityDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntil < 0) return { label: "Vencida", className: "text-red-600 border-red-200" };
    if (daysUntil <= 7) return { label: `Próxima (${daysUntil}d)`, className: "text-orange-600 border-orange-200" };
    return { label: "Pendiente", className: "text-blue-600 border-blue-200" };
  };

  const groupedStudentDonations = useMemo(
    () =>
      eligibleDonationStudents.map((student) => ({
        student,
        donations: donations.filter((donation) => String(donation.student_id) === String(student.id)),
      })),
    [donations, eligibleDonationStudents],
  );

  const canReopenActivities = roleInCurrentTenant === "owner" || roleInCurrentTenant === "admin" || roleInCurrentTenant === "master" || userRole === "master";

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Cargando actividades...</div>;
  }

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            <Calendar className="h-8 w-8" />
            Calendarización de Actividades
          </h1>
          <p className="mt-2 text-muted-foreground">Gestiona y programa actividades escolares</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" />
              Nueva Actividad
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingActivity ? "Editar Actividad" : "Agendar Nueva Actividad"}</DialogTitle>
              <DialogDescription>Complete los detalles de la actividad.</DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="activity-name">Nombre</Label>
                <Input id="activity-name" value={formData.name} onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))} required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="activity-date">Fecha</Label>
                <Input id="activity-date" type="date" value={formData.activity_date} onChange={(event) => setFormData((current) => ({ ...current, activity_date: event.target.value }))} required />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="requires-management">Requiere gestión</Label>
                <Switch id="requires-management" checked={formData.requires_management} onCheckedChange={(checked) => setFormData((current) => ({ ...current, requires_management: checked }))} />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="with-fee">Es con cuota</Label>
                <Switch id="with-fee" checked={formData.is_with_fee} onCheckedChange={(checked) => setFormData((current) => ({ ...current, is_with_fee: checked }))} />
              </div>

              {formData.is_with_fee && (
                <div className="space-y-2">
                  <Label htmlFor="fee-amount">Monto cuota</Label>
                  <Input id="fee-amount" type="number" value={formData.fee_amount} onChange={(event) => setFormData((current) => ({ ...current, fee_amount: event.target.value }))} />
                </div>
              )}

              <div className="flex items-center justify-between">
                <Label htmlFor="with-donations">Solicitar donaciones</Label>
                <Switch id="with-donations" checked={formData.is_with_donations} onCheckedChange={(checked) => setFormData((current) => ({ ...current, is_with_donations: checked }))} />
              </div>

              {formData.is_with_donations && (
                <div className="space-y-3 rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <Label>Items de donación</Label>
                    <Button type="button" variant="outline" size="sm" onClick={() => setDonationItems((current) => [...current, emptyDonationItem()])}>
                      <Plus className="mr-1 h-4 w-4" />
                      Agregar
                    </Button>
                  </div>

                  {donationItems.map((item, index) => (
                    <div key={`form-item-${index}`} className="grid gap-2 rounded-md border p-3">
                      <div className="space-y-2">
                        <Label>Nombre del item</Label>
                        <Input value={item.name} onChange={(event) => setDonationItems((current) => current.map((candidate, candidateIndex) => candidateIndex === index ? { ...candidate, name: event.target.value } : candidate))} />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-2">
                          <Label>Cantidad</Label>
                          <Input value={item.amount} onChange={(event) => setDonationItems((current) => current.map((candidate, candidateIndex) => candidateIndex === index ? { ...candidate, amount: event.target.value } : candidate))} />
                        </div>
                        <div className="space-y-2">
                          <Label>Unidad</Label>
                          <Select value={item.unit} onValueChange={(value) => setDonationItems((current) => current.map((candidate, candidateIndex) => candidateIndex === index ? { ...candidate, unit: value } : candidate))}>
                            <SelectTrigger>
                              <SelectValue placeholder="Unidad" />
                            </SelectTrigger>
                            <SelectContent>
                              {COMMON_UNITS.map((unit) => (
                                <SelectItem key={unit} value={unit}>
                                  {unit}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      {donationItems.length > 1 && (
                        <Button type="button" variant="ghost" size="sm" className="justify-start text-destructive" onClick={() => setDonationItems((current) => current.filter((_, candidateIndex) => candidateIndex !== index))}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Quitar item
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <DialogFooter>
                <Button type="submit">Guardar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {activities.map((activity) => {
          const status = getActivityStatus(activity);
          const rate = activityCompletionRates[activity.id];
          const completionPercentage = rate?.total ? Math.min(100, Math.round((rate.completed / rate.total) * 100)) : 0;

          return (
            <Card key={activity.id}>
              <CardHeader className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-xl">{activity.name}</CardTitle>
                    <CardDescription className="mt-2">{formatDateLabel(activity.activity_date)}</CardDescription>
                  </div>
                  <Badge variant="outline" className={status.className}>
                    {status.label}
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-2">
                  {activity.is_with_fee && <Badge variant="secondary">Cuota ${Number(activity.amount).toLocaleString("es-CL")}</Badge>}
                  {activity.is_with_donations && <Badge className="bg-green-600 hover:bg-green-600">Donaciones</Badge>}
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {(activity.is_with_donations || activity.is_with_fee) && rate && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Nivel de cumplimiento</span>
                      <span className="font-medium">
                        {rate.completed}/{rate.total} ({completionPercentage}%)
                      </span>
                    </div>
                    <Progress value={completionPercentage} className="h-2" />
                    {activity.is_with_donations && <p className="text-xs text-muted-foreground">Recibido: {rate.received} de {rate.total}</p>}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => toggleCompleted(activity)} disabled={activity.completed && !canReopenActivities} title={activity.completed && !canReopenActivities ? "Solo administradores del curso pueden reabrir actividades cerradas" : ""}>
                    {activity.completed ? <RotateCcw className="mr-2 h-4 w-4" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                    {activity.completed ? "Reabrir" : "Cerrar"}
                  </Button>

                  {activity.is_with_donations && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => openEditDonationsDialog(activity)}>
                        <ListPlus className="mr-2 h-4 w-4" />
                        Items
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openDonationsDialog(activity)}>
                        <Gift className="mr-2 h-4 w-4" />
                        Donaciones
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDownloadDonationsReport(activity)}>
                        <ClipboardList className="mr-2 h-4 w-4" />
                        Informe
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => handleShareDonations(activity)}>
                        <Share2 className="mr-2 h-4 w-4" />
                        Compartir
                      </Button>
                    </>
                  )}

                  <Button variant="ghost" size="sm" onClick={() => void handleEdit(activity)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Editar
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Eliminar
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Eliminar actividad</AlertDialogTitle>
                        <AlertDialogDescription>Se eliminará la actividad y sus registros de donaciones asociados.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => handleDeleteActivity(activity)}>
                          Eliminar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={editDonationsDialogOpen} onOpenChange={setEditDonationsDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Donaciones Pre-cargadas</DialogTitle>
            <DialogDescription>{editingDonationsActivity?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {donationItems.map((item, index) => (
              <div key={`edit-item-${index}`} className="grid gap-3 rounded-md border p-3">
                <div className="space-y-2">
                  <Label>Item</Label>
                  <Input value={item.name} onChange={(event) => setDonationItems((current) => current.map((candidate, candidateIndex) => candidateIndex === index ? { ...candidate, name: event.target.value } : candidate))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Cantidad</Label>
                    <Input value={item.amount} onChange={(event) => setDonationItems((current) => current.map((candidate, candidateIndex) => candidateIndex === index ? { ...candidate, amount: event.target.value } : candidate))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Unidad</Label>
                    <Select value={item.unit} onValueChange={(value) => setDonationItems((current) => current.map((candidate, candidateIndex) => candidateIndex === index ? { ...candidate, unit: value } : candidate))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Unidad" />
                      </SelectTrigger>
                      <SelectContent>
                        {COMMON_UNITS.map((unit) => (
                          <SelectItem key={unit} value={unit}>
                            {unit}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {donationItems.length > 1 && (
                  <Button type="button" variant="ghost" size="sm" className="justify-start text-destructive" onClick={() => setDonationItems((current) => current.filter((_, candidateIndex) => candidateIndex !== index))}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Eliminar item
                  </Button>
                )}
              </div>
            ))}
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button type="button" variant="outline" onClick={() => setDonationItems((current) => [...current, emptyDonationItem()])}>
              <Plus className="mr-2 h-4 w-4" />
              Agregar item
            </Button>
            <Button type="button" onClick={saveDonationsOnly}>
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={donationsDialogOpen} onOpenChange={setDonationsDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl">
          <DialogHeader>
            <DialogTitle>Donaciones - {selectedActivity?.name}</DialogTitle>
            <DialogDescription>Toca un alumno para registrar su donación.</DialogDescription>
          </DialogHeader>

          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={exportPendingDonationsPDF}>
              <FileText className="mr-2 h-4 w-4" />
              Exportar Pendientes
            </Button>
          </div>

          <ScrollArea className="h-[60vh] pr-4">
            <div className="space-y-3">
              {groupedStudentDonations.map(({ student, donations: studentDonations }) => (
                <Card key={student.id}>
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{student.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {studentDonations.length === 0 ? "Sin registrar" : `${studentDonations.length} donación(es) registradas`}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => openAssignDonationDialog(student.id)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Asignar
                      </Button>
                    </div>

                    {studentDonations.length > 0 && (
                      <div className="space-y-2">
                        {studentDonations.map((donation) => (
                          <div key={donation.id} className="rounded-md border p-3">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-medium">{donation.name}</span>
                                  <Badge variant="outline">
                                    {donation.amount} {donation.unit}
                                  </Badge>
                                  <Badge variant="outline" className={donation.donated_at ? "text-green-600" : "text-amber-600"}>
                                    {donation.donated_at ? "Recibida" : "Asignada"}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {donation.donated_at ? `Recibida el ${formatDateLabel(donation.donated_at)}` : "Pendiente de entrega"}
                                </p>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                <Button variant="outline" size="sm" onClick={() => toggleDonationReceived(donation)}>
                                  {donation.donated_at ? <RotateCcw className="mr-2 h-4 w-4" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                                  {donation.donated_at ? "Marcar pendiente" : "Marcar recibida"}
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => openEditStudentDonationDialog(donation)}>
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Editar
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Eliminar
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Eliminar compromiso</AlertDialogTitle>
                                      <AlertDialogDescription>Se eliminará el compromiso de donación de {student.name}.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => handleDeleteStudentDonation(donation.id)}>
                                        Eliminar
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={editStudentDonationDialogOpen} onOpenChange={setEditStudentDonationDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Donación</DialogTitle>
            <DialogDescription>Actualice el compromiso del alumno.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Item</Label>
              <Input value={editingStudentDonation?.name || ""} onChange={(event) => setEditingStudentDonation((current) => current ? { ...current, name: event.target.value } : current)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Cantidad</Label>
                <Input value={editingStudentDonation?.amount || ""} onChange={(event) => setEditingStudentDonation((current) => current ? { ...current, amount: event.target.value } : current)} />
              </div>
              <div className="space-y-2">
                <Label>Unidad</Label>
                <Select value={editingStudentDonation?.unit || ""} onValueChange={(value) => setEditingStudentDonation((current) => current ? { ...current, unit: value } : current)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Unidad" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_UNITS.map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {unit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditStudentDonationDialogOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleUpdateStudentDonation}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assignDonationDialogOpen} onOpenChange={setAssignDonationDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Asignar Donación</DialogTitle>
            <DialogDescription>{students.find((student) => String(student.id) === String(assignToStudentId))?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {availableDonationItems.length > 0 && (
              <div className="space-y-2">
                <Label>Seleccionar item pre-cargado</Label>
                <Select onValueChange={selectDonationItem}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione un item..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDonationItems.map((item, index) => (
                      <SelectItem key={`${item.name}-${index}`} value={item.name}>
                        {item.name} ({item.amount} {item.unit})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Nombre del item</Label>
              <Input value={assignDonationForm.name} onChange={(event) => setAssignDonationForm((current) => ({ ...current, name: event.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Cantidad</Label>
                <Input value={assignDonationForm.amount} onChange={(event) => setAssignDonationForm((current) => ({ ...current, amount: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Unidad</Label>
                <Select value={assignDonationForm.unit} onValueChange={(value) => setAssignDonationForm((current) => ({ ...current, unit: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Unidad" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_UNITS.map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {unit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAssignDonationDialogOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleAssignDonation}>
              Asignar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
