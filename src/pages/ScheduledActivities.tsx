import { useState, useEffect, useRef } from "react";
import { Calendar, Plus, CheckCircle, Clock, DollarSign, Gift, ChevronDown, ChevronUp, ChevronRight, AlertCircle, FileText, Pencil, Trash2, RefreshCw, RotateCcw, Share2, ListPlus, ClipboardList } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, isBefore, isAfter, addDays, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import jsPDF from "jspdf";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import logoImage from "@/assets/logo-colegio.png";
import firmaImage from "@/assets/firma-directiva.png";

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
  "otros"
] as const;

interface ScheduledActivity {
  id: string;
  name: string;
  scheduled_date: string;
  requires_management: boolean;
  is_with_fee: boolean;
  fee_amount: number | null;
  is_with_donations: boolean;
  activity_id: number | null;
  completed: boolean;
  created_at: string;
}

interface Student {
  id: number;
  name: string;
}

interface Donation {
  id: string;
  student_id: number;
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
  const [donationsDialogOpen, setDonationsDialogOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<ScheduledActivity | null>(null);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [expandedStudents, setExpandedStudents] = useState<Set<number>>(new Set());
  const [activityCompletionRates, setActivityCompletionRates] = useState<Record<string, { completed: number; total: number }>>({});
  const [editingDonation, setEditingDonation] = useState<Donation | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [donationItems, setDonationItems] = useState<DonationItem[]>([
    { name: '', amount: '', unit: '' }
  ]);
  const [expandedDonationIndex, setExpandedDonationIndex] = useState<number>(0);
  const [editDonationsDialogOpen, setEditDonationsDialogOpen] = useState(false);
  const [editingDonationsActivity, setEditingDonationsActivity] = useState<ScheduledActivity | null>(null);
  const donationScrollRef = useRef<HTMLDivElement>(null);
  const formDonationScrollRef = useRef<HTMLDivElement>(null);
  
  // Estados para editar/eliminar/asignar compromisos de donación
  const [editStudentDonationDialogOpen, setEditStudentDonationDialogOpen] = useState(false);
  const [editingStudentDonation, setEditingStudentDonation] = useState<Donation | null>(null);
  const [assignDonationDialogOpen, setAssignDonationDialogOpen] = useState(false);
  const [assignToStudentId, setAssignToStudentId] = useState<number | null>(null);
  const [availableDonationItems, setAvailableDonationItems] = useState<{name: string; unit: string; cantidad_original: string}[]>([]);
  const [assignDonationForm, setAssignDonationForm] = useState({ name: '', amount: '', unit: '' });

  const [formData, setFormData] = useState({
    name: "",
    scheduled_date: "",
    requires_management: false,
    is_with_fee: false,
    fee_amount: "",
    is_with_donations: false,
  });

  useEffect(() => {
    fetchActivities();
    fetchStudents();
    checkOverdueActivities();
  }, []);

  useEffect(() => {
    if (activities.length > 0 && students.length > 0) {
      loadCompletionRates();
    }
  }, [activities, students]);

  const fetchActivities = async () => {
    try {
      const { data, error } = await supabase
        .from("scheduled_activities")
        .select("*")
        .order("scheduled_date", { ascending: true });

      if (error) throw error;
      setActivities(data || []);
    } catch (error: any) {
      toast.error("Error al cargar actividades: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from("students")
        .select("id, name")
        .order("name");

      if (error) throw error;
      setStudents(data || []);
    } catch (error: any) {
      toast.error("Error al cargar estudiantes: " + error.message);
    }
  };

  const loadCompletionRates = async () => {
    try {
      const rates: Record<string, { completed: number; total: number }> = {};
      
      // Obtener exclusiones de actividades base
      const { data: baseExclusionsData } = await supabase
        .from("activity_exclusions")
        .select("student_id, activity_id");
      
      // Obtener exclusiones de actividades programadas
      const { data: scheduledExclusionsData } = await supabase
        .from("scheduled_activity_exclusions")
        .select("student_id, scheduled_activity_id");
      
      const baseExclusions = baseExclusionsData || [];
      const scheduledExclusions = scheduledExclusionsData || [];
      
      for (const activity of activities) {
        // Combinar exclusiones: de actividad base + de actividad programada
        const excludedFromBase = new Set(
          baseExclusions
            .filter(e => e.activity_id === activity.activity_id)
            .map(e => e.student_id)
        );
        
        const excludedFromScheduled = new Set(
          scheduledExclusions
            .filter(e => e.scheduled_activity_id === activity.id)
            .map(e => e.student_id)
        );
        
        // Unión de ambos conjuntos
        const excludedStudentIds = new Set([...excludedFromBase, ...excludedFromScheduled]);
        
        const eligibleStudents = students.filter(s => !excludedStudentIds.has(s.id));
        const totalStudents = eligibleStudents.length;
        let completedCount = 0;
        let totalCount = totalStudents;

        if (activity.is_with_donations) {
          // Para donaciones, calcular unidades donadas vs total de unidades requeridas
          const { data: allDonations, error } = await supabase
            .from("activity_donations")
            .select("name, amount, cantidad_original, donated_at, student_id")
            .eq("scheduled_activity_id", activity.id);

          if (!error && allDonations) {
            // Agrupar por nombre de item para obtener items únicos (cada item tiene 36 copias, una por estudiante)
            const uniqueItems = new Map<string, number>();
            allDonations.forEach(donation => {
              if (!uniqueItems.has(donation.name)) {
                const original = parseFloat(donation.cantidad_original || donation.amount || "0");
                uniqueItems.set(donation.name, original);
              }
            });

            // Total requerido: suma de cantidad_original de items únicos
            const totalRequired = Array.from(uniqueItems.values()).reduce((sum, val) => sum + val, 0);

            // Total comprometido: suma de amount donde student_id NO es null (el alumno se comprometió)
            const totalDonated = allDonations
              .filter(item => item.student_id !== null)
              .reduce((sum, item) => {
                const amount = parseFloat(item.amount || "0");
                return sum + amount;
              }, 0);

            totalCount = totalRequired;
            completedCount = totalDonated;
          }
        } else if (activity.is_with_fee && activity.activity_id) {
          // Para cuotas, mantener el cálculo existente: pagos realizados vs alumnos elegibles
          const { data: paymentsData, error } = await supabase
            .from("payments")
            .select("student_id")
            .eq("activity_id", activity.activity_id);

          if (!error && paymentsData) {
            const paidStudentIds = paymentsData
              .filter(p => !excludedStudentIds.has(p.student_id))
              .map(p => p.student_id);
            completedCount = new Set(paidStudentIds).size;
          }
        }

        rates[activity.id] = {
          completed: completedCount,
          total: totalCount
        };
      }

      setActivityCompletionRates(rates);
    } catch (error: any) {
      console.error("Error al cargar tasas de cumplimiento:", error);
    }
  };

  const checkOverdueActivities = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from("scheduled_activities")
        .update({ completed: true })
        .lt("scheduled_date", today)
        .eq("completed", false)
        .select();

      if (error) throw error;
      if (data && data.length > 0) {
        toast.info(`${data.length} actividad(es) marcada(s) como completada(s) automáticamente`);
        fetchActivities();
      }
    } catch (error: any) {
      console.error("Error al verificar actividades vencidas:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      let activityId = null;
      let scheduledActivityId = editingActivity?.id;

      if (editingActivity) {
        // Modo edición
        const { error: updateError } = await supabase
          .from("scheduled_activities")
          .update({
            name: formData.name,
            scheduled_date: formData.scheduled_date,
            requires_management: formData.requires_management,
            is_with_fee: formData.is_with_fee,
            fee_amount: formData.is_with_fee ? parseFloat(formData.fee_amount) : null,
            is_with_donations: formData.is_with_donations,
          })
          .eq("id", editingActivity.id);

        if (updateError) throw updateError;

        // Si tiene donaciones, eliminar items pre-cargados y crear nuevos
        if (formData.is_with_donations && donationItems.length > 0) {
          await supabase
            .from("activity_donations")
            .delete()
            .eq("scheduled_activity_id", editingActivity.id)
            .is("student_id", null);
        }

        toast.success("Actividad actualizada exitosamente");
      } else {
        // Modo creación
        // Si es con cuota, crear en la tabla activities
        if (formData.is_with_fee && formData.fee_amount) {
          const { data: activityData, error: activityError } = await supabase
            .from("activities")
            .insert({
              name: formData.name,
              amount: parseFloat(formData.fee_amount),
              activity_date: formData.scheduled_date,
            })
            .select()
            .single();

          if (activityError) throw activityError;
          activityId = activityData.id;
          toast.success("Actividad agregada al módulo de Actividades");
        }

        // Crear actividad programada
        const { data: scheduledData, error: scheduledError } = await supabase
          .from("scheduled_activities")
          .insert({
            name: formData.name,
            scheduled_date: formData.scheduled_date,
            requires_management: formData.requires_management,
            is_with_fee: formData.is_with_fee,
            fee_amount: formData.is_with_fee ? parseFloat(formData.fee_amount) : null,
            is_with_donations: formData.is_with_donations,
            activity_id: activityId,
          })
          .select()
          .single();

        if (scheduledError) throw scheduledError;
        scheduledActivityId = scheduledData.id;

        toast.success("Actividad agendada exitosamente");
      }

      // Guardar items de donaciones pre-cargados si aplica
      if (formData.is_with_donations && donationItems.length > 0 && scheduledActivityId) {
        const donationsToInsert = donationItems
          .filter(item => item.name.trim() && item.amount.trim())
          .map(item => ({
            scheduled_activity_id: scheduledActivityId,
            name: item.name.trim(),
            amount: item.amount.trim(), // Cantidad disponible actual
            cantidad_original: item.amount.trim(), // Cantidad original solicitada
            unit: item.unit.trim(),
            student_id: null,
            donated_at: null
          }));

        if (donationsToInsert.length > 0) {
          const { error: donationsError } = await supabase
            .from("activity_donations")
            .insert(donationsToInsert);

          if (donationsError) throw donationsError;
        }
      }
      
      setDialogOpen(false);
      setEditingActivity(null);
      resetForm();
      fetchActivities();
    } catch (error: any) {
      toast.error("Error al procesar actividad: " + error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      scheduled_date: "",
      requires_management: false,
      is_with_fee: false,
      fee_amount: "",
      is_with_donations: false,
    });
    setDonationItems([{ name: '', amount: '', unit: '' }]);
  };

  const addDonationItem = () => {
    const newIndex = donationItems.length;
    setDonationItems([...donationItems, { name: '', amount: '', unit: '' }]);
    setExpandedDonationIndex(newIndex);
    
    // Desplazar al nuevo elemento después de un pequeño delay para que el DOM se actualice
    setTimeout(() => {
      if (editDonationsDialogOpen && donationScrollRef.current) {
        donationScrollRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
      } else if (formDonationScrollRef.current) {
        formDonationScrollRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    }, 100);
  };

  const removeDonationItem = (index: number) => {
    setDonationItems(donationItems.filter((_, i) => i !== index));
    if (expandedDonationIndex === index) {
      setExpandedDonationIndex(Math.max(0, index - 1));
    }
  };

  const updateDonationItem = (index: number, field: keyof DonationItem, value: string) => {
    const updated = [...donationItems];
    updated[index][field] = value;
    setDonationItems(updated);
  };

  const toggleCompleted = async (activity: ScheduledActivity) => {
    // Si está cerrada y se quiere reabrir, solo permitir a master
    if (activity.completed && userRole !== 'master') {
      toast.error("Solo el usuario master puede reabrir actividades cerradas");
      return;
    }

    // Pedir confirmación siempre (tanto al cerrar como al reabrir)
    if (!activity.completed) {
      const confirmed = window.confirm(
        `¿Está seguro de marcar esta actividad como completada?\n\n` +
        `Actividad: ${activity.name}\n` +
        `Fecha: ${format(parseISO(activity.scheduled_date), "dd 'de' MMMM 'de' yyyy", { locale: es })}\n\n` +
        `Solo el usuario master podrá reabrirla posteriormente.`
      );
      
      if (!confirmed) return;
    } else {
      // Confirmar antes de reabrir
      const confirmed = window.confirm(
        `¿Está seguro que desea reabrir esta actividad?\n\n` +
        `Actividad: ${activity.name}\n` +
        `Fecha: ${format(parseISO(activity.scheduled_date), "dd 'de' MMMM 'de' yyyy", { locale: es })}`
      );
      
      if (!confirmed) return;
    }

    try {
      const { error } = await supabase
        .from("scheduled_activities")
        .update({ completed: !activity.completed })
        .eq("id", activity.id);

      if (error) throw error;
      toast.success(activity.completed ? "Actividad reabierta exitosamente" : "Actividad marcada como completada");
      fetchActivities();
    } catch (error: any) {
      toast.error("Error al actualizar actividad: " + error.message);
    }
  };

  const openDonationsDialog = async (activity: ScheduledActivity) => {
    setSelectedActivity(activity);
    
    try {
      // Cargar TODAS las donaciones de esta actividad (con y sin student_id)
      const { data: allDonationsData, error: donationsError } = await supabase
        .from("activity_donations")
        .select("*")
        .eq("scheduled_activity_id", activity.id)
        .not("student_id", "is", null); // Donaciones ya asignadas

      if (donationsError) throw donationsError;

      // Cargar exclusiones de esta actividad programada
      const { data: scheduledExclusionsData } = await supabase
        .from("scheduled_activity_exclusions")
        .select("student_id")
        .eq("scheduled_activity_id", activity.id);
      
      // También cargar exclusiones de la actividad base si existe
      let baseExclusionsData: { student_id: number }[] = [];
      if (activity.activity_id) {
        const { data } = await supabase
          .from("activity_exclusions")
          .select("student_id")
          .eq("activity_id", activity.activity_id);
        baseExclusionsData = data || [];
      }
      
      // Combinar exclusiones
      const excludedStudentIds = new Set([
        ...(scheduledExclusionsData?.map(e => e.student_id) || []),
        ...baseExclusionsData.map(e => e.student_id)
      ]);

      // Cargar todos los estudiantes
      const { data: allStudentsData, error: studentsError } = await supabase
        .from("students")
        .select("*")
        .order("name");

      if (studentsError) throw studentsError;

      // Filtrar estudiantes excluidos
      const eligibleStudents = (allStudentsData || []).filter(s => !excludedStudentIds.has(s.id));

      // Crear un Set con los student_ids que YA tienen donaciones
      const studentsWithDonations = new Set(allDonationsData?.map(d => d.student_id) || []);

      // Crear entradas "sin donación" para estudiantes elegibles que no tienen ninguna
      const studentsWithoutDonations = eligibleStudents
        .filter(student => !studentsWithDonations.has(student.id))
        .map(student => ({
          id: `placeholder-${student.id}`,
          student_id: student.id,
          amount: '',
          donated_at: null,
          scheduled_activity_id: activity.id,
          name: '',
          unit: '',
          created_at: new Date().toISOString(),
          cantidad_original: null
        }));

      // Combinar donaciones existentes con placeholders
      const allDonations = [...(allDonationsData || []), ...studentsWithoutDonations];

      setDonations(allDonations);
      setDonationsDialogOpen(true);
    } catch (error: any) {
      toast.error("Error al cargar donaciones: " + error.message);
    }
  };

  const updateDonationAmount = (donationId: string, newAmount: string) => {
    setDonations(prev => prev.map(d => 
      d.id === donationId ? { ...d, amount: newAmount } : d
    ));
  };

  const saveDonation = async (donationId: string) => {
    try {
      const donation = donations.find(d => d.id === donationId);
      if (!donation) return;

      const { error } = await supabase
        .from("activity_donations")
        .update({ 
          amount: donation.amount,
          donated_at: donation.donated_at
        })
        .eq("id", donationId);

      if (error) throw error;
      
      loadCompletionRates();
      toast.success("Donación actualizada");
    } catch (error: any) {
      toast.error("Error al actualizar donación: " + error.message);
    }
  };

  const toggleDonationStatus = async (donationId: string, checked: boolean) => {
    const donatedAt = checked ? new Date().toISOString() : null;
    setDonations(prev => prev.map(d => 
      d.id === donationId ? { ...d, donated_at: donatedAt } : d
    ));
    
    try {
      const donation = donations.find(d => d.id === donationId);
      if (!donation) return;

      const { error } = await supabase
        .from("activity_donations")
        .update({ 
          amount: donation.amount,
          donated_at: donatedAt
        })
        .eq("id", donationId);

      if (error) throw error;
      
      loadCompletionRates();
      toast.success("Donación actualizada");
    } catch (error: any) {
      toast.error("Error al actualizar donación: " + error.message);
    }
  };

  const openDonationDrawer = (donation: Donation) => {
    setEditingDonation(donation);
    setDrawerOpen(true);
  };

  const closeDonationDrawer = () => {
    if (editingDonation) {
      saveDonation(editingDonation.id);
    }
    setDrawerOpen(false);
    setEditingDonation(null);
  };

  const openEditDonationsDialog = async (activity: ScheduledActivity) => {
    setEditingDonationsActivity(activity);
    
    try {
      // Cargar items pre-cargados de donaciones
      const { data: preloadedDonations } = await supabase
        .from("activity_donations")
        .select("name, amount, cantidad_original, unit")
        .eq("scheduled_activity_id", activity.id)
        .is("student_id", null);

      if (preloadedDonations && preloadedDonations.length > 0) {
        setDonationItems(preloadedDonations.map(d => ({
          name: d.name,
          amount: d.cantidad_original || d.amount,
          unit: d.unit || ''
        })));
        setExpandedDonationIndex(0);
      } else {
        setDonationItems([{ name: '', amount: '', unit: '' }]);
        setExpandedDonationIndex(0);
      }
      
      setEditDonationsDialogOpen(true);
    } catch (error: any) {
      toast.error("Error al cargar donaciones: " + error.message);
    }
  };

  // Funciones para editar/eliminar/asignar compromisos de donación de estudiantes
  const openEditStudentDonationDialog = (donation: Donation) => {
    setEditingStudentDonation(donation);
    setEditStudentDonationDialogOpen(true);
  };

  const handleUpdateStudentDonation = async () => {
    if (!editingStudentDonation) return;
    
    try {
      const { error } = await supabase
        .from("activity_donations")
        .update({
          name: editingStudentDonation.name,
          amount: editingStudentDonation.amount,
          unit: editingStudentDonation.unit
        })
        .eq("id", editingStudentDonation.id);

      if (error) throw error;

      setDonations(prev => prev.map(d => 
        d.id === editingStudentDonation.id 
          ? { ...d, name: editingStudentDonation.name, amount: editingStudentDonation.amount, unit: editingStudentDonation.unit }
          : d
      ));
      
      toast.success("Compromiso de donación actualizado");
      setEditStudentDonationDialogOpen(false);
      setEditingStudentDonation(null);
      loadCompletionRates();
    } catch (error: any) {
      toast.error("Error al actualizar: " + error.message);
    }
  };

  const handleDeleteStudentDonation = async (donationId: string) => {
    try {
      const { error } = await supabase
        .from("activity_donations")
        .delete()
        .eq("id", donationId);

      if (error) throw error;

      setDonations(prev => prev.filter(d => d.id !== donationId));
      toast.success("Compromiso de donación eliminado");
      loadCompletionRates();
    } catch (error: any) {
      toast.error("Error al eliminar: " + error.message);
    }
  };

  const openAssignDonationDialog = async (studentId: number) => {
    if (!selectedActivity) return;
    
    setAssignToStudentId(studentId);
    setAssignDonationForm({ name: '', amount: '', unit: '' });
    
    try {
      // Cargar items base disponibles para esta actividad
      const { data: baseItems } = await supabase
        .from("activity_donations")
        .select("name, unit, cantidad_original")
        .eq("scheduled_activity_id", selectedActivity.id)
        .is("student_id", null);

      setAvailableDonationItems(baseItems || []);
      setAssignDonationDialogOpen(true);
    } catch (error: any) {
      toast.error("Error al cargar items: " + error.message);
    }
  };

  const handleAssignDonation = async () => {
    if (!selectedActivity || !assignToStudentId || !assignDonationForm.name.trim() || !assignDonationForm.amount.trim()) {
      toast.error("Complete todos los campos requeridos");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("activity_donations")
        .insert({
          scheduled_activity_id: selectedActivity.id,
          student_id: assignToStudentId,
          name: assignDonationForm.name.trim(),
          amount: assignDonationForm.amount.trim(),
          unit: assignDonationForm.unit.trim(),
          donated_at: null
        })
        .select()
        .single();

      if (error) throw error;

      // Agregar a la lista de donaciones
      setDonations(prev => [...prev.filter(d => !d.id.startsWith('placeholder-' + assignToStudentId)), data as Donation]);
      
      toast.success("Donación asignada correctamente");
      setAssignDonationDialogOpen(false);
      setAssignToStudentId(null);
      setAssignDonationForm({ name: '', amount: '', unit: '' });
      loadCompletionRates();
    } catch (error: any) {
      toast.error("Error al asignar: " + error.message);
    }
  };

  const selectDonationItem = (itemName: string) => {
    const item = availableDonationItems.find(i => i.name === itemName);
    if (item) {
      setAssignDonationForm({
        name: item.name,
        amount: '',
        unit: item.unit
      });
    }
  };

  const saveDonationsOnly = async () => {
    if (!editingDonationsActivity) return;

    try {
      // Eliminar items pre-cargados existentes
      await supabase
        .from("activity_donations")
        .delete()
        .eq("scheduled_activity_id", editingDonationsActivity.id)
        .is("student_id", null);

      // Insertar nuevos items
    const donationsToInsert = donationItems
      .filter(item => item.name.trim() && item.amount.trim())
      .map(item => ({
        scheduled_activity_id: editingDonationsActivity.id,
        name: item.name.trim(),
        amount: item.amount.trim(), // Cantidad disponible actual
        cantidad_original: item.amount.trim(), // Cantidad original
        unit: item.unit.trim(),
        student_id: null,
        donated_at: null
      }));

      if (donationsToInsert.length > 0) {
        const { error } = await supabase
          .from("activity_donations")
          .insert(donationsToInsert);

        if (error) throw error;
      }

      toast.success("Donaciones actualizadas exitosamente");
      setEditDonationsDialogOpen(false);
      setEditingDonationsActivity(null);
      fetchActivities();
    } catch (error: any) {
      toast.error("Error al guardar donaciones: " + error.message);
    }
  };

  const exportPendingDonationsPDF = () => {
    if (!selectedActivity || donations.length === 0) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    
    // Título
    doc.setFontSize(16);
    doc.text("Informe de Donaciones Pendientes", pageWidth / 2, 20, { align: "center" });
    
    // Información de la actividad
    doc.setFontSize(12);
    doc.text(`Actividad: ${selectedActivity.name}`, 20, 35);
    doc.text(`Fecha: ${format(parseISO(selectedActivity.scheduled_date), "dd 'de' MMMM 'de' yyyy", { locale: es })}`, 20, 45);
    
    // Donaciones pendientes
    const pendingDonations = donations.filter(d => !d.donated_at);
    doc.setFontSize(10);
    doc.text(`Total Pendientes: ${pendingDonations.length} de ${donations.length}`, 20, 55);
    
    let yPos = 70;
    doc.setFontSize(9);
    
    pendingDonations.forEach((donation, index) => {
      const student = students.find(s => s.id === donation.student_id);
      if (student) {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
        
        doc.text(`${index + 1}. ${student.name}`, 20, yPos);
        doc.text(`Donación: ${donation.amount || "Sin especificar"}`, 120, yPos);
        yPos += 10;
      }
    });
    
    // Footer
    const today = format(new Date(), "dd/MM/yyyy HH:mm");
    doc.setFontSize(8);
    doc.text(`Generado: ${today}`, 20, doc.internal.pageSize.height - 10);
    
    doc.save(`donaciones-pendientes-${selectedActivity.name.replace(/\s+/g, '-')}.pdf`);
    toast.success("PDF exportado correctamente");
  };

  const exportCompletionStatusPDF = async (activity: ScheduledActivity) => {
    try {
      const doc = new jsPDF();
      
      // Cargar imágenes
      const [logoImg, firmaImg] = await Promise.all([
        new Promise<HTMLImageElement>((resolve) => {
          const img = new Image();
          img.src = logoImage;
          img.onload = () => resolve(img);
        }),
        new Promise<HTMLImageElement>((resolve) => {
          const img = new Image();
          img.src = firmaImage;
          img.onload = () => resolve(img);
        })
      ]);

      // Header background
      doc.setFillColor(240, 245, 250);
      doc.rect(0, 0, 210, 36, 'F');
      
      // Logo
      doc.addImage(logoImg, 'PNG', 15, 12, 22, 22);

      // Title
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 58, 138);
      doc.text("INFORME DE ESTADO DE CUMPLIMIENTO", 105, 18, { align: "center" });
      
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      doc.text("Pre Kinder B - Colegio Santa Cruz", 105, 24, { align: "center" });
      doc.text(`Fecha: ${new Date().toLocaleDateString("es-CL")}`, 105, 28, { align: "center" });

      // Separator line
      doc.setDrawColor(59, 130, 246);
      doc.setLineWidth(0.5);
      doc.line(15, 34, 195, 34);

      let yPos = 45;

      // Información de la actividad
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(51, 65, 85);
      doc.text(`Actividad: ${activity.name}`, 15, yPos);
      yPos += 6;

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      doc.text(`Fecha Programada: ${format(parseISO(activity.scheduled_date), "dd 'de' MMMM 'de' yyyy", { locale: es })}`, 15, yPos);
      yPos += 5;
      
      // Tipo de actividad adaptativo
      let typeText = "";
      if (activity.is_with_donations && activity.is_with_fee) {
        typeText = `Donaciones + Cuota: $${activity.fee_amount || 0}`;
      } else if (activity.is_with_donations) {
        typeText = "Donaciones";
      } else if (activity.is_with_fee) {
        typeText = `Cuota: $${activity.fee_amount || 0}`;
      }
      doc.text(`Tipo: ${typeText}`, 15, yPos);
      yPos += 10;

      // Obtener exclusiones de actividades base
      let baseExclusionsData: { student_id: number }[] = [];
      if (activity.activity_id) {
        const { data } = await supabase
          .from("activity_exclusions")
          .select("student_id")
          .eq("activity_id", activity.activity_id);
        baseExclusionsData = data || [];
      }
      
      // Obtener exclusiones de actividades programadas
      const { data: scheduledExclusionsData } = await supabase
        .from("scheduled_activity_exclusions")
        .select("student_id")
        .eq("scheduled_activity_id", activity.id);
      
      // Combinar ambas exclusiones
      const excludedStudentIds = new Set([
        ...baseExclusionsData.map(e => e.student_id),
        ...(scheduledExclusionsData?.map(e => e.student_id) || [])
      ]);
      
      // Filtrar solo estudiantes no excluidos
      const eligibleStudents = students.filter(s => !excludedStudentIds.has(s.id));

      let completedList: { student: Student; status: string; detail: string }[] = [];
      let pendingList: { student: Student; status: string; detail: string }[] = [];

      if (activity.is_with_donations && activity.is_with_fee) {
        // CASO 1: Actividad con AMBOS (Donaciones Y Cuotas)
        const [donationsResult, paymentsResult] = await Promise.all([
          supabase
            .from("activity_donations")
            .select("*")
            .eq("scheduled_activity_id", activity.id),
          supabase
            .from("payments")
            .select("student_id, amount")
            .eq("activity_id", activity.activity_id)
        ]);

        if (donationsResult.error) throw donationsResult.error;
        if (paymentsResult.error) throw paymentsResult.error;

        const donationsData = donationsResult.data;
        const paymentsData = paymentsResult.data;
        const paidStudentIds = new Set(paymentsData?.map(p => p.student_id) || []);

        eligibleStudents.forEach(student => {
          const donation = donationsData?.find(d => d.student_id === student.id);
          const hasDonation = donation?.donated_at;
          const hasPaid = paidStudentIds.has(student.id);
          const payment = paymentsData?.find(p => p.student_id === student.id);

          if (hasDonation && hasPaid) {
            completedList.push({
              student,
              status: "✓",
              detail: `${donation.name} - ${donation.amount} ${donation.unit} | $${Number(payment?.amount || 0).toLocaleString("es-CL")}`
            });
          } else {
            const donationDetail = hasDonation 
              ? `${donation.name} - ${donation.amount} ${donation.unit} ✓` 
              : (donation ? `${donation.name} - Pendiente` : "Sin donación");
            const feeDetail = hasPaid 
              ? `$${Number(payment?.amount || 0).toLocaleString("es-CL")} ✓` 
              : `$${Number(activity.fee_amount || 0).toLocaleString("es-CL")} ✗`;
            
            pendingList.push({
              student,
              status: "✗",
              detail: `${donationDetail} | ${feeDetail}`
            });
          }
        });

      } else if (activity.is_with_donations) {
        // CASO 2: Solo DONACIONES
        const { data: donationsData, error } = await supabase
          .from("activity_donations")
          .select("*")
          .eq("scheduled_activity_id", activity.id);

        if (error) throw error;

        eligibleStudents.forEach(student => {
          const donation = donationsData?.find(d => d.student_id === student.id);
          if (donation?.donated_at) {
            completedList.push({
              student,
              status: "✓",
              detail: `${donation.name} - ${donation.amount} ${donation.unit}`
            });
          } else {
            pendingList.push({
              student,
              status: "✗",
              detail: donation ? `${donation.name} - Pendiente` : "Sin donación"
            });
          }
        });

      } else if (activity.is_with_fee && activity.activity_id) {
        // CASO 3: Solo CUOTAS
        const { data: paymentsData, error } = await supabase
          .from("payments")
          .select("student_id, amount")
          .eq("activity_id", activity.activity_id);

        if (error) throw error;

        const paidStudentIds = new Set(paymentsData?.map(p => p.student_id) || []);

        eligibleStudents.forEach(student => {
          if (paidStudentIds.has(student.id)) {
            const payment = paymentsData?.find(p => p.student_id === student.id);
            completedList.push({
              student,
              status: "✓",
              detail: `$${Number(payment?.amount || 0).toLocaleString("es-CL")}`
            });
          } else {
            pendingList.push({
              student,
              status: "✗",
              detail: `$${Number(activity.fee_amount || 0).toLocaleString("es-CL")}`
            });
          }
        });
      }

      // Resumen
      const totalStudents = eligibleStudents.length;
      const completedCount = completedList.length;
      const completionPercentage = totalStudents > 0 ? Math.round((completedCount / totalStudents) * 100) : 0;

      doc.setFillColor(237, 242, 247);
      doc.rect(15, yPos - 3, 180, 8, 'F');
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 58, 138);
      doc.text(`Total: ${totalStudents}`, 20, yPos + 2);
      doc.text(`Cumplieron: ${completedCount} (${completionPercentage}%)`, 70, yPos + 2);
      doc.setTextColor(220, 38, 38);
      doc.text(`Pendientes: ${pendingList.length} (${100 - completionPercentage}%)`, 140, yPos + 2);
      yPos += 12;

      // Tabla de estudiantes que cumplieron
      if (completedList.length > 0) {
        doc.setFillColor(237, 242, 247);
        doc.rect(15, yPos - 3, 180, 8, 'F');
        
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 58, 138);
        doc.text("ESTUDIANTES QUE CUMPLIERON", 20, yPos + 2);
        yPos += 10;

        // Table header
        doc.setFillColor(237, 242, 247);
        doc.rect(15, yPos - 3, 180, 8, 'F');
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 58, 138);
        doc.text("N°", 20, yPos + 2);
        doc.text("Estudiante", 35, yPos + 2);
        doc.text("Detalle", 170, yPos + 2, { align: "right" });
        yPos += 10;

        doc.setFont("helvetica", "normal");
        doc.setTextColor(51, 65, 85);
        doc.setFontSize(8);

        completedList.forEach((item, index) => {
          if (yPos > 270) {
            doc.addPage();
            yPos = 20;
          }

          // Alternating background
          if (index % 2 === 0) {
            doc.setFillColor(249, 250, 251);
            doc.rect(15, yPos - 3, 180, 7, 'F');
          }

          doc.text(`${index + 1}`, 20, yPos + 1);
          const truncatedName = item.student.name.length > 55 
            ? item.student.name.substring(0, 52) + "..."
            : item.student.name;
          doc.text(truncatedName, 35, yPos + 1);
          
          // Si la actividad tiene donaciones, mostrar nombre en verde
          if (activity.is_with_donations) {
            const detailParts = item.detail.split(' | ');
            doc.setTextColor(34, 197, 94);
            doc.text(detailParts[0], 190, yPos + 1, { align: "right" });
            
            // Si también tiene cuota, mostrar debajo
            if (activity.is_with_fee && detailParts.length > 1) {
              yPos += 4;
              doc.text(detailParts[1], 190, yPos + 1, { align: "right" });
              yPos += 2;
            }
          } else {
            // Solo cuota, mostrar en verde
            doc.setTextColor(34, 197, 94);
            doc.text(item.detail, 190, yPos + 1, { align: "right" });
          }
          
          doc.setTextColor(51, 65, 85);
          yPos += 6;
        });
        yPos += 10;
      }

