import { useState, useEffect, useRef } from "react";
import { Calendar, Plus, CheckCircle, Clock, DollarSign, Gift, AlertCircle, Pencil, Trash2, RotateCcw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { useIsMobile } from "@/hooks/use-mobile";
import jsPDF from "jspdf";
import logoImage from "@/assets/logo-colegio.png";
import firmaImage from "@/assets/firma-directiva.png";

const COMMON_UNITS = [
  "gramos", "kg", "litros", "ml", "unidades", "paquetes", "cajas", "bolsas", "metros", "otros"
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
  id: string;
  name: string;
}

interface Donation {
  id: string;
  student_id: string | null;
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

export default function ScheduledActivities() {
  const { userRole } = useAuth();
  const isMobile = useIsMobile();
  const [activities, setActivities] = useState<ScheduledActivity[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<ScheduledActivity | null>(null);

  // Donations State
  const [donationsDialogOpen, setDonationsDialogOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<ScheduledActivity | null>(null);
  const [donations, setDonations] = useState<any[]>([]);
  const [activityCompletionRates, setActivityCompletionRates] = useState<Record<string, { completed: number; total: number }>>({});

  // Drawer & Editing Donations
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingDonation, setEditingDonation] = useState<any | null>(null);

  // Form State
  const [donationItems, setDonationItems] = useState<DonationItem[]>([{ name: '', amount: '', unit: '' }]);
  const [formDonationScrollRef] = useState<any>(null);

  const [formData, setFormData] = useState({
    name: "",
    activity_date: "",
    requires_management: false,
    is_with_fee: false,
    fee_amount: "",
    is_with_donations: false,
  });

  useEffect(() => {
    fetchActivities();
    fetchStudents();
  }, []);

  useEffect(() => {
    if (activities.length > 0 && students.length > 0) {
      loadCompletionRates();
    }
  }, [activities, students]);

  const fetchActivities = async () => {
    try {
      const { data, error } = await supabase
        .from("activities")
        .select("*")
        .order("activity_date", { ascending: true });

      if (error) throw error;

      const mappedActivities: ScheduledActivity[] = (data || []).map((a: any) => {
        let metadata: any = {};
        try {
          metadata = a.description ? JSON.parse(a.description) : {};
        } catch (e) {
        }

        return {
          id: a.id,
          name: a.name,
          activity_date: a.activity_date,
          amount: a.amount,
          description: a.description,
          requires_management: metadata.requires_management || false,
          is_with_fee: a.amount > 0,
          fee_amount: a.amount,
          is_with_donations: metadata.is_with_donations || false,
          completed: metadata.completed || false
        };
      });

      setActivities(mappedActivities);
    } catch (error: any) {
      toast.error("Error al cargar actividades");
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from("students")
        .select("id, first_name, last_name")
        .order("last_name");

      if (error) throw error;
      setStudents((data || []).map(s => ({
        id: String(s.id),
        name: `${s.first_name || ''} ${s.last_name || ''}`.trim() || 'Sin Nombre'
      })));
    } catch (error: any) {
      toast.error("Error al cargar estudiantes");
    }
  };

  const loadCompletionRates = async () => {
    try {
      const rates: Record<string, { completed: number; total: number }> = {};

      const { data: exclusionsData } = await supabase
        .from("activity_exclusions")
        .select("student_id, activity_id");
      const exclusions = exclusionsData || [];

      for (const activity of activities) {
        // Force string comparison to handle mismatch if DB types are number but UUID strings provided
        const excludedStudents = new Set(
          exclusions
            .filter(e => String(e.activity_id) === String(activity.id))
            .map(e => String(e.student_id))
        );

        const eligibleStudents = students.filter(s => !excludedStudents.has(s.id));
        const totalStudents = eligibleStudents.length;
        let completedCount = 0;
        let totalCount = totalStudents;

        if (activity.is_with_donations) {
          const { data: allDonations } = await supabase
            .from("activity_donations")
            .select("name, amount, cantidad_original, donated_at, student_id")
            .eq("scheduled_activity_id", activity.id as any); // Cast to any to avoid activity_id number mismatch if strictly typed

          if (allDonations) {
            const uniqueItems = new Map<string, number>();
            allDonations.forEach(donation => {
              if (!uniqueItems.has(donation.name)) {
                uniqueItems.set(donation.name, parseFloat(donation.cantidad_original || donation.amount || "0"));
              }
            });
            const totalRequired = Array.from(uniqueItems.values()).reduce((a, b) => a + b, 0);
            const totalDonated = allDonations.filter(d => d.student_id).reduce((sum, d) => sum + parseFloat(d.amount || "0"), 0);
            totalCount = totalRequired;
            completedCount = totalDonated;
          }
        } else if (activity.is_with_fee) {
          const { data: payments } = await supabase
            .from("payments")
            .select("student_id")
            .eq("activity_id", activity.id as any); // Cast to any to avoid activity_id number mismatch if strictly typed

          if (payments) {
            const paidIds = new Set(payments.map(p => String(p.student_id))); // Force string cast
            completedCount = paidIds.size;
          }
        }

        rates[activity.id] = { completed: completedCount, total: totalCount };
      }
      setActivityCompletionRates(rates);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let activityId = editingActivity?.id;
      const payload = {
        name: formData.name,
        amount: formData.is_with_fee && formData.fee_amount ? parseFloat(formData.fee_amount) : 0,
        activity_date: formData.activity_date,
        description: JSON.stringify({
          requires_management: formData.requires_management,
          is_with_donations: formData.is_with_donations,
          fee_amount: formData.fee_amount
        })
      };

      if (editingActivity) {
        const { error } = await supabase.from("activities").update(payload).eq("id", activityId as any); // Cast to any
        if (error) throw error;
        toast.success("Actividad actualizada");
      } else {
        const { data, error } = await supabase.from("activities").insert(payload).select().single();
        if (error) throw error;
        activityId = data.id;
        toast.success("Actividad creada");
      }

      if (formData.is_with_donations && donationItems.length > 0 && activityId) {
        const validItems = donationItems.filter(i => i.name && i.amount);
        if (validItems.length > 0) {
          await supabase.from("activity_donations").insert(validItems.map(i => ({
            scheduled_activity_id: activityId as any, // Cast to any
            name: i.name,
            amount: i.amount,
            cantidad_original: i.amount,
            unit: i.unit,
            student_id: null
          })));
        }
      }

      setDialogOpen(false);
      resetForm();
      fetchActivities();
    } catch (error: any) {
      toast.error("Error: " + error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      activity_date: "",
      requires_management: false,
      is_with_fee: false,
      fee_amount: "",
      is_with_donations: false,
    });
    setDonationItems([{ name: '', amount: '', unit: '' }]);
    setEditingActivity(null);
  };

  const handleEdit = (activity: ScheduledActivity) => {
    setEditingActivity(activity);
    setFormData({
      name: activity.name,
      activity_date: activity.activity_date,
      requires_management: activity.requires_management,
      is_with_fee: activity.is_with_fee,
      fee_amount: activity.fee_amount?.toString() || "",
      is_with_donations: activity.is_with_donations
    });
    setDialogOpen(true);
  };

  const toggleCompleted = async (activity: ScheduledActivity) => {
    toast.info("Estado de actividad actualizado (simulado)");
  };

  const openDonationsDialog = (activity: ScheduledActivity) => {
    setSelectedActivity(activity);
    setDonationsDialogOpen(true);
  };

  const pendingActivities = activities.filter(a => !a.completed);
  const completedActivities = activities.filter(a => a.completed);

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Calendar className="h-8 w-8" />
            Calendarización de Actividades
          </h1>
          <p className="text-muted-foreground mt-2">Gestiona y programa actividades escolares</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}><Plus className="h-4 w-4 mr-2" /> Nueva Actividad</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingActivity ? 'Editar Actividad' : 'Agendar Nueva Actividad'}</DialogTitle>
              <DialogDescription>Complete los detalles</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Nombre</Label>
                <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
              </div>
              <div>
                <Label>Fecha</Label>
                <Input type="date" value={formData.activity_date} onChange={e => setFormData({ ...formData, activity_date: e.target.value })} required />
              </div>
              <div className="flex justify-between items-center">
                <Label>Pago de Cuota</Label>
                <Switch checked={formData.is_with_fee} onCheckedChange={c => setFormData({ ...formData, is_with_fee: c })} />
              </div>
              {formData.is_with_fee && (
                <div>
                  <Label>Monto</Label>
                  <Input type="number" value={formData.fee_amount} onChange={e => setFormData({ ...formData, fee_amount: e.target.value })} />
                </div>
              )}
              <div className="flex justify-between items-center">
                <Label>Solicitar Donaciones</Label>
                <Switch checked={formData.is_with_donations} onCheckedChange={c => setFormData({ ...formData, is_with_donations: c })} />
              </div>
              {formData.is_with_donations && (
                <div className="border p-2 rounded">
                  <Label>Items</Label>
                  {donationItems.map((item, idx) => (
                    <div key={idx} className="flex gap-2 mt-2">
                      <Input placeholder="Nombre" value={item.name} onChange={e => {
                        const n = [...donationItems]; n[idx].name = e.target.value; setDonationItems(n);
                      }} />
                      <Input type="number" placeholder="Cant" className="w-20" value={item.amount} onChange={e => {
                        const n = [...donationItems]; n[idx].amount = e.target.value; setDonationItems(n);
                      }} />
                    </div>
                  ))}
                  <Button type="button" variant="ghost" size="sm" onClick={() => setDonationItems([...donationItems, { name: '', amount: '', unit: '' }])}>+ Agregar</Button>
                </div>
              )}
              <DialogFooter>
                <Button type="submit">Guardar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {activities.map(activity => (
          <Card key={activity.id}>
            <CardHeader>
              <CardTitle className="text-lg flex justify-between">
                {activity.name}
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(activity)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => toggleCompleted(activity)}>
                    {activity.completed ? <RotateCcw className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                  </Button>
                </div>
              </CardTitle>
              <CardDescription>{activity.activity_date}</CardDescription>
            </CardHeader>
            <CardContent>
              {activity.is_with_fee && <div className="text-sm">Cuota: ${activity.amount}</div>}
              {activity.is_with_donations && (
                <Button variant="outline" size="sm" className="mt-2 w-full" onClick={() => openDonationsDialog(activity)}>
                  <Gift className="h-4 w-4 mr-2" /> Gestionar Donaciones
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
