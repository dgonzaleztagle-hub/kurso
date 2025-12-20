import { useNavigate, Outlet, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
    LayoutDashboard,
    Building2,
    Users,
    LogOut,
    Menu,
    X,
    Settings
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

import { useAuth } from "@/contexts/AuthContext";

export const AdminLayout = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { signOut } = useAuth();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    const isActive = (path: string) => location.pathname === path;

    const navItems = [
        { title: "Dashboard", icon: LayoutDashboard, path: "/admin" },
        { title: "Organizaciones", icon: Building2, path: "/admin/organizations" },
        { title: "Usuarios Globales", icon: Users, path: "/admin/users" },
    ];

    return (
        <div className="min-h-screen bg-muted/20 flex">
            {/* Sidebar */}
            <aside
                className={cn(
                    "bg-card border-r fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-200 ease-in-out md:relative md:translate-x-0 flex flex-col",
                    !isSidebarOpen && "-translate-x-full md:hidden"
                )}
            >
                <div className="p-6 border-b flex items-center gap-2">
                    <img src="/kurso-icon.png" className="h-8 w-8" alt="Logo" />
                    <div>
                        <h2 className="font-bold text-lg">Kurso Admin</h2>
                        <span className="text-xs text-muted-foreground bg-primary/10 text-primary px-2 py-0.5 rounded-full">SuperAdmin</span>
                    </div>
                </div>

                <div className="flex-1 py-6 px-4 space-y-2">
                    {navItems.map((item) => (
                        <Button
                            key={item.path}
                            variant={isActive(item.path) ? "secondary" : "ghost"}
                            className={cn(
                                "w-full justify-start",
                                isActive(item.path) && "bg-secondary font-medium"
                            )}
                            onClick={() => navigate(item.path)}
                        >
                            <item.icon className="mr-2 h-5 w-5" />
                            {item.title}
                        </Button>
                    ))}

                    <div className="pt-4 mt-auto">
                        <Button
                            variant="ghost"
                            className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                            onClick={async () => {
                                await signOut();
                                window.location.href = '/';
                            }}
                        >
                            <LogOut className="mr-2 h-5 w-5" />
                            Cerrar Sesión
                        </Button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0">
                <header className="h-16 border-b bg-card px-6 flex items-center justify-between md:hidden">
                    <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
                        <Menu className="h-6 w-6" />
                    </Button>
                    <span className="font-semibold">Panel de Control</span>
                </header>

                <main className="flex-1 p-6 overflow-auto">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};
