import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { LogOut, User, Users, Phone, Mail, ChevronRight, GraduationCap } from "lucide-react";

interface Student {
    id: string;
    first_name: string;
    last_name: string;
    enrollment_date: string;
}

export default function MobileProfile() {
    const { user, appUser, signOut } = useAuth();
    const { currentTenant } = useTenant();
    const [myStudents, setMyStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (currentTenant && user) {
            fetchStudents();
        } else {
            setLoading(false);
        }
    }, [currentTenant, user]);

    const fetchStudents = async () => {
        try {
            // Join student_guardians -> students
            const { data, error } = await supabase
                .from('student_guardians')
                .select(`
                    students (
                        id,
                        first_name,
                        last_name,
                        enrollment_date
                    )
                `)
                .eq('guardian_id', user?.id)
                .eq('tenant_id', currentTenant?.id);

            if (error) {
                console.error("Error fetching students:", error);
                // Fallback for demo if table/relation fails
                setMyStudents([]);
            } else {
                // Flatten structure
                const studentsList = data.map((item: any) => item.students).filter(Boolean);
                setMyStudents(studentsList);
            }
        } catch (err) {
            console.error("Exception fetching students:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        await signOut();
    };

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .substring(0, 2);
    };

    return (
        <div className="pb-24 pt-6 px-4 max-w-md mx-auto min-h-screen bg-gray-50/50 dark:bg-gray-900/50">
            {/* Header / Profile Card */}
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-[#111418] dark:text-white">
                    Mi Perfil
                </h1>
                <span className="text-xs text-gray-500">{currentTenant?.name}</span>
            </div>

            <div className="flex flex-col gap-6">
                {/* User Info Card */}
                <Card className="p-6 border-none shadow-sm flex flex-col items-center bg-white dark:bg-[#1c2630]">
                    <Avatar className="h-20 w-20 mb-4 border-2 border-blue-100 dark:border-blue-900">
                        <AvatarImage src={appUser?.avatar_url || ""} />
                        <AvatarFallback className="bg-blue-600 text-white text-xl">
                            {appUser?.full_name ? getInitials(appUser.full_name) : <User />}
                        </AvatarFallback>
                    </Avatar>

                    <h2 className="text-xl font-bold text-center text-gray-900 dark:text-gray-100">
                        {appUser?.full_name || user?.email?.split('@')[0]}
                    </h2>
                    <p className="text-sm text-gray-500 mb-6">{user?.email}</p>

                    <div className="w-full grid grid-cols-2 gap-3">
                        <div className="flex flex-col items-center p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                            <Phone className="h-5 w-5 text-gray-400 mb-1" />
                            <span className="text-xs text-gray-500">
                                {appUser?.whatsapp_number || "Sin teléfono"}
                            </span>
                        </div>
                        <div className="flex flex-col items-center p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                            <Mail className="h-5 w-5 text-gray-400 mb-1" />
                            <span className="text-xs text-gray-500 truncate w-full text-center">
                                Contacto
                            </span>
                        </div>
                    </div>
                </Card>

                {/* Students / Children Section */}
                <div>
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 px-1">
                        Mis Estudiantes
                    </h3>

                    {loading ? (
                        <div className="p-4 text-center text-gray-400 text-sm">Cargando...</div>
                    ) : myStudents.length === 0 ? (
                        <Card className="p-6 border-none shadow-sm bg-white dark:bg-[#1c2630] flex flex-col items-center text-center">
                            <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                                <Users className="h-6 w-6 text-gray-400" />
                            </div>
                            <p className="text-gray-500 text-sm">
                                No tienes estudiantes asociados en este curso.
                            </p>
                        </Card>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {myStudents.map((student) => (
                                <Card key={student.id} className="p-4 border-none shadow-sm bg-white dark:bg-[#1c2630] flex items-center gap-4">
                                    <div className="h-12 w-12 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                                        <GraduationCap className="h-6 w-6" />
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-bold text-gray-900 dark:text-gray-100">
                                            {student.first_name} {student.last_name}
                                        </h4>
                                        <p className="text-xs text-gray-500">
                                            Matrícula: {new Date(student.enrollment_date).getFullYear()}
                                        </p>
                                    </div>
                                    <ChevronRight className="h-5 w-5 text-gray-300" />
                                </Card>
                            ))}
                        </div>
                    )}
                </div>

                {/* Logout Button */}
                <div className="pt-4">
                    <Button
                        variant="destructive"
                        className="w-full h-12 rounded-xl shadow-lg shadow-red-500/10 text-base font-semibold"
                        onClick={handleLogout}
                    >
                        <LogOut className="mr-2 h-5 w-5" />
                        Cerrar Sesión
                    </Button>
                    <p className="text-center text-xs text-gray-400 mt-4">
                        Stitch Mobile v1.0.0
                    </p>
                </div>
            </div>
        </div>
    );
}
