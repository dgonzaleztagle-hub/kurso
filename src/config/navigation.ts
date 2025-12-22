import {
    LayoutDashboard,
    Users,
    DollarSign,
    TrendingDown,
    ArrowLeftRight,
    Calendar,
    UserCog,
    UserX,
    Receipt,
    CreditCard,
    ClipboardList,
    Wallet,
    FileCheck,
    Bell,
    FileText,
    CalendarClock,
    FileQuestion,
    Coins,
    User,
    ShieldCheck,
    NotebookText,
    LucideIcon
} from "lucide-react";

export type NavItem = {
    name: string;
    href: string;
    icon: LucideIcon;
    module?: string;
    masterOnly?: boolean;
    allowStudent?: boolean;
};

export type NavCategory = {
    name: string;
    href?: string;
    icon: LucideIcon;
    isTab?: boolean;
    items?: NavItem[];
};

export const mainNavigation: NavCategory[] = [
    {
        name: "Dashboard",
        href: "/",
        icon: LayoutDashboard,
        isTab: true,
    },
    {
        name: "Finanzas",
        icon: Wallet,
        isTab: true,
        items: [
            { name: "Balance", href: "/balance", icon: Wallet, module: "balance" },
            { name: "Ingresos", href: "/income", icon: DollarSign, module: "income" },
            { name: "Egresos", href: "/expenses", icon: TrendingDown, module: "expenses" },
            { name: "Gestión de Créditos", href: "/credit-management", icon: Coins, module: "credit_management" },
            { name: "Movimientos de Crédito", href: "/credit-movements", icon: ArrowLeftRight, masterOnly: true },
        ],
    },
    {
        name: "Reportes",
        icon: ClipboardList,
        isTab: true,
        items: [
            { name: "Informes de Deudas", href: "/debt-reports", icon: ClipboardList, module: "debt_reports" },
            { name: "Informes de Pagos", href: "/payment-reports", icon: FileCheck, module: "payment_reports" },
        ],
    },
    {
        name: "Estudiantes",
        icon: Users,
        isTab: true,
        items: [
            { name: "Lista de Estudiantes", href: "/students", icon: Users, module: "students" },
            { name: "Perfil del Estudiante", href: "/student-profile", icon: User, masterOnly: true },
            { name: "Estado de Pagos", href: "/activity-payments", icon: Receipt, module: "activity_payments" },
        ],
    },
    {
        name: "Actividades",
        icon: Calendar,
        isTab: true,
        items: [
            { name: "Actividades", href: "/activities", icon: Calendar, module: "activities" },
            { name: "Exclusiones", href: "/activity-exclusions", icon: UserX, module: "activity_exclusions" },
            { name: "Calendarización", href: "/scheduled-activities", icon: CalendarClock, module: "scheduled_activities" },
        ],
    },
    {
        name: "Pagos",
        icon: CreditCard,
        isTab: true,
        items: [
            { name: "Registrar Movimiento", href: "/movements", icon: ArrowLeftRight, module: "movements" },
            { name: "Cuotas Mensuales", href: "/monthly-fees", icon: CreditCard, module: "monthly_fees" },
            { name: "Pagos y Devoluciones", href: "/reimbursements", icon: FileText, module: "reimbursements" },
            { name: "Notificaciones de Pago", href: "/payment-notifications", icon: Bell, module: "payment_notifications" },
        ],
    },
    {
        name: "Secretaría",
        icon: NotebookText,
        isTab: true,
        items: [
            { name: "Actas de Reunión", href: "/meeting-minutes", icon: NotebookText, allowStudent: true },
        ],
    },
    {
        name: "Administración",
        icon: UserCog,
        isTab: true,
        items: [
            { name: "Usuarios", href: "/user-management", icon: UserCog, masterOnly: true },
            { name: "Historial de Cambios", href: "/admin/audit-logs", icon: ShieldCheck, masterOnly: true },
            { name: "Formularios", href: "/formularios", icon: FileQuestion },
        ],
    },
];

export const studentNavigation: NavItem[] = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Portal de Pagos", href: "/payment-portal", icon: CreditCard },
];
