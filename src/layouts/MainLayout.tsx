import { ReactNode } from "react";
import { HojaceroSignature } from "@/components/HojaceroSignature";

import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { mainNavigation } from "@/config/navigation";
import { resolveBranding } from "@/lib/branding";
import { hasRoleAccess } from "@/lib/roles";
import { SaasBillingBanner } from "@/components/subscription/SaasBillingBanner";
import { getCommercialStatusLabel } from "@/lib/saasBilling";

interface MainLayoutProps {
    children: ReactNode;
}

import { useTenant } from "@/contexts/TenantContext";

export const MainLayout = ({ children }: MainLayoutProps) => {
    const location = useLocation();
    const { signOut, userRole: globalRole, hasPermission } = useAuth();
    const { roleInCurrentTenant, currentTenant } = useTenant();

    // Extract College Name from Settings
    const institutionName = currentTenant?.settings?.institution_name || null;
    const branding = resolveBranding(currentTenant?.settings, currentTenant?.name);
    const commercialStatus = getCommercialStatusLabel(currentTenant);

    // Use Tenant Role if available, otherwise global (for SuperAdmin/Legacy)
    // If not in a tenant context (e.g. creating one), fallback might be needed
    const activeRole = roleInCurrentTenant || globalRole;

    const greeting = activeRole === 'admin' || activeRole === 'owner' || activeRole === 'master'
        ? 'Panel de Control'
        : 'Mi Cuenta';

    const isRouteActive = (href: string) => {
        if (href === '/') return location.pathname === '/';
        return location.pathname.startsWith(href);
    };

    const isCategoryActive = (category: any) => {
        if (category.href) return isRouteActive(category.href);
        if (category.items) {
            return category.items.some((item: any) => isRouteActive(item.href));
        }
        return false;
    };

    const filteredCategories = mainNavigation
        .map(category => {
            if (!category.items) {
                if ((category as any).masterOnly && !hasRoleAccess(activeRole, "master")) return null;
                return category;
            }

            const filteredItems = category.items.filter((item: any) => {
                if (hasRoleAccess(activeRole, "master")) return true;
                if (item.masterOnly) return false;

                // For admin/members, we might check permissions or role mapping
                // For now, if role is 'admin', show all non-master items
                if (activeRole === 'admin') return true;

                // Students/Members restrictions
                if (activeRole === 'student' || activeRole === 'member') {
                    // Allow specific items for students (like Meeting Minutes)
                    if (!item.allowStudent) return false;
                }

                return item.module ? hasPermission(item.module as any) : true;
            });

            if (filteredItems.length === 0) return null;
            return { ...category, items: filteredItems };
        })
        .filter(Boolean);

    return (
        <div className="min-h-screen flex flex-col bg-background">
            {/* Header */}
            <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container flex h-14 items-center px-4">
                    <div className="flex items-center gap-2">
                        <img src={branding.logoUrl} alt={branding.appName} className="h-7 w-7 rounded object-contain" />
                        <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-2">
                            <span className="text-sm font-medium hidden sm:inline-block">{branding.appName}</span>
                            {institutionName && (
                                <span className="text-xs text-muted-foreground font-light hidden sm:inline-block">
                                    | {institutionName}
                                </span>
                            )}

                            {/* TRIAL BADGE */}
                            {currentTenant?.subscription_status === 'trial' && currentTenant.trial_ends_at && (
                                (() => {
                                    const days = Math.ceil((new Date(currentTenant.trial_ends_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                                    return (
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ml-2 ${days <= 3 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                                            Prueba: {days > 0 ? `${days}d` : '0d'}
                                        </span>
                                    );
                                })()
                            )}
                            {commercialStatus && currentTenant?.subscription_status !== "trial" && (
                                <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-700">
                                    {commercialStatus}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                        <span className="text-xs sm:text-sm text-muted-foreground">{greeting}</span>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                                await signOut();
                                window.location.href = '/';
                            }}
                            className="gap-2"
                        >
                            <LogOut className="h-4 w-4" />
                            <span className="hidden sm:inline">Salir</span>
                        </Button>
                    </div>
                </div>
            </header>

            {/* Navigation Tabs */}
            <nav className="border-b bg-muted/50">
                <div className="container px-4">
                    <div className="flex overflow-x-auto hide-scrollbar">
                        <div className="flex min-w-full py-2 gap-1">
                            {filteredCategories.map((category: any) => {
                                const Icon = category.icon;
                                const isActive = isCategoryActive(category);

                                if (!category.items) {
                                    return (
                                        <Link
                                            key={category.href}
                                            to={category.href}
                                            className={cn(
                                                "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap",
                                                isActive
                                                    ? "bg-background text-foreground shadow-sm"
                                                    : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
                                            )}
                                        >
                                            <Icon className="h-4 w-4 flex-shrink-0" />
                                            <span className="hidden sm:inline">{category.name}</span>
                                        </Link>
                                    );
                                }

                                return (
                                    <DropdownMenu key={category.name}>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className={cn(
                                                    "flex items-center gap-1 px-3 py-2 h-auto text-sm font-medium rounded-md transition-colors whitespace-nowrap",
                                                    isActive
                                                        ? "bg-background text-foreground shadow-sm"
                                                        : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
                                                )}
                                            >
                                                <Icon className="h-4 w-4 flex-shrink-0" />
                                                <span className="hidden sm:inline">{category.name}</span>
                                                <ChevronDown className="h-3 w-3 flex-shrink-0" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="start" className="w-56">
                                            {category.items.map((item: any) => {
                                                const ItemIcon = item.icon;
                                                const itemActive = isRouteActive(item.href);

                                                return (
                                                    <DropdownMenuItem key={item.href} asChild>
                                                        <Link
                                                            to={item.href}
                                                            className={cn(
                                                                "flex items-center gap-2 w-full cursor-pointer",
                                                                itemActive && "bg-accent"
                                                            )}
                                                        >
                                                            <ItemIcon className="h-4 w-4" />
                                                            <span>{item.name}</span>
                                                        </Link>
                                                    </DropdownMenuItem>
                                                );
                                            })}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </nav>

            <main className="flex-1 container py-4 md:py-6">
                <SaasBillingBanner compact />
                {children}
            </main>

            <footer className="border-t border-white/5 py-12 px-4 flex flex-col items-center justify-center gap-2 text-center">
                <HojaceroSignature />
                <p className="text-[10px] text-muted-foreground/40 mt-4">
                    © {new Date().getFullYear()} {branding.appName}. Todos los derechos reservados.
                </p>
            </footer>
        </div>
    );
};
