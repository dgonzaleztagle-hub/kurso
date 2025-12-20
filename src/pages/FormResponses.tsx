import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Trash2, Eye, BarChart3, Users, FileDown, UserX, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { Form, FormField, FormResponse, FieldOption, ScaleConfig, MatrixConfig, FieldType } from '@/types/forms';
import { Layout } from '@/components/Layout';
import { generatePendingFormReport } from '@/lib/receiptGenerator';

interface FormExclusion {
  id: string;
  student_id: number;
  reason: string | null;
}

export default function FormResponses() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Form | null>(null);
  const [fields, setFields] = useState<FormField[]>([]);
  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [students, setStudents] = useState<Record<number, string>>({});
  const [allStudents, setAllStudents] = useState<{ id: number; name: string }[]>([]);
  const [selectedResponse, setSelectedResponse] = useState<FormResponse | null>(null);
  const [exclusions, setExclusions] = useState<FormExclusion[]>([]);
  const [exclusionsDialogOpen, setExclusionsDialogOpen] = useState(false);
  const [newExclusionStudentId, setNewExclusionStudentId] = useState<string>('');
  const [newExclusionReason, setNewExclusionReason] = useState('');

  useEffect(() => {
    loadData();
    loadExclusions();
  }, [id]);

  const loadExclusions = async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from('form_exclusions')
        .select('id, student_id, reason')
        .eq('form_id', id);
      
      if (error) throw error;
      setExclusions(data || []);
    } catch (error) {
      console.error('Error loading exclusions:', error);
    }
  };

  const addExclusion = async () => {
    if (!id || !newExclusionStudentId) return;
    
    try {
      const { error } = await supabase
        .from('form_exclusions')
        .insert({
          form_id: id,
          student_id: parseInt(newExclusionStudentId),
          reason: newExclusionReason.trim() || null
        });
      
      if (error) throw error;
      
      await loadExclusions();
      setNewExclusionStudentId('');
      setNewExclusionReason('');
      toast.success('Exclusión agregada');
    } catch (error: any) {
      if (error.code === '23505') {
        toast.error('Este estudiante ya está excluido');
      } else {
        console.error('Error adding exclusion:', error);
        toast.error('Error al agregar exclusión');
      }
    }
  };

  const deleteExclusion = async (exclusionId: string) => {
    try {
      const { error } = await supabase
        .from('form_exclusions')
        .delete()
        .eq('id', exclusionId);
      
      if (error) throw error;
      
      setExclusions(exclusions.filter(e => e.id !== exclusionId));
      toast.success('Exclusión eliminada');
    } catch (error) {
      console.error('Error deleting exclusion:', error);
      toast.error('Error al eliminar exclusión');
    }
  };

  const loadData = async () => {
    if (!id) return;
    
    try {
      const [formRes, fieldsRes, responsesRes, studentsRes] = await Promise.all([
        supabase.from('forms').select('*').eq('id', id).single(),
        supabase.from('form_fields').select('*').eq('form_id', id).order('order_index'),
        supabase.from('form_responses').select('*').eq('form_id', id).order('submitted_at', { ascending: false }),
        supabase.from('students').select('id, name')
      ]);
      
      if (formRes.error) throw formRes.error;
      setForm(formRes.data);
      
      if (fieldsRes.error) throw fieldsRes.error;
      setFields(fieldsRes.data.map(f => ({
        ...f,
        field_type: f.field_type as FieldType,
        options: f.options as unknown as FieldOption[] | ScaleConfig | MatrixConfig,
        conditional_logic: f.conditional_logic as unknown as FormField['conditional_logic']
      })));
      
      if (responsesRes.error) throw responsesRes.error;
      setResponses(responsesRes.data.map(r => ({
        ...r,
        response_data: r.response_data as unknown as Record<string, any>
      })));
      
      if (!studentsRes.error && studentsRes.data) {
        const studentMap: Record<number, string> = {};
        studentsRes.data.forEach(s => {
          studentMap[s.id] = s.name;
        });
        setStudents(studentMap);
        setAllStudents(studentsRes.data);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const deleteResponse = async (responseId: string) => {
    try {
      const { error } = await supabase
        .from('form_responses')
        .delete()
        .eq('id', responseId);
        
      if (error) throw error;
      
      setResponses(responses.filter(r => r.id !== responseId));
      toast.success('Respuesta eliminada');
    } catch (error) {
      console.error('Error deleting response:', error);
      toast.error('Error al eliminar');
    }
  };

  const formatValue = (field: FormField | null, value: any): string => {
    if (value === undefined || value === null) return '-';
    
    // Si no hay campo (respuesta huérfana), mostrar el valor directamente
    if (!field) {
      if (typeof value === 'boolean') return value ? 'Sí' : 'No';
      if (typeof value === 'object') return JSON.stringify(value);
      return String(value);
    }
    
    switch (field.field_type) {
      case 'single_choice': {
        const options = field.options as FieldOption[];
        const option = options.find(o => o.id === value);
        return option?.label || String(value);
      }
      case 'multiple_choice': {
        const options = field.options as FieldOption[];
        const values = Array.isArray(value) ? value : [];
        return values.map(v => options.find(o => o.id === v)?.label || v).join(', ');
      }
      case 'checkbox':
        return value ? 'Sí' : 'No';
      case 'date':
        try {
          return format(new Date(value), 'd/MM/yyyy', { locale: es });
        } catch {
          return String(value);
        }
      case 'scale':
        return String(value);
      case 'matrix': {
        const config = field.options as MatrixConfig;
        const matrixValue = value as Record<string, string>;
        return config.rows.map(row => {
          const col = config.columns.find(c => c.id === matrixValue[row.id]);
          return `${row.label}: ${col?.label || '-'}`;
        }).join('; ');
      }
      case 'file':
        return value ? 'Archivo adjunto' : '-';
      default:
        return String(value);
    }
  };

  // Obtener los primeros valores de una respuesta para mostrar en la tabla
  const getResponsePreviewValues = (response: FormResponse): string[] => {
    const previewValues: string[] = [];
    
    // Primero intentar con los campos actuales del formulario
    for (const field of fields.slice(0, 3)) {
      const value = response.response_data[field.id];
      if (value !== undefined) {
        previewValues.push(formatValue(field, value));
      }
    }
    
    // Si no hay valores con campos actuales, mostrar los primeros valores del response_data
    if (previewValues.length === 0) {
      const dataKeys = Object.keys(response.response_data).slice(0, 3);
      for (const key of dataKeys) {
        const value = response.response_data[key];
        previewValues.push(formatValue(null, value));
      }
    }
    
    // Rellenar con '-' si faltan valores
    while (previewValues.length < 3) {
      previewValues.push('-');
    }
    
    return previewValues;
  };

  const exportToExcel = () => {
    const data = responses.map(response => {
      const row: Record<string, any> = {
        'Fecha': format(new Date(response.submitted_at), 'dd/MM/yyyy HH:mm', { locale: es }),
        'Estudiante': response.student_id ? students[response.student_id] || '-' : '-'
      };
      
      fields.forEach(field => {
        row[field.label] = formatValue(field, response.response_data[field.id]);
      });
      
      return row;
    });
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Respuestas');
    XLSX.writeFile(wb, `${form?.title || 'formulario'}_respuestas.xlsx`);
    
    toast.success('Archivo exportado');
  };

  const getStatistics = () => {
    const stats: Record<string, Record<string, number>> = {};
    
    fields.forEach(field => {
      if (['single_choice', 'multiple_choice', 'scale'].includes(field.field_type)) {
        stats[field.id] = {};
        
        responses.forEach(response => {
          const value = response.response_data[field.id];
          
          if (field.field_type === 'multiple_choice' && Array.isArray(value)) {
            value.forEach(v => {
              stats[field.id][v] = (stats[field.id][v] || 0) + 1;
            });
          } else if (value !== undefined && value !== null) {
            stats[field.id][value] = (stats[field.id][value] || 0) + 1;
          }
        });
      }
    });
    
    return stats;
  };

  const statistics = getStatistics();

  // Obtener estudiantes que no han respondido (excluyendo los excluidos)
  const getStudentsWithoutResponse = () => {
    const respondedStudentIds = new Set(
      responses
        .filter(r => r.student_id !== null)
        .map(r => r.student_id)
    );
    const excludedStudentIds = new Set(exclusions.map(e => e.student_id));
    return allStudents.filter(s => !respondedStudentIds.has(s.id) && !excludedStudentIds.has(s.id));
  };

  const pendingStudents = getStudentsWithoutResponse();

  // Obtener estudiantes que pueden ser excluidos (no han respondido y no están excluidos)
  const getAvailableForExclusion = () => {
    const respondedStudentIds = new Set(
      responses
        .filter(r => r.student_id !== null)
        .map(r => r.student_id)
    );
    const excludedStudentIds = new Set(exclusions.map(e => e.student_id));
    return allStudents.filter(s => !respondedStudentIds.has(s.id) && !excludedStudentIds.has(s.id));
  };

  const exportPendingToPDF = async () => {
    if (!form) return;
    
    const excludedWithNames = exclusions.map(e => ({
      name: students[e.student_id] || `ID: ${e.student_id}`,
      reason: e.reason || undefined
    }));
    
    await generatePendingFormReport({
      formTitle: form.title,
      pendingStudents: pendingStudents.map(s => ({ name: s.name })),
      excludedStudents: excludedWithNames,
      totalStudents: allStudents.length,
      respondedCount: responses.filter(r => r.student_id !== null).length
    });
    
    toast.success('Informe PDF generado');
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  if (!form) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Formulario no encontrado</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate('/formularios')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">{form.title}</h1>
              <p className="text-sm text-muted-foreground">{responses.length} respuestas</p>
            </div>
          </div>
          <Button onClick={exportToExcel} disabled={responses.length === 0}>
            <Download className="h-4 w-4 mr-1" />
            Exportar Excel
          </Button>
        </div>

        <Tabs defaultValue="responses">
          <TabsList>
            <TabsTrigger value="responses">Respuestas ({responses.length})</TabsTrigger>
            <TabsTrigger value="pending">Pendientes ({pendingStudents.length})</TabsTrigger>
            <TabsTrigger value="statistics">Estadísticas</TabsTrigger>
          </TabsList>

          <TabsContent value="responses" className="mt-4">
            {responses.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">Aún no hay respuestas</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Estudiante</TableHead>
                          <TableHead className="max-w-[200px]">Respuesta 1</TableHead>
                          <TableHead className="max-w-[200px]">Respuesta 2</TableHead>
                          <TableHead className="max-w-[200px]">Respuesta 3</TableHead>
                          <TableHead className="w-[100px]">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {responses.map(response => {
                          const previewValues = getResponsePreviewValues(response);
                          return (
                          <TableRow key={response.id}>
                            <TableCell className="whitespace-nowrap">
                              {format(new Date(response.submitted_at), 'd/MM/yy HH:mm', { locale: es })}
                            </TableCell>
                            <TableCell>
                              {response.student_id ? students[response.student_id] || '-' : '-'}
                            </TableCell>
                            {previewValues.map((val, idx) => (
                              <TableCell key={idx} className="max-w-[200px] truncate">
                                {val}
                              </TableCell>
                            ))}
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setSelectedResponse(response)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="text-destructive">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>¿Eliminar respuesta?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Esta acción no se puede deshacer.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => deleteResponse(response.id)}>
                                        Eliminar
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </TableCell>
                          </TableRow>
                        )})}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="pending" className="mt-4 space-y-4">
            {/* Estadísticas */}
            <div className="grid grid-cols-4 gap-2 md:gap-4">
              <Card className="p-3">
                <p className="text-xl md:text-2xl font-bold text-center">{allStudents.length}</p>
                <p className="text-xs text-muted-foreground text-center">Total</p>
              </Card>
              <Card className="p-3 bg-green-50 dark:bg-green-950/30">
                <p className="text-xl md:text-2xl font-bold text-center text-green-600">{responses.filter(r => r.student_id !== null).length}</p>
                <p className="text-xs text-muted-foreground text-center">Respondieron</p>
              </Card>
              <Card className="p-3 bg-yellow-50 dark:bg-yellow-950/30">
                <p className="text-xl md:text-2xl font-bold text-center text-yellow-600">{pendingStudents.length}</p>
                <p className="text-xs text-muted-foreground text-center">Pendientes</p>
              </Card>
              <Card className="p-3 bg-muted/50">
                <p className="text-xl md:text-2xl font-bold text-center text-muted-foreground">{exclusions.length}</p>
                <p className="text-xs text-muted-foreground text-center">Excluidos</p>
              </Card>
            </div>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Estudiantes sin responder
                </CardTitle>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setExclusionsDialogOpen(true)}
                  >
                    <UserX className="h-4 w-4 mr-1" />
                    Exclusiones ({exclusions.length})
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={exportPendingToPDF}
                    disabled={pendingStudents.length === 0 && exclusions.length === 0}
                  >
                    <FileDown className="h-4 w-4 mr-1" />
                    Exportar PDF
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {pendingStudents.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-muted-foreground">Todos los estudiantes han respondido o están excluidos</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {pendingStudents.map((student, index) => (
                      <div 
                        key={student.id} 
                        className="flex items-center gap-3 py-2 px-3 rounded-md hover:bg-muted/50"
                      >
                        <span className="text-sm text-muted-foreground w-6">{index + 1}.</span>
                        <span className="text-sm font-medium">{student.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="statistics" className="mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              {fields.filter(f => ['single_choice', 'multiple_choice', 'scale'].includes(f.field_type)).map(field => {
                const fieldStats = statistics[field.id] || {};
                const total = Object.values(fieldStats).reduce((a, b) => a + b, 0);
                
                return (
                  <Card key={field.id}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">{field.label}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {Object.keys(fieldStats).length === 0 ? (
                        <p className="text-sm text-muted-foreground">Sin datos</p>
                      ) : (
                        <div className="space-y-2">
                          {Object.entries(fieldStats).map(([key, count]) => {
                            const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
                            let label = key;
                            
                            if (field.field_type === 'single_choice' || field.field_type === 'multiple_choice') {
                              const options = field.options as FieldOption[];
                              label = options.find(o => o.id === key)?.label || key;
                            }
                            
                            return (
                              <div key={key} className="space-y-1">
                                <div className="flex justify-between text-sm">
                                  <span>{label}</span>
                                  <span className="text-muted-foreground">{count} ({percentage}%)</span>
                                </div>
                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-primary rounded-full transition-all"
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>

        <Dialog open={!!selectedResponse} onOpenChange={() => setSelectedResponse(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detalle de respuesta</DialogTitle>
            </DialogHeader>
            {selectedResponse && (
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Enviada el {format(new Date(selectedResponse.submitted_at), "d 'de' MMMM, yyyy 'a las' HH:mm", { locale: es })}
                </div>
                {selectedResponse.student_id && students[selectedResponse.student_id] && (
                  <div className="text-sm">
                    <strong>Estudiante:</strong> {students[selectedResponse.student_id]}
                  </div>
                )}
                <div className="space-y-4 pt-4 border-t">
                  {/* Mostrar campos actuales del formulario */}
                  {fields.map(field => {
                    const value = selectedResponse.response_data[field.id];
                    if (value === undefined) return null;
                    return (
                      <div key={field.id}>
                        <p className="font-medium text-sm">{field.label}</p>
                        <p className="text-muted-foreground">
                          {formatValue(field, value)}
                        </p>
                        {field.field_type === 'file' && value && (
                          <a 
                            href={value} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-primary hover:underline text-sm"
                          >
                            Ver archivo
                          </a>
                        )}
                      </div>
                    );
                  })}
                  
                  {/* Mostrar datos huérfanos (campos que ya no existen en el formulario) */}
                  {Object.entries(selectedResponse.response_data)
                    .filter(([key]) => !fields.some(f => f.id === key))
                    .map(([key, value]) => (
                      <div key={key} className="opacity-75">
                        <p className="font-medium text-sm text-amber-600">
                          Pregunta anterior (ID: {key.slice(0, 8)}...)
                        </p>
                        <p className="text-muted-foreground">
                          {formatValue(null, value)}
                        </p>
                      </div>
                    ))
                  }
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Dialog de Exclusiones */}
        <Dialog open={exclusionsDialogOpen} onOpenChange={setExclusionsDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Gestionar Exclusiones</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Agregar nueva exclusión */}
              <div className="space-y-3 p-3 border rounded-lg">
                <Label className="text-sm font-medium">Agregar exclusión</Label>
                <Select value={newExclusionStudentId} onValueChange={setNewExclusionStudentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar estudiante" />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableForExclusion().map(student => (
                      <SelectItem key={student.id} value={student.id.toString()}>
                        {student.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Razón (opcional)"
                  value={newExclusionReason}
                  onChange={(e) => setNewExclusionReason(e.target.value)}
                />
                <Button 
                  onClick={addExclusion} 
                  disabled={!newExclusionStudentId}
                  size="sm"
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Agregar
                </Button>
              </div>

              {/* Lista de exclusiones */}
              {exclusions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No hay estudiantes excluidos
                </p>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {exclusions.map(exclusion => (
                    <div 
                      key={exclusion.id} 
                      className="flex items-center justify-between p-2 bg-muted/50 rounded-md"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {students[exclusion.student_id] || `ID: ${exclusion.student_id}`}
                        </p>
                        {exclusion.reason && (
                          <p className="text-xs text-muted-foreground">{exclusion.reason}</p>
                        )}
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar exclusión?</AlertDialogTitle>
                            <AlertDialogDescription>
                              El estudiante volverá a aparecer en la lista de pendientes.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteExclusion(exclusion.id)}>
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
