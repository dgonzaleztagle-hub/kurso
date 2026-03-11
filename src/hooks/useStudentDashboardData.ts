import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { calculateMonthlyDebtItems, getAppliedCreditForActivity, getNetPaymentAmount, type MonthDebtItem } from "@/lib/creditAccounting";
import { parseDateFromDB } from "@/lib/dateUtils";
import { groupPaymentsForDisplay } from "@/lib/paymentGrouping";

export interface StudentDashboardDebtDetail {
  monthlyDebt: number;
  activityDebts: { name: string; amount: number }[];
  totalDebt: number;
}

export interface StudentDashboardPaymentHistory {
  id: number;
  payment_date: string;
  amount: number;
  concept: string;
  activity_id?: string | number | null;
  month_period?: string | null;
}

export interface StudentDashboardScheduledActivity {
  id: string;
  name: string;
  scheduled_date: string;
  completed: boolean;
  source?: "scheduled" | "activity";
}

export interface StudentDashboardNotification {
  id: string;
  message: string;
  created_at: string;
}

export interface StudentDashboardDonation {
  id: string;
  name: string;
  amount: string;
  unit: string;
  donated_at: string | null;
  scheduled_activity: {
    name: string;
  };
}

type StudentDashboardDataState = {
  studentName: string;
  debtDetail: StudentDashboardDebtDetail | null;
  monthlyDebtItems: MonthDebtItem[];
  activityDebtItems: Array<{ id: number; name: string; amount: number }>;
  paymentHistory: StudentDashboardPaymentHistory[];
  activities: StudentDashboardScheduledActivity[];
  notifications: StudentDashboardNotification[];
  upcomingActivities: StudentDashboardScheduledActivity[];
  activityDonations: { [activityId: string]: StudentDashboardDonation[] };
  totalPaid: number;
  creditBalance: number;
  loading: boolean;
};

type PaymentRow = Tables<"payments">;
type ActivityRow = Pick<Tables<"activities">, "id" | "name" | "amount" | "activity_date">;
type ScheduledActivityRow = Pick<Tables<"scheduled_activities">, "id" | "name" | "scheduled_date" | "completed">;
type NotificationRow = Pick<Tables<"dashboard_notifications">, "id" | "message" | "created_at">;
type StudentCreditRow = Pick<Tables<"student_credits">, "amount">;
type CreditApplicationRow = Pick<Tables<"credit_applications">, "amount" | "reversed_amount" | "target_type" | "target_month" | "target_activity_id">;
type StudentRow = Pick<Tables<"students">, "first_name" | "last_name" | "enrollment_date" | "tenant_id">;
type ActivityExclusionRow = Pick<Tables<"activity_exclusions">, "activity_id">;
type ActivityDonationRow = Pick<Tables<"activity_donations">, "id" | "name" | "amount" | "unit" | "donated_at">;
type TenantSettingsRow = Pick<Tables<"tenants">, "settings">;

const initialState: StudentDashboardDataState = {
  studentName: "",
  debtDetail: null,
  monthlyDebtItems: [],
  activityDebtItems: [],
  paymentHistory: [],
  activities: [],
  notifications: [],
  upcomingActivities: [],
  activityDonations: {},
  totalPaid: 0,
  creditBalance: 0,
  loading: true,
};

export async function fetchStudentDashboardData(studentId: string | number) {
  return fetchStudentDashboardDataForPeriod(studentId, "current");
}

