import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { TenantProvider } from "./contexts/TenantContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { IndexSwitcher } from "./components/IndexSwitcher";
import { HelmetProvider } from "react-helmet-async";
import { AdminRoute } from "./components/AdminRoute";
import { AdminLayout } from "./layouts/AdminLayout";
import { MobileLayout } from "./components/layouts/MobileLayout";
import { isGuardianRole } from "./lib/roles";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Students = lazy(() => import("./pages/Students"));
const Income = lazy(() => import("./pages/Income"));
const Expenses = lazy(() => import("./pages/Expenses"));
const DebtReports = lazy(() => import("./pages/DebtReports"));
const PaymentReports = lazy(() => import("./pages/PaymentReports"));
const Balance = lazy(() => import("./pages/Balance"));
const AuditLogs = lazy(() => import("./pages/admin/AuditLogs"));
const MeetingMinutes = lazy(() => import("./pages/MeetingMinutes"));
const ImportData = lazy(() => import("./pages/ImportData"));
const HistoricalSetup = lazy(() => import("./pages/HistoricalSetup"));
const Movements = lazy(() => import("./pages/Movements"));
const Activities = lazy(() => import("./pages/Activities"));
const ActivityExclusions = lazy(() => import("./pages/ActivityExclusions"));
const ActivityPayments = lazy(() => import("./pages/ActivityPayments"));
const MonthlyFees = lazy(() => import("./pages/MonthlyFees"));
const Auth = lazy(() => import("./pages/Auth"));
const UserManagement = lazy(() => import("./pages/UserManagement"));
const PaymentPortal = lazy(() => import("./pages/PaymentPortal"));
const PaymentNotifications = lazy(() => import("./pages/PaymentNotifications"));
const Reimbursements = lazy(() => import("./pages/Reimbursements"));
const ScheduledActivities = lazy(() => import("./pages/ScheduledActivities"));
const SupplierPaymentRequest = lazy(() => import("./pages/SupplierPaymentRequest"));
const PostManagement = lazy(() => import("./pages/PostManagement"));
const TenantBranding = lazy(() => import("./pages/TenantBranding"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const BillingSuccess = lazy(() => import("./pages/BillingSuccess"));
const BillingPending = lazy(() => import("./pages/BillingPending"));
const BillingFailure = lazy(() => import("./pages/BillingFailure"));
const TesoreriaCurso = lazy(() => import("./pages/servicios/TesoreriaCurso"));
const CentrosPadres = lazy(() => import("./pages/servicios/CentrosPadres"));
const ImplementacionExitosa = lazy(() => import("./pages/casos/ImplementacionExitosa"));
const CreditManagement = lazy(() => import("./pages/CreditManagement"));
const CreditMovements = lazy(() => import("./pages/CreditMovements"));
const StudentProfile = lazy(() => import("./pages/StudentProfile"));
const SelectDonation = lazy(() => import("./pages/SelectDonation"));
const FirstLoginPasswordChange = lazy(() => import("./components/FirstLoginPasswordChange"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const PrivacyChoices = lazy(() => import("./pages/PrivacyChoices"));
const Support = lazy(() => import("./pages/Support"));
const SupportInbox = lazy(() => import("./pages/SupportInbox"));
const AccountSettings = lazy(() => import("./pages/AccountSettings"));
const FormList = lazy(() => import("./pages/FormList"));
const FormBuilder = lazy(() => import("./pages/FormBuilder"));
const FormResponses = lazy(() => import("./pages/FormResponses"));
const PublicForm = lazy(() => import("./pages/PublicForm"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const YearRolloverWizard = lazy(() => import("./pages/admin/YearRolloverWizard"));
const Organizations = lazy(() => import("./pages/admin/Organizations"));
const OrganizationDetail = lazy(() => import("./pages/admin/OrganizationDetail"));
const CloseYear = lazy(() => import("./pages/admin/CloseYear"));
const TenantsList = lazy(() => import("./pages/admin/TenantsList"));
const UsersList = lazy(() => import("./pages/admin/UsersList"));
const SaasBilling = lazy(() => import("./pages/admin/SaasBilling"));
const SupportTickets = lazy(() => import("./pages/admin/SupportTickets"));
const OnboardingWizard = lazy(() => import("./pages/onboarding/OnboardingWizard"));
const MobileFinances = lazy(() => import("./pages/mobile/MobileFinances"));
const MobileAgenda = lazy(() => import("./pages/mobile/MobileAgenda"));
const MobileActas = lazy(() => import("./pages/mobile/MobileActas"));
const MobileBoard = lazy(() => import("./pages/mobile/MobileBoard"));
const MobileProfile = lazy(() => import("./pages/mobile/MobileProfile"));

const queryClient = new QueryClient();

// Force Refresh Trigger
function AppRoutes() {
  // CHECK: First Login
  const { firstLogin, userRole, refreshUserData } = useAuth();
  if (firstLogin && (isGuardianRole(userRole) || userRole === 'staff' || userRole === 'owner')) {
    return <FirstLoginPasswordChange onPasswordChanged={refreshUserData} />;
  }

  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Cargando...</p>
        </div>
      </div>
    }>
      <Routes>
        <Route path="/auth" element={<Auth />} />

      {/* SuperAdmin Routes */}
      <Route element={<AdminRoute />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/organizations" element={<Organizations />} />
          <Route path="/admin/organizations/:id" element={<OrganizationDetail />} />
          <Route path="/admin/tenants" element={<TenantsList />} />
          <Route path="/admin/users" element={<UsersList />} />
          <Route path="/admin/billing" element={<SaasBilling />} />
          <Route path="/admin/support" element={<SupportTickets />} />
        </Route>
      </Route>

      {/* Tenant Admin Routes */}
      <Route path="/close-year" element={
        <ProtectedRoute allowedRoles={['owner', 'staff']}>
          <Layout>
            <CloseYear />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/solicitud-pago-proveedor" element={<SupplierPaymentRequest />} />
      <Route path="/privacidad" element={<PrivacyPolicy />} />
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      <Route path="/privacy-choices" element={<PrivacyChoices />} />
      <Route path="/soporte" element={<Support />} />
      <Route path="/support" element={<Support />} />
      <Route path="/support/inbox" element={
        <ProtectedRoute allowedRoles={['owner', 'staff', 'guardian']}>
          <Layout><SupportInbox /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/blog" element={<Blog />} />
      <Route path="/blog/:slug" element={<BlogPost />} />
      <Route path="/pago-exitoso" element={<BillingSuccess />} />
      <Route path="/pago-pendiente" element={<BillingPending />} />
      <Route path="/pago-fallido" element={<BillingFailure />} />
      <Route path="/servicios/tesoreria-de-curso" element={<TesoreriaCurso />} />
      <Route path="/servicios/gestion-centros-de-padres" element={<CentrosPadres />} />
      <Route path="/casos/transparencia-total-colegio-chile" element={<ImplementacionExitosa />} />
      <Route path="/formulario/:id" element={<PublicForm />} />
      <Route path="/donaciones/:activityId" element={
        <ProtectedRoute allowedRoles={['guardian']}>
          <SelectDonation />
        </ProtectedRoute>
      } />
      <Route path="/formularios" element={
        <ProtectedRoute allowedRoles={['owner', 'staff']}>
          <FormList />
        </ProtectedRoute>
      } />
      <Route path="/formularios/nuevo" element={
        <ProtectedRoute allowedRoles={['owner', 'staff']}>
          <FormBuilder />
        </ProtectedRoute>
      } />
      <Route path="/formularios/:id/editar" element={
        <ProtectedRoute allowedRoles={['owner', 'staff']}>
          <FormBuilder />
        </ProtectedRoute>
      } />
      <Route path="/formularios/:id/respuestas" element={
        <ProtectedRoute allowedRoles={['owner', 'staff']}>
          <FormResponses />
        </ProtectedRoute>
      } />
      <Route path="/onboarding" element={
        <ProtectedRoute>
          <OnboardingWizard />
        </ProtectedRoute>
      } />
      <Route path="/user-management" element={
        <ProtectedRoute allowedRoles={['owner', 'staff']}>
          <Layout><UserManagement /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/mi-cuenta" element={
        <ProtectedRoute>
          <Layout><AccountSettings /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/branding" element={
        <ProtectedRoute allowedRoles={['owner', 'staff']}>
          <Layout><TenantBranding /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/credit-management" element={
        <ProtectedRoute allowedRoles={['owner', 'staff']} requiredModule="credit_management">
          <Layout><CreditManagement /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/credit-movements" element={
        <ProtectedRoute allowedRoles={['owner', 'staff']} requiredModule="credit_movements">
          <Layout><CreditMovements /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/student-profile" element={
        <ProtectedRoute allowedRoles={['owner', 'staff']} requiredModule="student_profile">
          <Layout><StudentProfile /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/" element={<IndexSwitcher />} />
      <Route path="/admin/rollover" element={
        <ProtectedRoute allowedRoles={['owner', 'staff']}>
          <YearRolloverWizard />
        </ProtectedRoute>
      } />
      <Route path="/dashboard" element={
        <ProtectedRoute allowedRoles={['owner', 'staff']} requiredModule="dashboard">
          <Layout><Dashboard /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/student-dashboard" element={
        <ProtectedRoute allowedRoles={['guardian']}>
          <Navigate to="/mobile/board" replace />
        </ProtectedRoute>
      } />

      <Route path="/students" element={
        <ProtectedRoute allowedRoles={['owner', 'staff']} requiredModule="students">
          <Layout><Students /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/income" element={
        <ProtectedRoute allowedRoles={['owner', 'staff']} requiredModule="income">
          <Layout><Income /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/expenses" element={
        <ProtectedRoute allowedRoles={['owner', 'staff']} requiredModule="expenses">
          <Layout><Expenses /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/debt-reports" element={
        <ProtectedRoute allowedRoles={['owner', 'staff']} requiredModule="debt_reports">
          <Layout><DebtReports /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/payment-reports" element={
        <ProtectedRoute allowedRoles={['owner', 'staff']} requiredModule="payment_reports">
          <Layout><PaymentReports /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/balance" element={
        <ProtectedRoute allowedRoles={['owner', 'staff']} requiredModule="balance">
          <Layout><Balance /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/import" element={
        <ProtectedRoute allowedRoles={['owner', 'staff']} requiredModule="import">
          <Layout><ImportData /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/historical-setup" element={
        <ProtectedRoute allowedRoles={['owner', 'staff']}>
          <Layout><HistoricalSetup /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/movements" element={
        <ProtectedRoute allowedRoles={['owner', 'staff']} requiredModule="movements">
          <Layout><Movements /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/activities" element={
        <ProtectedRoute allowedRoles={['owner', 'staff']} requiredModule="activities">
          <Layout><Activities /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/activity-exclusions" element={
        <ProtectedRoute allowedRoles={['owner', 'staff']} requiredModule="activity_exclusions">
          <Layout><ActivityExclusions /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/activity-payments" element={
        <ProtectedRoute allowedRoles={['owner', 'staff']} requiredModule="activity_payments">
          <Layout><ActivityPayments /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/monthly-fees" element={
        <ProtectedRoute allowedRoles={['owner', 'staff']} requiredModule="monthly_fees">
          <Layout><MonthlyFees /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/payment-portal" element={
        <ProtectedRoute allowedRoles={['guardian']}>
          <Navigate to="/mobile/payment-portal" replace />
        </ProtectedRoute>
      } />
      <Route path="/payment-notifications" element={
        <ProtectedRoute allowedRoles={['owner', 'staff']} requiredModule="payment_notifications">
          <Layout><PaymentNotifications /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/reimbursements" element={
        <ProtectedRoute allowedRoles={['owner', 'staff']} requiredModule="reimbursements">
          <Layout><Reimbursements /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/scheduled-activities" element={
        <ProtectedRoute allowedRoles={['owner', 'staff']} requiredModule="scheduled_activities">
          <Layout><ScheduledActivities /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/admin/audit-logs" element={
        <ProtectedRoute allowedRoles={['owner', 'staff']}>
          <Layout><AuditLogs /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/meeting-minutes" element={
        <ProtectedRoute allowedRoles={['owner', 'staff', 'guardian']}>
          <Layout><MeetingMinutes /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/posts" element={
        <ProtectedRoute allowedRoles={['owner', 'staff']}>
          <Layout><PostManagement /></Layout>
        </ProtectedRoute>
      } />

      {/* STITCH MOBILE ROUTES */}
      <Route path="/mobile" element={
        <ProtectedRoute allowedRoles={['guardian']}>
          <MobileLayout />
        </ProtectedRoute>
      }>
        <Route index element={<MobileBoard />} />
        <Route path="board" element={<MobileBoard />} />
        <Route path="finances" element={<MobileFinances />} />
        <Route path="agenda" element={<MobileAgenda />} />
        <Route path="actas" element={<MobileActas />} />
        <Route path="profile" element={<MobileProfile />} />
        <Route path="payment-portal" element={<PaymentPortal />} />
      </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}


const App = () => (
  <HelmetProvider>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <TenantProvider>
                <AppRoutes />
              </TenantProvider>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </HelmetProvider>
);

export default App;
