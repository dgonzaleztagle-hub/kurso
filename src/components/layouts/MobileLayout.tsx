import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { Home, Wallet, MessageCircle, Calendar, FileText, User } from "lucide-react";
import { cn } from "@/lib/utils";

export const MobileLayout = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const isActive = (path: string) => location.pathname.includes(path);

    return (
        <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#101922] pb-[80px]">
            {/* Main Content Area */}
            <main className="flex-1 w-full max-w-md mx-auto relative">
                <Outlet />
            </main>

            {/* Bottom Navigation (Fixed) */}
            <div className="fixed bottom-0 left-0 w-full bg-white dark:bg-[#1c2630] border-t border-gray-200 dark:border-gray-800 pb-safe z-50">
                <div className="flex justify-around items-end h-[60px] pb-2 max-w-md mx-auto">

                    {/* INICIO (Tablón) */}
                    <button
                        onClick={() => navigate("/mobile/board")}
                        className={cn(
                            "flex flex-col items-center gap-1 w-full transition-colors",
                            isActive("/mobile/board") || location.pathname === "/mobile"
                                ? "text-blue-600 dark:text-blue-400"
                                : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        )}
                    >
                        <div className="relative">
                            <Home className="w-6 h-6" />
                            {/* Notification Dot (Mocked for now - or based on localStorage last_view) */}
                            {location.pathname !== "/mobile/board" && (
                                <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                                </span>
                            )}
                        </div>
                        <span className="text-[10px] font-medium">Inicio</span>
                    </button>

                    {/* FINANZAS */}
                    <button
                        onClick={() => navigate("/mobile/finances")}
                        className={cn(
                            "flex flex-col items-center gap-1 w-full transition-colors",
                            isActive("/mobile/finances")
                                ? "text-blue-600 dark:text-blue-400"
                                : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        )}
                    >
                        <Wallet className="w-6 h-6" />
                        <span className="text-[10px] font-medium">Finanzas</span>
                    </button>

                    {/* AGENDA */}
                    <button
                        onClick={() => navigate("/mobile/agenda")}
                        className={cn(
                            "flex flex-col items-center gap-1 w-full transition-colors",
                            isActive("/mobile/agenda")
                                ? "text-blue-600 dark:text-blue-400"
                                : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        )}
                    >
                        <Calendar className="w-6 h-6" />
                        <span className="text-[10px] font-medium">Agenda</span>
                    </button>

                    {/* ACTAS */}
                    <button
                        onClick={() => navigate("/mobile/actas")}
                        className={cn(
                            "flex flex-col items-center gap-1 w-full transition-colors",
                            isActive("/mobile/actas")
                                ? "text-blue-600 dark:text-blue-400"
                                : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        )}
                    >
                        <FileText className="w-6 h-6" />
                        <span className="text-[10px] font-medium">Actas</span>
                    </button>

                    {/* PERFIL */}
                    <button
                        onClick={() => navigate("/mobile/profile")}
                        className={cn(
                            "flex flex-col items-center gap-1 w-full transition-colors",
                            isActive("/mobile/profile")
                                ? "text-blue-600 dark:text-blue-400"
                                : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        )}
                    >
                        <User className="w-6 h-6" />
                        <span className="text-[10px] font-medium">Perfil</span>
                    </button>

                </div>
            </div>
        </div>
    );
};