export async function fetchStudentDashboardDataForPeriod(
  studentId: string | number,
  period: "current" | "year" = "current",
) {
  const [studentResult, paymentsResult, exclusionsResult, creditResult, applicationsResult] = await Promise.all([
    supabase.from("students").select("first_name, last_name, enrollment_date, tenant_id").eq("id", studentId).single(),
    supabase.from("payments").select("*").eq("student_id", studentId).order("payment_date", { ascending: false }),
    supabase.from("activity_exclusions").select("activity_id").eq("student_id", studentId),
    supabase.from("student_credits").select("amount").eq("student_id", studentId).single(),
    supabase.from("credit_applications").select("amount, reversed_amount, target_type, target_month, target_activity_id").eq("student_id", studentId),
  ]);

  if (studentResult.error) throw studentResult.error;
  if (paymentsResult.error) throw paymentsResult.error;
  if (creditResult.error && creditResult.error.code !== "PGRST116") throw creditResult.error;
  if (applicationsResult.error) throw applicationsResult.error;

  const tenantId = studentResult.data.tenant_id;
  if (!tenantId) {
    throw new Error("No se pudo detectar el curso del alumno");
  }

  const [tenantResult, activitiesResult, scheduledActivitiesResult, notificationsResult] = await Promise.all([
    supabase.from("tenants").select("settings").eq("id", tenantId).maybeSingle(),
    supabase.from("activities").select("id, name, amount, activity_date").eq("tenant_id", tenantId),
    supabase.from("scheduled_activities").select("id, name, scheduled_date, completed").eq("tenant_id", tenantId).order("scheduled_date", { ascending: false }),
    supabase.from("dashboard_notifications").select("id, message, created_at").eq("tenant_id", tenantId).eq("is_active", true).order("created_at", { ascending: false }).limit(5),
  ]);

  if (tenantResult.error) throw tenantResult.error;
  if (activitiesResult.error) throw activitiesResult.error;
  if (scheduledActivitiesResult.error) throw scheduledActivitiesResult.error;
  if (notificationsResult.error) throw notificationsResult.error;

  const fullName = `${studentResult.data.first_name || ""} ${studentResult.data.last_name || ""}`.trim() || "Sin Nombre";
  const scheduledActivities = ((scheduledActivitiesResult.data as ScheduledActivityRow[] | null) || [])
    .filter((activity) => Boolean(activity.id) && Boolean(activity.name) && Boolean(activity.scheduled_date));

  const activeActivitiesMap = new Map<string, StudentDashboardScheduledActivity>();
  scheduledActivities.forEach((activity) => {
    if (activity.completed === true) return;
    activeActivitiesMap.set(String(activity.id), {
      id: String(activity.id),
      name: activity.name,
      scheduled_date: activity.scheduled_date,
      completed: false,
      source: "scheduled",
    });
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const activity of ((activitiesResult.data as ActivityRow[] | null) || [])) {
    if (!activity.activity_date) continue;

    const activityDate = new Date(activity.activity_date);
    activityDate.setHours(0, 0, 0, 0);
    if (activityDate < today) continue;

    const mergedKey = `activity-${activity.id}`;
    activeActivitiesMap.set(mergedKey, {
      id: mergedKey,
      name: activity.name,
      scheduled_date: activity.activity_date,
      completed: false,
      source: "activity",
    });
  }

  const activeActivities = Array.from(activeActivitiesMap.values())
    .filter((activity) => {
      const activityDate = new Date(activity.scheduled_date);
      activityDate.setHours(0, 0, 0, 0);
      return activityDate >= today;
    })
    .sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime());

  const donationsMap: { [activityId: string]: StudentDashboardDonation[] } = {};

  for (const nextAct of activeActivities) {
    const { data: nextActDonations, error: donationsError } = await supabase
      .from("activity_donations")
      .select("id, name, amount, unit, donated_at")
      .eq("student_id", studentId)
      .eq("scheduled_activity_id", nextAct.id)
      .order("created_at", { ascending: false });

    if (donationsError) throw donationsError;

    donationsMap[nextAct.id] = (((nextActDonations as ActivityDonationRow[] | null) || []).map((donation) => ({
      ...donation,
      scheduled_activity: { name: nextAct.name },
    })));
  }

  const paymentHistory = groupPaymentsForDisplay(((paymentsResult.data as PaymentRow[] | null) || [])).map((payment) => ({
    id: Number(payment.folioStart),
    payment_date: payment.paymentDate,
    amount: payment.amount,
    concept: payment.concept,
    activity_id: payment.rawPayments[0]?.activity_id ?? null,
    month_period: payment.monthPeriod,
  })) as StudentDashboardPaymentHistory[];
  const totalPaid = paymentHistory.reduce((sum, payment) => sum + getNetPaymentAmount(payment), 0);

  const tenantSettings = ((tenantResult.data as TenantSettingsRow | null)?.settings ?? null);
  const configuredFee = Number(
    tenantSettings && typeof tenantSettings === "object" && !Array.isArray(tenantSettings)
      ? tenantSettings.monthly_fee
      : null,
  );
  const monthlyFee = Number.isFinite(configuredFee) && configuredFee > 0 ? configuredFee : 3000;
  const enrollmentDate = parseDateFromDB(studentResult.data.enrollment_date);
  const monthlyDebtItems = calculateMonthlyDebtItems({
    enrollmentDate: studentResult.data.enrollment_date,
    monthlyFee,
    payments: paymentHistory,
    applications: (applicationsResult.data as CreditApplicationRow[] | null) || [],
    period,
  });

  const monthlyDebt = monthlyDebtItems.reduce((sum, item) => sum + item.due, 0);
  const exclusionsSet = new Set((((exclusionsResult.data as ActivityExclusionRow[] | null) || []).map((item) => item.activity_id)));
  const activityDebts: { name: string; amount: number }[] = [];
  const activityDebtItems: Array<{ id: number; name: string; amount: number }> = [];
  const activityPayments = new Map<number, number>();

  for (const activity of ((activitiesResult.data as ActivityRow[] | null) || [])) {
    const relatedPayments = paymentHistory.filter((payment) => {
      if (payment.activity_id !== null && payment.activity_id === activity.id) {
        return true;
      }

      const activityNameNormalized = activity.name.toUpperCase().trim().replace(/\s+/g, " ");
      const conceptNormalized = (payment.concept || "").toUpperCase().trim().replace(/\s+/g, " ");
      return conceptNormalized.includes(activityNameNormalized);
    });

    activityPayments.set(
      activity.id,
      relatedPayments.reduce((sum, payment) => sum + getNetPaymentAmount(payment), 0),
    );
  }

  for (const activity of ((activitiesResult.data as ActivityRow[] | null) || [])) {
    if (!activity.activity_date) continue;

    const activityDate = new Date(activity.activity_date);

    if (activityDate > today) continue;
    if (exclusionsSet.has(activity.id)) continue;
    if (enrollmentDate > activityDate) continue;

    const paid = activityPayments.get(activity.id) || 0;
    const expectedAmount = Number(activity.amount);
    const appliedCredit = getAppliedCreditForActivity((applicationsResult.data as CreditApplicationRow[] | null) || [], activity.id);
    const owed = Math.max(0, expectedAmount - paid - appliedCredit);

    if (owed > 0) {
      activityDebts.push({ name: activity.name, amount: owed });
      activityDebtItems.push({ id: activity.id, name: activity.name, amount: owed });
    }
  }

  return {
    studentName: fullName,
    debtDetail: {
      monthlyDebt,
      activityDebts,
      totalDebt: monthlyDebt + activityDebts.reduce((sum, item) => sum + item.amount, 0),
    },
    monthlyDebtItems,
    activityDebtItems,
    paymentHistory,
    activities: scheduledActivities,
    notifications: ((notificationsResult.data as NotificationRow[] | null) || []) as StudentDashboardNotification[],
    upcomingActivities: activeActivities,
    activityDonations: donationsMap,
    totalPaid,
    creditBalance: ((creditResult.data as StudentCreditRow | null)?.amount) || 0,
  };
}

export function useStudentDashboardData(studentId?: string | number | null) {
  const [state, setState] = useState<StudentDashboardDataState>(initialState);

  useEffect(() => {
    if (!studentId) {
      setState((current) => ({ ...current, loading: false }));
      return;
    }

    let active = true;

    const loadStudentData = async () => {
      try {
        if (!studentId) return;
        setState((current) => ({ ...current, loading: true }));
        const data = await fetchStudentDashboardData(studentId);

        if (!active) return;

        setState({
          ...data,
          loading: false,
        });
      } catch (error) {
        console.error("Error loading student dashboard data:", error);
        if (!active) return;
        toast.error("Error al cargar tus datos");
        setState((current) => ({ ...current, loading: false }));
      }
    };

    void loadStudentData();

    return () => {
      active = false;
    };
  }, [studentId]);

  return state;
}
