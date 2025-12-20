import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Gift } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DonationItem {
  id: string;
  name: string;
  amount: string;
  unit: string;
  student_id: number | null;
  scheduled_activity_id: string;
  cantidad_original: number;
  cantidad_disponible: number;
  cantidad_comprometida: number;
}

interface ScheduledActivity {
  id: string;
  name: string;
  scheduled_date: string;
}

export default function SelectDonation() {
  const { activityId } = useParams();
  const { user, studentId, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [activity, setActivity] = useState<ScheduledActivity | null>(null);
  const [availableItems, setAvailableItems] = useState<DonationItem[]>([]);
  const [selectedDonations, setSelectedDonations] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  useEffect(() => {
    // Esperar a que termine la carga de autenticación antes de cargar la actividad
    if (!authLoading) {
      loadActivity();
    }
  }, [activityId, authLoading]);

  const loadActivity = async () => {
    try {
      setLoading(true);

      // Obtener información de la actividad programada
      const { data: activityData, error: activityError } = await supabase
        .from("scheduled_activities")
        .select("id, name, scheduled_date")
        .eq("id", activityId)
        .single();

      if (activityError) throw activityError;
      setActivity(activityData);

      // Cargar TODOS los items de donación de esta actividad
      const { data: allDonations, error: donationsError } = await supabase
        .from("activity_donations")
        .select("*")
        .eq("scheduled_activity_id", activityId)
        .order("student_id", { nullsFirst: true });

      if (donationsError) throw donationsError;

      // Agrupar por nombre + unidad para calcular disponibles usando solo el registro base
      const baseItems = allDonations?.filter((d) => d.student_id === null) || [];

      const itemsMap = new Map<string, DonationItem>();

      baseItems.forEach((donation) => {
        const key = `${donation.name}-${donation.unit}`;

        const cantidadOriginal = donation.cantidad_original
          ? parseInt(donation.cantidad_original)
          : parseInt(donation.amount) || 0;

        const cantidadDisponible = parseInt(donation.amount) || 0;

        itemsMap.set(key, {
          id: donation.id,
          name: donation.name,
          unit: donation.unit,
          cantidad_original: cantidadOriginal,
          cantidad_disponible: cantidadDisponible,
          cantidad_comprometida: cantidadOriginal - cantidadDisponible,
          scheduled_activity_id: donation.scheduled_activity_id,
          student_id: null,
          amount: donation.amount,
        });
      });

      // Filtrar solo items que aún tienen cantidad disponible
      const availableItems = Array.from(itemsMap.values()).filter(
        (item) => item.cantidad_disponible > 0 && item.name
      );

      setAvailableItems(availableItems);
    } catch (error: any) {
      console.error("Error al cargar donaciones:", error);
      toast.error("Error al cargar información de donaciones");
    } finally {
      setLoading(false);
    }
  };

  const handleQuantityChange = (itemKey: string, value: string) => {
    // Permitir campo vacío
    if (value === "") {
      setSelectedDonations(prev => {
        const updated = { ...prev };
        delete updated[itemKey];
        return updated;
      });
      return;
    }

    // Validar que sea un número válido
    const quantity = parseInt(value, 10);
    if (isNaN(quantity)) {
      toast.error("Por favor ingresa solo números");
      return;
    }

    if (quantity < 0) {
      toast.error("La cantidad debe ser mayor o igual a 0");
      return;
    }

    const item = availableItems.find((i) => `${i.name}-${i.unit}` === itemKey);
    if (!item) return;

    const maxAvailable = item.cantidad_disponible;

    if (quantity > maxAvailable) {
      toast.error(
        `Solo quedan ${maxAvailable} unidades disponibles de ${item.name}. ` +
        `No se puede comprometer más de lo solicitado originalmente.`,
        { duration: 5000 }
      );
      return;
    }

    if (quantity === 0) {
      setSelectedDonations(prev => {
        const updated = { ...prev };
        delete updated[itemKey];
        return updated;
      });
    } else {
      setSelectedDonations(prev => ({
        ...prev,
        [itemKey]: quantity
      }));
    }
  };

  const handleSave = async () => {
    const totalSelected = Object.values(selectedDonations).reduce((sum, qty) => sum + qty, 0);
    
    if (totalSelected === 0) {
      toast.error("Selecciona al menos una donación");
      return;
    }
    
    // Validar que las cantidades no excedan el disponible
    for (const [key, quantity] of Object.entries(selectedDonations)) {
      const item = availableItems.find((i) => `${i.name}-${i.unit}` === key);
      if (!item) continue;
      
      if (quantity > item.cantidad_disponible) {
        toast.error(`La cantidad para ${item.name} excede las unidades disponibles (${item.cantidad_disponible})`);
        return;
      }
    }

    // ADVERTENCIA: Verificar si el estudiante ya tiene donaciones registradas
    if (studentId) {
      const { data: existingDonations } = await supabase
        .from("activity_donations")
        .select("id, name, amount, unit")
        .eq("scheduled_activity_id", activityId)
        .eq("student_id", studentId);

      if (existingDonations && existingDonations.length > 0) {
        const donationsList = existingDonations
          .map(d => `${d.name} (${d.amount} ${d.unit})`)
          .join(", ");
        
        toast.info(
          `Ya tienes donaciones previas: ${donationsList}. Puedes continuar agregando más donaciones.`,
          { duration: 5000 }
        );
      }
    }
    
    setShowConfirmDialog(true);
  };

  const handleConfirm = async () => {
    if (!studentId) return;

    try {
      setSubmitting(true);
      setShowConfirmDialog(false);

      // Para cada item seleccionado, crear nuevos registros basados en la cantidad
      for (const [itemKey, quantity] of Object.entries(selectedDonations)) {
        const numQuantity = typeof quantity === 'string' ? parseInt(quantity, 10) : quantity;
        if (isNaN(numQuantity) || numQuantity <= 0) continue;
        
        const item = availableItems.find(i => `${i.name}-${i.unit}` === itemKey);
        if (!item) continue;

        // Obtener el item base disponible (sin student_id) directamente de la base de datos
        const { data: baseItem, error: fetchError } = await supabase
          .from("activity_donations")
          .select("*")
          .eq("scheduled_activity_id", activityId)
          .eq("name", item.name)
          .eq("unit", item.unit)
          .is("student_id", null)
          .single();

        if (fetchError || !baseItem) {
          console.error("Error al obtener item base:", fetchError);
          toast.error(`No se encontró el item base para ${item.name}`);
          setSubmitting(false);
          return;
        }

        const currentAmount = parseInt(baseItem.amount) || 0;
        
        // Validar que haya suficientes unidades
        if (numQuantity > currentAmount) {
          toast.error(`No hay suficientes unidades de ${item.name}`);
          setSubmitting(false);
          return;
        }

        // Crear múltiples registros de donación (uno por cada unidad donada)
        const donationsToInsert = Array.from({ length: numQuantity }, () => ({
          scheduled_activity_id: activityId!,
          name: item.name,
          amount: "1", // Cada registro representa 1 unidad
          unit: item.unit,
          student_id: studentId,
          cantidad_original: baseItem.cantidad_original,
          donated_at: null, // Admin confirmará después
        }));

        const { error: insertError } = await supabase
          .from("activity_donations")
          .insert(donationsToInsert);

        if (insertError) {
          console.error("Error al insertar donaciones:", insertError);
          throw insertError;
        }

        // Actualizar el registro base original para decrementar el amount
        const remainingAmount = currentAmount - numQuantity;
        
        // NUNCA eliminar el registro base, siempre mantenerlo aunque amount sea 0
        const { error: updateError } = await supabase
          .from("activity_donations")
          .update({ amount: remainingAmount.toString() })
          .eq("id", baseItem.id);

        if (updateError) {
          console.error("Error al actualizar cantidad:", updateError);
          throw updateError;
        }
      }

      toast.success("¡Donación(es) registrada(s) exitosamente!");
      navigate("/student-dashboard");
    } catch (error: any) {
      console.error("Error al registrar donación:", error);
      toast.error(error.message || "Error al registrar donación");
      setSubmitting(false);
    }
  };

  // Agrupar items por nombre y unidad
  const donationGroups = Array.from(
    availableItems.reduce((map, item) => {
      const key = `${item.name}-${item.unit}`;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(item);
      return map;
    }, new Map<string, DonationItem[]>())
  );

  // Mostrar loading si la autenticación o la actividad están cargando
  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  if (availableItems.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-6 w-6 text-amber-600" />
              <CardTitle>No Hay Donaciones Disponibles</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Todas las donaciones para esta actividad ya han sido asignadas.
            </p>
            <Button onClick={() => navigate("/student-dashboard")} className="w-full">
              Volver al Inicio
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedCount = Object.values(selectedDonations).reduce((sum, qty) => {
    const numQty = typeof qty === 'string' ? parseInt(qty, 10) : qty;
    return sum + (isNaN(numQty) ? 0 : numQty);
  }, 0);

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-primary/10 to-secondary/10 p-4">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Gift className="h-6 w-6 text-primary" />
                <CardTitle>{activity?.name}</CardTitle>
              </div>
              <CardDescription>
                Selecciona las donaciones que deseas realizar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Puedes seleccionar una o varias donaciones. Si un ítem tiene varias unidades disponibles,
                  puedes especificar la cantidad que deseas donar.
                </AlertDescription>
              </Alert>

              <div className="space-y-3">
                {donationGroups.map(([key, items]) => {
                  const firstItem = items[0];
                  const totalDisponible = firstItem.cantidad_disponible;
                  const totalOriginal = firstItem.cantidad_original;
                  
                  return (
                    <Card key={key} className="border-2 hover:border-primary/50 transition-colors">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Gift className="h-5 w-5 text-primary" />
                          {firstItem.name}
                        </CardTitle>
                        <CardDescription>
                          Disponible: <strong>{totalDisponible} de {totalOriginal}</strong> {firstItem.unit}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <Label htmlFor={`qty-${key}`} className="text-sm">
                            Cantidad a donar
                          </Label>
                          <Input
                            id={`qty-${key}`}
                            type="number"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            min="0"
                            max={totalDisponible}
                            value={selectedDonations[key] ?? ""}
                            onChange={(e) => handleQuantityChange(key, e.target.value)}
                            placeholder="0"
                            className="mt-1.5"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Máximo: {totalDisponible} {firstItem.unit}
                          </p>
                          {firstItem.name.toLowerCase().includes("calzones rotos") && (
                            <p className="text-xs text-info mt-2 font-medium">
                              ℹ️ 1 donación = 10 unidades de calzones rotos
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={() => navigate("/student-dashboard")}
                  variant="outline"
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={selectedCount === 0 || submitting}
                  className="flex-1"
                >
                  {submitting ? "Guardando..." : `Guardar ${selectedCount > 0 ? `(${selectedCount})` : ""}`}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar donación?</AlertDialogTitle>
            <AlertDialogDescription>
              Estás a punto de registrar las siguientes donaciones:
              <ul className="mt-2 space-y-1">
                {Object.entries(selectedDonations).map(([itemKey, quantity]) => {
                  const numQuantity = typeof quantity === 'string' ? parseInt(quantity, 10) : quantity;
                  if (isNaN(numQuantity) || numQuantity === 0) return null;
                  
                  const items = donationGroups.find(([k]) => k === itemKey)?.[1] || [];
                  const item = items[0];
                  if (!item) return null;
                  
                  return (
                    <li key={itemKey} className="font-medium">
                      • {item.name}: {numQuantity} {item.unit}
                    </li>
                  );
                })}
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>
              Confirmar Donación
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