      // Tabla de estudiantes pendientes
      if (pendingList.length > 0) {
        if (yPos > 250) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFillColor(254, 242, 242);
        doc.rect(15, yPos - 3, 180, 8, 'F');
        
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(220, 38, 38);
        doc.text("ESTUDIANTES PENDIENTES", 20, yPos + 2);
        yPos += 10;

        // Table header
        doc.setFillColor(237, 242, 247);
        doc.rect(15, yPos - 3, 180, 8, 'F');
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 58, 138);
        doc.text("N°", 20, yPos + 2);
        doc.text("Estudiante", 35, yPos + 2);
        doc.text("Monto/Detalle", 170, yPos + 2, { align: "right" });
        yPos += 10;

        doc.setFont("helvetica", "normal");
        doc.setTextColor(51, 65, 85);
        doc.setFontSize(8);

        pendingList.forEach((item, index) => {
          if (yPos > 270) {
            doc.addPage();
            yPos = 20;
          }

          // Alternating background
          if (index % 2 === 0) {
            doc.setFillColor(249, 250, 251);
            doc.rect(15, yPos - 3, 180, 7, 'F');
          }

          doc.text(`${index + 1}`, 20, yPos + 1);
          const truncatedName = item.student.name.length > 55 
            ? item.student.name.substring(0, 52) + "..."
            : item.student.name;
          doc.text(truncatedName, 35, yPos + 1);
          
          // Todo en rojo para pendientes
          doc.setTextColor(220, 38, 38);
          
          if (activity.is_with_donations) {
            const detailParts = item.detail.split(' | ');
            doc.text(detailParts[0], 190, yPos + 1, { align: "right" });
            
            // Si también tiene cuota, mostrar debajo
            if (activity.is_with_fee && detailParts.length > 1) {
              yPos += 4;
              doc.text(detailParts[1], 190, yPos + 1, { align: "right" });
              yPos += 2;
            }
          } else {
            // Solo cuota
            doc.text(item.detail, 190, yPos + 1, { align: "right" });
          }
          
          doc.setTextColor(51, 65, 85);
          yPos += 6;
        });
      }

      // Signature
      const pageHeight = doc.internal.pageSize.getHeight();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      if (yPos > pageHeight - 50) {
        doc.addPage();
        yPos = 20;
      }

      const signatureYPos = pageHeight - 45;
      doc.setDrawColor(59, 130, 246);
      doc.setLineWidth(0.5);
      doc.line(15, signatureYPos, 195, signatureYPos);
      doc.addImage(firmaImg, 'PNG', pageWidth - 62, signatureYPos + 5, 47, 35);

      doc.save(`Estado_Cumplimiento_${activity.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success("PDF exportado correctamente");
    } catch (error: any) {
      toast.error("Error al exportar PDF: " + error.message);
    }
  };

  const handleDownloadDonationsReport = async (activity: ScheduledActivity) => {
    if (!activity.is_with_donations) {
      toast.error("Esta actividad no tiene donaciones");
      return;
    }

    try {
      // Obtener todas las donaciones de esta actividad
      const { data: donationsData, error } = await supabase
        .from("activity_donations")
        .select("*")
        .eq("scheduled_activity_id", activity.id)
        .order("name", { ascending: true });

      if (error) throw error;

      const doc = new jsPDF();
      
      // Logo y título
      doc.addImage(logoImage, "PNG", 15, 10, 30, 15);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(37, 99, 235);
      doc.text("REPORTE DE DONACIONES", 105, 18, { align: "center" });

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      doc.text("Pre Kinder B - Colegio Santa Cruz", 105, 24, { align: "center" });
      doc.text(`Fecha: ${new Date().toLocaleDateString("es-CL")}`, 105, 28, { align: "center" });

      doc.setDrawColor(59, 130, 246);
      doc.setLineWidth(0.5);
      doc.line(15, 34, 195, 34);

      let yPos = 45;

      // Información de la actividad
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(51, 65, 85);
      doc.text(`Actividad: ${activity.name}`, 15, yPos);
      yPos += 6;

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      doc.text(`Fecha: ${format(parseISO(activity.scheduled_date), "dd 'de' MMMM 'de' yyyy", { locale: es })}`, 15, yPos);
      yPos += 10;

      // Obtener la cantidad original de cada ítem - PRIORIDAD registros base (student_id null)
      const originalAmounts = donationsData?.reduce((acc, donation) => {
        const key = `${donation.name}|${donation.unit}`;
        if (donation.student_id === null) {
          // 1) Si hay cantidad_original, usarla
          if (donation.cantidad_original) {
            acc[key] = donation.cantidad_original;
          } else if (!acc[key] && donation.amount) {
            // 2) Fallback para actividades antiguas: usar amount del registro base
            acc[key] = donation.amount;
          }
        } else if (!acc[key] && donation.cantidad_original) {
          // 3) Último recurso: cualquier registro con cantidad_original
          acc[key] = donation.cantidad_original;
        }
        return acc;
      }, {} as Record<string, string>);

      // Agrupar donaciones por ítem
      const itemGroups = donationsData?.reduce((acc, donation) => {
        const key = `${donation.name}|${donation.unit}`;
        if (!acc[key]) {
          acc[key] = {
            name: donation.name,
            unit: donation.unit,
            originalAmount: originalAmounts?.[key] || "0",
            committed: [],
            received: []
          };
        }
        
        if (donation.student_id) {
          // Buscar el nombre del estudiante
          const student = students.find(s => s.id === donation.student_id);
          const donationInfo = {
            studentName: student?.name || "Desconocido",
            amount: donation.amount,
            donated_at: donation.donated_at
          };
          
          if (donation.donated_at) {
            acc[key].received.push(donationInfo);
          } else {
            acc[key].committed.push(donationInfo);
          }
        }
        
        return acc;
      }, {} as Record<string, {
        name: string;
        unit: string;
        originalAmount: string;
        committed: { studentName: string; amount: string; donated_at: string | null }[];
        received: { studentName: string; amount: string; donated_at: string | null }[];
      }>);

      // Mostrar cada ítem de donación
      const items = Object.values(itemGroups || {});
      
      if (items.length === 0) {
        doc.setFontSize(10);
        doc.setTextColor(107, 114, 128);
        doc.text("No hay donaciones registradas para esta actividad", 15, yPos);
      } else {
        items.forEach((item, index) => {
          if (yPos > 250) {
            doc.addPage();
            yPos = 20;
          }

          // Nombre del ítem
          doc.setFontSize(10);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(37, 99, 235);
          doc.text(`${index + 1}. ${item.name}`, 15, yPos);
          yPos += 5;

          // Cantidad solicitada
          doc.setFontSize(9);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(71, 85, 105);
          doc.text(`Cantidad solicitada: ${item.originalAmount} ${item.unit}`, 20, yPos);
          yPos += 5;

          // Totales comprometido y recibido
          const totalCommittedPending = item.committed.reduce((sum, c) => sum + parseFloat(c.amount || "0"), 0);
          const totalReceived = item.received.reduce((sum, r) => sum + parseFloat(r.amount || "0"), 0);
          const totalCommittedOverall = totalCommittedPending + totalReceived;
          
          doc.text(`Comprometido: ${totalCommittedOverall} ${item.unit}`, 20, yPos);
          yPos += 4;
          doc.text(`Recibido: ${totalReceived} ${item.unit}`, 20, yPos);
          yPos += 6;

          // Donaciones recibidas
          if (item.received.length > 0) {
            doc.setFont("helvetica", "bold");
            doc.setTextColor(34, 197, 94);
            doc.text("Recibidas:", 25, yPos);
            yPos += 4;
            
            doc.setFont("helvetica", "normal");
            doc.setTextColor(71, 85, 105);
            item.received.forEach(r => {
              if (yPos > 270) {
                doc.addPage();
                yPos = 20;
              }
              doc.text(`• ${r.studentName}: ${r.amount} ${item.unit} (Cumplido)`, 27, yPos);
              yPos += 4;
            });
            yPos += 2;
          }

          // Donaciones comprometidas (pendientes de recibir)
          if (item.committed.length > 0) {
            doc.setFont("helvetica", "bold");
            doc.setTextColor(234, 179, 8);
            doc.text("Comprometidas:", 25, yPos);
            yPos += 4;
            
            doc.setFont("helvetica", "normal");
            doc.setTextColor(71, 85, 105);
            item.committed.forEach(c => {
              if (yPos > 270) {
                doc.addPage();
                yPos = 20;
              }
              doc.text(`• ${c.studentName}: ${c.amount} ${item.unit} (Pendiente)`, 27, yPos);
              yPos += 4;
            });
            yPos += 2;
          }

          yPos += 4;
        });
        
        // Sección de items faltantes
        yPos += 5;
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(220, 38, 38);
        doc.text("ITEMS FALTANTES", 15, yPos);
        yPos += 6;
        
        const incompleteItems = items.filter(item => {
          const totalCommitted = item.committed.reduce((sum, c) => sum + parseFloat(c.amount || "0"), 0);
          const totalReceived = item.received.reduce((sum, r) => sum + parseFloat(r.amount || "0"), 0);
          const original = parseFloat(item.originalAmount || "0");
          return (totalCommitted + totalReceived) < original;
        });
        
        if (incompleteItems.length === 0) {
          doc.setFontSize(9);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(34, 197, 94);
          doc.text("✓ Todas las donaciones se han completado", 15, yPos);
          yPos += 6;
        } else {
          doc.setFontSize(9);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(71, 85, 105);
          
          incompleteItems.forEach(item => {
            if (yPos > 270) {
              doc.addPage();
              yPos = 20;
            }
            
            const totalCommitted = item.committed.reduce((sum, c) => sum + parseFloat(c.amount || "0"), 0);
            const totalReceived = item.received.reduce((sum, r) => sum + parseFloat(r.amount || "0"), 0);
            const original = parseFloat(item.originalAmount || "0");
            const missing = original - (totalCommitted + totalReceived);
            
            doc.text(`• ${item.name}: Faltan ${missing} ${item.unit} de ${original} ${item.unit}`, 20, yPos);
            yPos += 4;
          });
          yPos += 6;
        }
        
        // Sección de estudiantes que no donaron
        if (yPos > 250) {
          doc.addPage();
          yPos = 20;
        }
        
        yPos += 5;
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(220, 38, 38);
        doc.text("ESTUDIANTES SIN DONACIONES", 15, yPos);
        yPos += 6;
        
        // Obtener exclusiones de esta actividad programada
        const { data: scheduledExclusionsForReport } = await supabase
          .from("scheduled_activity_exclusions")
          .select("student_id")
          .eq("scheduled_activity_id", activity.id);
        
        // También cargar exclusiones de la actividad base si existe
        let baseExclusionsForReport: { student_id: number }[] = [];
        if (activity.activity_id) {
          const { data } = await supabase
            .from("activity_exclusions")
            .select("student_id")
            .eq("activity_id", activity.activity_id);
          baseExclusionsForReport = data || [];
        }
        
        // Combinar exclusiones
        const excludedStudentIdsForReport = new Set([
          ...(scheduledExclusionsForReport?.map(e => e.student_id) || []),
          ...baseExclusionsForReport.map(e => e.student_id)
        ]);
        
        // Obtener todos los estudiantes que han donado
        const studentsWhoDonated = new Set(
          donationsData?.filter(d => d.student_id).map(d => d.student_id) || []
        );
        
        // Filtrar estudiantes que no han donado Y no están excluidos
        const studentsWhoDidntDonate = students.filter(s => 
          !studentsWhoDonated.has(s.id) && !excludedStudentIdsForReport.has(s.id)
        );
        
        if (studentsWhoDidntDonate.length === 0) {
          doc.setFontSize(9);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(34, 197, 94);
          doc.text("✓ Todos los estudiantes han donado", 15, yPos);
          yPos += 6;
        } else {
          doc.setFontSize(9);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(71, 85, 105);
          
          studentsWhoDidntDonate.forEach(student => {
            if (yPos > 270) {
              doc.addPage();
              yPos = 20;
            }
            doc.text(`• ${student.name}`, 20, yPos);
            yPos += 4;
          });
          yPos += 6;
        }
      }

      // Firma
      if (yPos > 240) {
        doc.addPage();
        yPos = 20;
      }

      yPos += 10;
      doc.addImage(firmaImage, "PNG", 15, yPos, 40, 20);
      yPos += 25;
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      doc.text("Directiva Pre Kinder B", 15, yPos);

      // Guardar PDF
      doc.save(`Reporte_Donaciones_${activity.name.replace(/\s+/g, "_")}.pdf`);
      toast.success("Reporte de donaciones generado exitosamente");
    } catch (error) {
      console.error("Error al generar reporte de donaciones:", error);
      toast.error("Error al generar el reporte de donaciones");
    }
  };

  const getActivityStatus = (activity: ScheduledActivity) => {
    if (activity.completed) return { icon: CheckCircle, color: "text-green-500", label: "Completada" };
    
    const today = new Date();
    const activityDate = new Date(activity.scheduled_date);
    const daysUntil = Math.ceil((activityDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntil < 0) return { icon: AlertCircle, color: "text-red-500", label: "Vencida" };
    if (daysUntil <= 7) return { icon: Clock, color: "text-orange-500", label: `Próxima (${daysUntil}d)` };
    return { icon: Clock, color: "text-blue-500", label: "Pendiente" };
  };

  const completedActivities = activities.filter(a => a.completed);
  const pendingActivities = activities.filter(a => !a.completed);

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Calendar className="h-8 w-8" />
            Calendarización de Actividades
          </h1>
          <p className="text-muted-foreground mt-2">
            Gestiona y programa actividades escolares
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Actividad
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Agendar Nueva Actividad</DialogTitle>
              <DialogDescription>
                Complete los detalles de la actividad a programar
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Nombre de la Actividad</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="date">Fecha de Realización</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.scheduled_date}
                  onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                  required
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="management">Requiere Gestión</Label>
                <Switch
                  id="management"
                  checked={formData.requires_management}
                  onCheckedChange={(checked) => setFormData({ ...formData, requires_management: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="fee">Es con Cuota</Label>
                <Switch
                  id="fee"
                  checked={formData.is_with_fee}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_with_fee: checked })}
                />
              </div>

              {formData.is_with_fee && (
                <div>
                  <Label htmlFor="amount">Valor de la Cuota</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={formData.fee_amount}
                    onChange={(e) => setFormData({ ...formData, fee_amount: e.target.value })}
                    required
                  />
                </div>
              )}

              <div className="flex items-center justify-between">
                <Label htmlFor="donations">Es con Donaciones</Label>
                <Switch
                  id="donations"
                  checked={formData.is_with_donations}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_with_donations: checked })}
                />
              </div>

              {formData.is_with_donations && (
                <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-semibold">Pre-cargar Donaciones</Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Agregue los items que los apoderados podrán seleccionar
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={addDonationItem}
                      className="shrink-0"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Agregar
                    </Button>
                  </div>
                  
                  <ScrollArea className="max-h-[400px]">
                    <div className="space-y-2 pr-4">
                      {donationItems.map((item, index) => {
                        const isLast = index === donationItems.length - 1;
                        return (
                          <div key={index} ref={isLast ? formDonationScrollRef : null}>
                            <Collapsible
                              key={index}
                              open={expandedDonationIndex === index}
                              onOpenChange={(open) => {
                                if (open) setExpandedDonationIndex(index);
                              }}
                            >
                              <Card className={cn(
                                "overflow-hidden transition-all",
                                expandedDonationIndex === index ? "border-primary" : ""
                              )}>
                                <CollapsibleTrigger className="w-full">
                                  <div className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
                                    <div className="flex items-center gap-2 flex-1 text-left">
                                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                                        {index + 1}
                                      </div>
                                      <div className="flex-1">
                                        {item.name ? (
                                          <div className="flex items-center gap-2">
                                            <span className="font-medium text-sm">{item.name}</span>
                                            {item.amount && item.unit && (
                                              <Badge variant="secondary" className="text-xs">
                                                {item.amount} {item.unit}
                                              </Badge>
                                            )}
                                          </div>
                                        ) : (
                                          <span className="text-sm text-muted-foreground">Nueva donación</span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {donationItems.length > 1 && (
                                        <Button
                                          type="button"
                                          size="icon"
                                          variant="ghost"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            removeDonationItem(index);
                                          }}
                                          className="h-8 w-8"
                                        >
                                          <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                      )}
                                      {expandedDonationIndex === index ? (
                                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                      ) : (
                                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                      )}
                                    </div>
                                  </div>
                                </CollapsibleTrigger>
                                
                                <CollapsibleContent>
                                  <div className="p-3 pt-0 space-y-3 border-t">
                                    <div className="space-y-1">
                                      <Label className="text-xs text-muted-foreground">Nombre del Item</Label>
                                      <Input
                                        placeholder="Ej: Queso, Fruta, etc."
                                        value={item.name}
                                        onChange={(e) => updateDonationItem(index, 'name', e.target.value)}
                                      />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                      <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Cantidad</Label>
                                        <Input
                                          placeholder="Ej: 2, 500"
                                          value={item.amount}
                                          onChange={(e) => updateDonationItem(index, 'amount', e.target.value)}
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Unidad</Label>
                                        <Select
                                          value={item.unit}
                                          onValueChange={(value) => updateDonationItem(index, 'unit', value)}
                                        >
                                          <SelectTrigger>
                                            <SelectValue placeholder="Seleccione" />
                                          </SelectTrigger>
                                          <SelectContent className="bg-background z-50">
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
                                </CollapsibleContent>
                              </Card>
                            </Collapsible>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">Agendar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-center py-8">Cargando actividades...</div>
      ) : (
        <>
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Actividades Pendientes</h2>
            {pendingActivities.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No hay actividades pendientes
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {pendingActivities.map((activity) => {
                  const status = getActivityStatus(activity);
                  const StatusIcon = status.icon;
                  
                  return (
                     <Card key={activity.id} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex flex-col gap-3">
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                            <div className="flex-1">
                              <CardTitle className="text-base sm:text-lg">{activity.name}</CardTitle>
                              <CardDescription className="mt-1 text-sm">
                                {format(parseISO(activity.scheduled_date), "PPP", { locale: es })}
                              </CardDescription>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className={status.color}>
                                <StatusIcon className="h-3 w-3 mr-1" />
                                <span className="text-xs">{status.label}</span>
                              </Badge>
                              {activity.requires_management && (
                                <Badge variant="secondary" className="text-xs">Gestión</Badge>
                              )}
                              {activity.is_with_fee && (
                                <Badge variant="secondary" className="text-xs">
                                  <DollarSign className="h-3 w-3 mr-1" />
                                  ${activity.fee_amount}
                                </Badge>
                              )}
                              {activity.is_with_donations && (
                                <Badge variant="secondary" className="text-xs">
                                  <Gift className="h-3 w-3 mr-1" />
                                  Donaciones
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                       </CardHeader>
                       <CardContent className="pt-0 space-y-3">
                         {(activity.is_with_donations || activity.is_with_fee) && activityCompletionRates[activity.id] && (
                           <div className="space-y-2">
                             <div className="flex justify-between items-center text-sm">
                               <span className="text-muted-foreground">
                                 Nivel de cumplimiento
                               </span>
                               <span className="font-medium">
                                 {activityCompletionRates[activity.id].completed}/{activityCompletionRates[activity.id].total}
                                 {" "}
                                 ({Math.round((activityCompletionRates[activity.id].completed / activityCompletionRates[activity.id].total) * 100)}%)
                               </span>
                             </div>
                             <Progress 
                               value={(activityCompletionRates[activity.id].completed / activityCompletionRates[activity.id].total) * 100} 
                               className="h-2"
                             />
                           </div>
                         )}
                          <div className="flex gap-2 flex-wrap">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => toggleCompleted(activity)}
                              className="text-xs sm:text-sm"
                              disabled={activity.completed && userRole !== 'master'}
                              title={activity.completed && userRole !== 'master' ? "Solo el master puede reabrir actividades cerradas" : ""}
                            >
                              {activity.completed ? (
                                <>
                                  <RotateCcw className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                                  <span className="hidden sm:inline">Reabrir</span>
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                                  <span className="hidden sm:inline">Cerrar</span>
                                </>
                              )}
                            </Button>
                            {activity.is_with_donations && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openEditDonationsDialog(activity)}
                                  className="text-xs sm:text-sm"
                                >
                                  <ListPlus className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                                  <span className="hidden sm:inline">Editar Donaciones</span>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openDonationsDialog(activity)}
                                  className="text-xs sm:text-sm"
                                >
                                  <Gift className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                                  <span className="hidden sm:inline">Ver Donaciones</span>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDownloadDonationsReport(activity)}
                                  className="text-xs sm:text-sm"
                                >
                                  <ClipboardList className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                                  <span className="hidden sm:inline">Reporte Donaciones</span>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                onClick={async () => {
                                     const link = `${window.location.origin}/donaciones/${activity.id}`;
                                     
                                     if (navigator.share) {
                                       try {
                                         await navigator.share({
                                          title: 'Link de Donaciones',
                                          text: `Selecciona tu donación para: ${activity.name}`,
                                          url: link,
                                        });
                                        toast.success('Link compartido exitosamente');
                                      } catch (error) {
                                        if ((error as Error).name !== 'AbortError') {
                                          navigator.clipboard.writeText(link);
                                          toast.success("Link copiado al portapapeles");
                                        }
                                      }
                                    } else {
                                      navigator.clipboard.writeText(link);
                                      toast.success("Link copiado al portapapeles");
                                    }
                                  }}
                                  className="text-xs sm:text-sm"
                                >
                                  <Share2 className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                                  <span className="hidden sm:inline">Compartir</span>
                                </Button>
                              </>
                            )}
                            {(activity.is_with_donations || activity.is_with_fee) && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => exportCompletionStatusPDF(activity)}
                                className="text-xs sm:text-sm"
                              >
                                <FileText className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                                <span className="hidden sm:inline">Exportar Estado</span>
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={async () => {
                                setEditingActivity(activity);
                                setFormData({
                                  name: activity.name,
                                  scheduled_date: activity.scheduled_date,
                                  requires_management: activity.requires_management,
                                  is_with_fee: activity.is_with_fee,
                                  fee_amount: activity.fee_amount?.toString() || "",
                                  is_with_donations: activity.is_with_donations,
                                });

                                // Cargar items de donación si aplica
                                if (activity.is_with_donations) {
                                  const { data: existingItems } = await supabase
                                    .from("activity_donations")
                                    .select("name, amount, unit")
                                    .eq("scheduled_activity_id", activity.id)
                                    .is("student_id", null);

                                  if (existingItems && existingItems.length > 0) {
                                    setDonationItems(existingItems.map(d => ({
                                      name: d.name,
                                      amount: d.amount,
                                      unit: d.unit || ''
                                    })));
                                  } else {
                                    setDonationItems([{ name: '', amount: '', unit: '' }]);
                                  }
                                }

                                setDialogOpen(true);
                              }}
                              className="text-xs sm:text-sm"
                            >
                              <Pencil className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                              <span className="hidden sm:inline">Editar</span>
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="ghost" className="text-xs sm:text-sm">
                                  <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                                  <span className="hidden sm:inline">Eliminar</span>
                                </Button>
                              </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Eliminar actividad?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta acción no se puede deshacer. Se eliminará permanentemente la actividad "{activity.name}".
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={async () => {
                                  try {
                                    const { error } = await supabase
                                      .from("scheduled_activities")
                                      .delete()
                                      .eq("id", activity.id);

                                    if (error) throw error;
                                    toast.success("Actividad eliminada exitosamente");
                                    fetchActivities();
                                  } catch (error: any) {
                                    toast.error("Error al eliminar actividad: " + error.message);
                                  }
                                }}>
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
            )}
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Actividades Completadas</h2>
            {completedActivities.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No hay actividades completadas
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {completedActivities.map((activity) => (
                  <Card key={activity.id} className="opacity-75">
                    <CardHeader className="pb-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex-1">
                          <CardTitle className="text-lg line-through">{activity.name}</CardTitle>
                          <CardDescription className="mt-1">
                            {format(parseISO(activity.scheduled_date), "PPP", { locale: es })}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-green-500 w-fit">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Completada
                          </Badge>
                          {userRole === 'master' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => toggleCompleted(activity)}
                              title="Reabrir actividad"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {isMobile ? (
        <Drawer open={donationsDialogOpen} onOpenChange={setDonationsDialogOpen}>
          <DrawerContent className="max-h-[85vh]">
            <DrawerHeader className="pb-3">
              <DrawerTitle>Donaciones - {selectedActivity?.name}</DrawerTitle>
              <DrawerDescription>
                Toca un alumno para registrar su donación
              </DrawerDescription>
            </DrawerHeader>
            <div className="flex justify-end mb-3 px-4">
              <Button onClick={exportPendingDonationsPDF} variant="outline" size="sm">
                <FileText className="h-4 w-4 mr-2" />
                Exportar Pendientes
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-20">
              <div className="space-y-2">
                {donations.map((donation) => {
                  const student = students.find(s => s.id === donation.student_id);
                  
                  return (
                    <Card 
                      key={donation.id} 
                      className="overflow-hidden"
                    >
                      <div className="flex items-center justify-between p-3">
                        <div 
                          className="flex-1 min-w-0 cursor-pointer"
                          onClick={() => donation.name ? openDonationDrawer(donation) : openAssignDonationDialog(donation.student_id)}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{student?.name}</span>
                            {donation.donated_at && (
                              <Badge variant="outline" className="text-green-500 shrink-0">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                ✓
                              </Badge>
                            )}
                          </div>
                          {donation.name ? (
                            <div className="text-sm text-muted-foreground mt-1">
                              {donation.name} - {donation.amount} {donation.unit}
                            </div>
                          ) : (
                            <div className="text-sm text-muted-foreground italic mt-1">
                              Sin registrar
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {donation.name ? (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => openEditStudentDonationDialog(donation)}
                              >
                                <Pencil className="h-4 w-4 text-muted-foreground" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8"
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>¿Eliminar compromiso?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Se eliminará el compromiso de donación de {student?.name}. 
                                      Esta acción no se puede deshacer.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteStudentDonation(donation.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Eliminar
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openAssignDonationDialog(donation.student_id)}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Asignar
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={donationsDialogOpen} onOpenChange={setDonationsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Donaciones - {selectedActivity?.name}</DialogTitle>
              <DialogDescription>
                Registre las donaciones de cada estudiante
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end mb-4">
              <Button onClick={exportPendingDonationsPDF} variant="outline" size="sm">
                <FileText className="h-4 w-4 mr-2" />
                Exportar Pendientes a PDF
              </Button>
            </div>
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-2">
                {/* Agrupar donaciones por estudiante */}
                {(() => {
                  const donationsByStudent = donations.reduce((acc, donation) => {
                    if (!acc[donation.student_id]) {
                      acc[donation.student_id] = [];
                    }
                    acc[donation.student_id].push(donation);
                    return acc;
                  }, {} as Record<number, typeof donations>);

                  return Object.entries(donationsByStudent).map(([studentId, studentDonations]) => {
                    const student = students.find(s => s.id === parseInt(studentId));
                    const isExpanded = expandedStudents.has(parseInt(studentId));
                    const allDonated = studentDonations.every(d => d.donated_at);
                    const hasDonations = studentDonations.some(d => d.name);
                    
                    return (
                      <Card key={studentId} className="overflow-hidden">
                        <Collapsible
                          open={isExpanded}
                          onOpenChange={(open) => {
                            const newExpanded = new Set(expandedStudents);
                            if (open) {
                              newExpanded.add(parseInt(studentId));
                            } else {
                              newExpanded.delete(parseInt(studentId));
                            }
                            setExpandedStudents(newExpanded);
                          }}
                        >
                          <CollapsibleTrigger asChild>
                            <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-accent/50 transition-colors">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span className="font-medium truncate">{student?.name}</span>
                                {allDonated && hasDonations && (
                                  <Badge variant="outline" className="text-green-500 shrink-0">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Completado
                                  </Badge>
                                )}
                                {!hasDonations && (
                                  <Badge variant="outline" className="text-amber-500 shrink-0">
                                    Sin donación
                                  </Badge>
                                )}
                              </div>
                              <ChevronDown className={cn(
                                "h-4 w-4 transition-transform shrink-0 ml-2",
                                isExpanded && "transform rotate-180"
                              )} />
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="p-3 pt-0 space-y-3 border-t">
                              {studentDonations.map((donation) => (
                                <div key={donation.id} className="space-y-2 pb-3 border-b last:border-b-0 last:pb-0">
                                  {donation.name ? (
                                    <>
                                      <div className="flex items-center justify-between">
                                        <div className="flex flex-col gap-1">
                                          <Label className="text-sm font-medium">{donation.name}</Label>
                                          <span className="text-xs text-muted-foreground">
                                            {donation.amount} {donation.unit}
                                          </span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-8 w-8"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              openEditStudentDonationDialog(donation);
                                            }}
                                            title="Editar compromiso"
                                          >
                                            <Pencil className="h-4 w-4 text-muted-foreground" />
                                          </Button>
                                          <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                              <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-8 w-8"
                                                onClick={(e) => e.stopPropagation()}
                                                title="Eliminar compromiso"
                                              >
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                              </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                              <AlertDialogHeader>
                                                <AlertDialogTitle>¿Eliminar compromiso?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                  Se eliminará el compromiso de donación de {students.find(s => s.id === donation.student_id)?.name}. 
                                                  Esta acción no se puede deshacer.
                                                </AlertDialogDescription>
                                              </AlertDialogHeader>
                                              <AlertDialogFooter>
                                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                <AlertDialogAction
                                                  onClick={() => handleDeleteStudentDonation(donation.id)}
                                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                >
                                                  Eliminar
                                                </AlertDialogAction>
                                              </AlertDialogFooter>
                                            </AlertDialogContent>
                                          </AlertDialog>
                                          <Checkbox
                                            id={`donated-${donation.id}`}
                                            checked={!!donation.donated_at}
                                            onCheckedChange={(checked) => {
                                              toggleDonationStatus(
                                                donation.id,
                                                checked as boolean
                                              );
                                            }}
                                          />
                                          <Label 
                                            htmlFor={`donated-${donation.id}`}
                                            className="text-sm font-normal cursor-pointer"
                                          >
                                            Donado
                                          </Label>
                                        </div>
                                      </div>
                                    </>
                                  ) : (
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm text-muted-foreground italic">
                                        Sin donación registrada
                                      </span>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openAssignDonationDialog(parseInt(studentId));
                                        }}
                                      >
                                        <Plus className="h-4 w-4 mr-1" />
                                        Asignar
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      </Card>
                    );
                  });
                })()}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}

      {/* Diálogo para editar solo donaciones */}
      <Dialog open={editDonationsDialogOpen} onOpenChange={setEditDonationsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 shrink-0">
            <DialogTitle>Editar Donaciones Pre-cargadas</DialogTitle>
            <DialogDescription>
              {editingDonationsActivity?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6">
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between sticky top-0 bg-background z-10 pb-2">
                <div>
                  <Label className="text-sm font-semibold">Items de Donación</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Agregue los items que los apoderados podrán seleccionar
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={addDonationItem}
                  className="shrink-0"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Agregar
                </Button>
              </div>
              
              <div className="space-y-2">
                {donationItems.map((item, index) => {
                  const isLast = index === donationItems.length - 1;
                  return (
                    <div key={index} ref={isLast ? donationScrollRef : null}>
                      <Collapsible
                        key={index}
                        open={expandedDonationIndex === index}
                        onOpenChange={(open) => {
                          if (open) setExpandedDonationIndex(index);
                        }}
                      >
                        <Card className={cn(
                          "overflow-hidden transition-all",
                          expandedDonationIndex === index ? "border-primary" : ""
                        )}>
                          <CollapsibleTrigger className="w-full">
                            <div className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
                              <div className="flex items-center gap-2 flex-1 text-left">
                                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                                  {index + 1}
                                </div>
                                {item.name ? (
                                  <span className="text-sm font-medium">
                                    {item.name} - {item.amount} {item.unit}
                                  </span>
                                ) : (
                                  <span className="text-sm text-muted-foreground italic">
                                    Item sin completar
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {donationItems.length > 1 && (
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeDonationItem(index);
                                    }}
                                    className="h-8 w-8"
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                )}
                                {expandedDonationIndex === index ? (
                                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                )}
                              </div>
                            </div>
                          </CollapsibleTrigger>
                          
                          <CollapsibleContent>
                            <div className="p-3 pt-0 space-y-3 border-t">
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Nombre del Item</Label>
                                <Input
                                  placeholder="Ej: Queso, Fruta, etc."
                                  value={item.name}
                                  onChange={(e) => updateDonationItem(index, 'name', e.target.value)}
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">Cantidad</Label>
                                  <Input
                                    placeholder="Ej: 2, 500"
                                    value={item.amount}
                                    onChange={(e) => updateDonationItem(index, 'amount', e.target.value)}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">Unidad</Label>
                                  <Select
                                    value={item.unit}
                                    onValueChange={(value) => updateDonationItem(index, 'unit', value)}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Seleccione" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-background z-50">
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
                          </CollapsibleContent>
                        </Card>
                      </Collapsible>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 pb-6 shrink-0 border-t pt-4">
            <Button variant="outline" onClick={() => setEditDonationsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveDonationsOnly}>
              Guardar Donaciones
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="max-h-[50vh]">
          <div className="p-6 space-y-6">
            {editingDonation && (
              <>
                <div className="space-y-2">
                  <div className="text-center">
                    <h3 className="text-lg font-semibold">
                      {students.find(s => s.id === editingDonation.student_id)?.name}
                    </h3>
                    <p className="text-sm text-muted-foreground">Registrar donación</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="drawer-amount" className="text-base">Monto o descripción</Label>
                  <Input
                    id="drawer-amount"
                    type="text"
                    value={editingDonation.amount}
                    onChange={(e) => {
                      updateDonationAmount(editingDonation.id, e.target.value);
                      setEditingDonation(prev => prev ? {...prev, amount: e.target.value} : null);
                    }}
                    className="w-full text-lg h-12"
                    placeholder="Ej: $500 o Despensa"
                    autoFocus
                  />
                </div>
                
                <div className="flex items-center justify-center space-x-3 p-4 bg-muted/50 rounded-lg">
                  <Checkbox
                    id="drawer-donated"
                    checked={!!editingDonation.donated_at}
                    onCheckedChange={(checked) => {
                      const donatedAt = checked ? new Date().toISOString() : null;
                      setEditingDonation(prev => prev ? {...prev, donated_at: donatedAt} : null);
                      toggleDonationStatus(editingDonation.id, checked as boolean);
                    }}
                    className="h-5 w-5"
                  />
                  <Label htmlFor="drawer-donated" className="text-base cursor-pointer">
                    Marcar como completada
                  </Label>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button 
                    onClick={closeDonationDrawer} 
                    className="flex-1 h-12 text-base"
                  >
                    Guardar
                  </Button>
                  <DrawerClose asChild>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setDrawerOpen(false);
                        setEditingDonation(null);
                      }}
                      className="flex-1 h-12 text-base"
                    >
                      Cancelar
                    </Button>
                  </DrawerClose>
                </div>
              </>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Diálogo para editar compromiso de donación de estudiante */}
      <Dialog open={editStudentDonationDialogOpen} onOpenChange={setEditStudentDonationDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Compromiso de Donación</DialogTitle>
            <DialogDescription>
              {students.find(s => s.id === editingStudentDonation?.student_id)?.name}
            </DialogDescription>
          </DialogHeader>
          {editingStudentDonation && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nombre del Item</Label>
                <Input
                  value={editingStudentDonation.name}
                  onChange={(e) => setEditingStudentDonation({
                    ...editingStudentDonation,
                    name: e.target.value
                  })}
                  placeholder="Ej: Queso, Fruta"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cantidad</Label>
                  <Input
                    value={editingStudentDonation.amount}
                    onChange={(e) => setEditingStudentDonation({
                      ...editingStudentDonation,
                      amount: e.target.value
                    })}
                    placeholder="Ej: 2, 500"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unidad</Label>
                  <Select
                    value={editingStudentDonation.unit}
                    onValueChange={(value) => setEditingStudentDonation({
                      ...editingStudentDonation,
                      unit: value
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
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
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditStudentDonationDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateStudentDonation}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo para asignar donación a estudiante */}
      <Dialog open={assignDonationDialogOpen} onOpenChange={setAssignDonationDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Asignar Donación</DialogTitle>
            <DialogDescription>
              {students.find(s => s.id === assignToStudentId)?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {availableDonationItems.length > 0 && (
              <div className="space-y-2">
                <Label>Seleccionar item pre-cargado</Label>
                <Select onValueChange={selectDonationItem}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione un item..." />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    {availableDonationItems.map((item, idx) => (
                      <SelectItem key={idx} value={item.name}>
                        {item.name} ({item.cantidad_original} {item.unit})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">O ingrese manualmente:</p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Nombre del Item *</Label>
              <Input
                value={assignDonationForm.name}
                onChange={(e) => setAssignDonationForm({
                  ...assignDonationForm,
                  name: e.target.value
                })}
                placeholder="Ej: Queso, Fruta"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cantidad *</Label>
                <Input
                  value={assignDonationForm.amount}
                  onChange={(e) => setAssignDonationForm({
                    ...assignDonationForm,
                    amount: e.target.value
                  })}
                  placeholder="Ej: 2, 500"
                />
              </div>
              <div className="space-y-2">
                <Label>Unidad</Label>
                <Select
                  value={assignDonationForm.unit}
                  onValueChange={(value) => setAssignDonationForm({
                    ...assignDonationForm,
                    unit: value
                  })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
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
            <Button variant="outline" onClick={() => setAssignDonationDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAssignDonation}>
              Asignar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
