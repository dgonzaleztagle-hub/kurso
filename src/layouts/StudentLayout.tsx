import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { School, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { studentNavigation } from "@/config/navigation";

interface StudentLayoutProps {
    children: ReactNode;
}

export const StudentLayout = ({ children }: StudentLayoutProps) => {
    const location = useLocation();
    const { signOut, studentId } = useAuth();
    const [studentName, setStudentName] = useState<string | null>(null);

    useEffect(() => {
        const fetchStudentName = async () => {
            if (studentId) {
                const { data, error } = await supabase
                    .from('students')
                    .select('name')
                    .eq('id', studentId)
                    .single();

                if (!error && data) {
                    const firstName = data.name.split(' ')[0];
                    setStudentName(firstName);
                }
            }
        };

        fetchStudentName();
    }, [studentId]);

    return (
        <div className="min-h-screen bg-background">
            <header className="sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
                <div className="flex h-14 md:h-16 items-center gap-2 md:gap-4 px-3 md:px-4">
                    <Link to="/" className="flex items-center gap-1.5 md:gap-2 hover:opacity-80 transition-opacity">
                        <School className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                        <span className="text-base md:text-xl font-bold text-foreground truncate">Kurso</span>
                    </Link>
                    <div className="ml-auto flex items-center gap-2 md:gap-4">
                        {studentName && (
                            <div className="text-xs md:text-sm text-muted-foreground hidden sm:block">
                                ¡Hola {studentName}!
                            </div>
                        )}
                        {!studentName && (
                            <div className="text-xs md:text-sm text-muted-foreground hidden sm:block">
                                Bienvenido
                            </div>
                        )}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                                await signOut();
                                window.location.href = '/';
                            }}
                            className="gap-1.5 md:gap-2 h-9 md:h-10 px-2 md:px-4"
                        >
                            <LogOut className="h-3.5 w-3.5 md:h-4 md:w-4" />
                            <span className="hidden sm:inline text-xs md:text-sm">Cerrar Sesión</span>
                        </Button>
                    </div>
                </div>
            </header>

            <nav className="border-b bg-card sticky top-14 md:top-16 z-40 overflow-x-auto">
                <div className="min-w-max px-2 md:px-4">
                    <div className="flex gap-1 md:gap-2 pb-px">
                        {studentNavigation.map((item) => {
                            const Icon = item.icon;
                            const isActive = location.pathname === item.href;

                            return (
                                <Link
                                    key={item.name}
                                    to={item.href}
                                    className={cn(
                                        "flex items-center gap-1.5 md:gap-2 whitespace-nowrap px-3 md:px-4 py-2.5 md:py-3 text-xs md:text-sm font-medium transition-colors border-b-2 flex-shrink-0",
                                        isActive
                                            ? "border-primary text-primary"
                                            : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted"
                                    )}
                                >
                                    <Icon className="h-3.5 w-3.5 md:h-4 md:w-4 shrink-0" />
                                    <span>{item.name}</span>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            </nav>

            <main className="py-4 md:py-6 px-3 md:px-4">
                {children}
            </main>

            <footer className="border-t py-3 md:py-4 px-3 md:px-4 text-center text-xs md:text-sm text-muted-foreground">
                <p>Potenciado por <strong>Kurso</strong></p>
            </footer>
        </div>
    );
};
