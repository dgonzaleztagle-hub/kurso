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

import Dashboard from "./pages/Dashboard";
import Students from "./pages/Students";
import Income from "./pages/Income";
import Expenses from "./pages/Expenses";
import DebtReports from "./pages/DebtReports";
import PaymentReports from "./pages/PaymentReports";
import Balance from "./pages/Balance";
import AuditLogs from "./pages/admin/AuditLogs";
import MeetingMinutes from "./pages/MeetingMinutes";
import ImportData from "./pages/ImportData";
import HistoricalSetup from "./pages/HistoricalSetup";
import Movements from "./pages/Movements";
import Activities from "./pages/Activities";
import ActivityExclusions from "./pages/ActivityExclusions";
import ActivityPayments from "./pages/ActivityPayments";
import MonthlyFees from "./pages/MonthlyFees";
import Auth from "./pages/Auth";
import UserManagement from "./pages/UserManagement";
import PaymentPortal from "./pages/PaymentPortal";
import PaymentNotifications from "./pages/PaymentNotifications";
import Reimbursements from "./pages/Reimbursements";
import ScheduledActivities from "./pages/ScheduledActivities";
import SupplierPaymentRequest from "./pages/SupplierPaymentRequest";
import PostManagement from "./pages/PostManagement";
import TenantBranding from "./pages/TenantBranding";
import Blog from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import BillingSuccess from "./pages/BillingSuccess";
import BillingPending from "./pages/BillingPending";
import BillingFailure from "./pages/BillingFailure";
import TesoreriaCurso from "./pages/servicios/TesoreriaCurso";
import CentrosPadres from "./pages/servicios/CentrosPadres";
import ImplementacionExitosa from "./pages/casos/ImplementacionExitosa";

import CreditManagement from "./pages/CreditManagement";
import CreditMovements from "./pages/CreditMovements";
import StudentProfile from "./pages/StudentProfile";
import SelectDonation from "./pages/SelectDonation";
import FirstLoginPasswordChange from "./components/FirstLoginPasswordChange";
import NotFound from "./pages/NotFound";
import FormList from "./pages/FormList";
import FormBuilder from "./pages/FormBuilder";
import FormResponses from "./pages/FormResponses";
import PublicForm from "./pages/PublicForm";
import { AdminRoute } from "./components/AdminRoute";
import AdminDashboard from "./pages/admin/AdminDashboard";
import YearRolloverWizard from "./pages/admin/YearRolloverWizard";
import Organizations from "./pages/admin/Organizations";
import OrganizationDetail from "./pages/admin/OrganizationDetail";
import CloseYear from "./pages/admin/CloseYear";
import TenantsList from "./pages/admin/TenantsList";
import UsersList from "./pages/admin/UsersList";
import SaasBilling from "./pages/admin/SaasBilling";
import OnboardingWizard from "./pages/onboarding/OnboardingWizard";
import { AdminLayout } from "./layouts/AdminLayout";

import { MobileLayout } from "./components/layouts/MobileLayout";
import MobileFinances from "./pages/mobile/MobileFinances";
import MobileAgenda from "./pages/mobile/MobileAgenda";
import MobileActas from "./pages/mobile/MobileActas";
import MobileBoard from "./pages/mobile/MobileBoard";
import MobileProfile from "./pages/mobile/MobileProfile";

const queryClient = new QueryClient();

// Force Refresh Trigger
function AppRoutes() {
  // CHECK: First Login
  const { firstLogin, userRole, refreshUserData } = useAuth();
  if (firstLogin && (userRole === 'alumnos' || userRole === 'admin' || userRole === 'master' || userRole === 'owner')) {
    return <FirstLoginPasswordChange onPasswordChanged={refreshUserData} />;
  }

  return (
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
        </Route>
      </Route>

      {/* Tenant Admin Routes */}
      <Route path="/close-year" element={
        <ProtectedRoute allowedRoles={['owner', 'master', 'admin']}>
          <Layout>
            <CloseYear />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/solicitud-pago-proveedor" element={<SupplierPaymentRequest />} />
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
        <ProtectedRoute allowedRoles={['alumnos']}>
          <SelectDonation />
        </ProtectedRoute>
      } />
      <Route path="/formularios" element={
        <ProtectedRoute allowedRoles={['master', 'admin', 'owner']}>
          <FormList />
        </ProtectedRoute>
      } />
      <Route path="/formularios/nuevo" element={
        <ProtectedRoute allowedRoles={['master', 'admin', 'owner']}>
          <FormBuilder />
        </ProtectedRoute>
      } />
      <Route path="/formularios/:id/editar" element={
        <ProtectedRoute allowedRoles={['master', 'admin', 'owner']}>
          <FormBuilder />
        </ProtectedRoute>
      } />
      <Route path="/formularios/:id/respuestas" element={
        <ProtectedRoute allowedRoles={['master', 'admin', 'owner']}>
          <FormResponses />
        </ProtectedRoute>
      } />
      <Route path="/onboarding" element={
        <ProtectedRoute>
          <OnboardingWizard />
        </ProtectedRoute>
      } />
      <Route path="/user-management" element={
        <ProtectedRoute allowedRoles={['master', 'owner']}>
          <Layout><UserManagement /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/branding" element={
        <ProtectedRoute allowedRoles={['master', 'admin', 'owner']}>
          <Layout><TenantBranding /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/credit-management" element={
        <ProtectedRoute allowedRoles={['master', 'admin', 'owner']}>
          <Layout><CreditManagement /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/credit-movements" element={
        <ProtectedRoute allowedRoles={['master', 'admin', 'owner']}>
          <Layout><CreditMovements /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/student-profile" element={
        <ProtectedRoute allowedRoles={['master', 'admin', 'owner']} requiredModule="student_profile">
          <Layout><StudentProfile /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/" element={<IndexSwitcher />} />
      <Route path="/admin/rollover" element={
        <ProtectedRoute allowedRoles={['owner', 'master', 'admin']}>
          <YearRolloverWizard />
        </ProtectedRoute>
      } />
      <Route path="/dashboard" element={
        <ProtectedRoute allowedRoles={['master', 'admin', 'owner']}>
          <Layout><Dashboard /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/student-dashboard" element={
        <ProtectedRoute allowedRoles={['alumnos']}>
          <Navigate to="/mobile/board" replace />
        </ProtectedRoute>
      } />

      <Route path="/students" element={
        <ProtectedRoute allowedRoles={['master', 'admin', 'owner']} requiredModule="students">
          <Layout><Students /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/income" element={
        <ProtectedRoute allowedRoles={['master', 'admin', 'owner']} requiredModule="income">
          <Layout><Income /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/expenses" element={
        <ProtectedRoute allowedRoles={['master', 'admin', 'owner']} requiredModule="expenses">
          <Layout><Expenses /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/debt-reports" element={
        <ProtectedRoute allowedRoles={['master', 'admin', 'owner']} requiredModule="debt_reports">
          <Layout><DebtReports /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/payment-reports" element={
        <ProtectedRoute allowedRoles={['master', 'admin', 'owner']} requiredModule="payment_reports">
          <Layout><PaymentReports /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/balance" element={
        <ProtectedRoute allowedRoles={['master', 'admin', 'owner']} requiredModule="balance">
          <Layout><Balance /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/import" element={
        <ProtectedRoute allowedRoles={['master', 'admin', 'owner']} requiredModule="import">
          <Layout><ImportData /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/historical-setup" element={
        <ProtectedRoute allowedRoles={['master', 'admin', 'owner']}>
          <Layout><HistoricalSetup /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/movements" element={
        <ProtectedRoute allowedRoles={['master', 'admin', 'owner']} requiredModule="movements">
          <Layout><Movements /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/activities" element={
        <ProtectedRoute allowedRoles={['master', 'admin', 'owner']} requiredModule="activities">
          <Layout><Activities /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/activity-exclusions" element={
        <ProtectedRoute allowedRoles={['master', 'admin', 'owner']} requiredModule="activity_exclusions">
          <Layout><ActivityExclusions /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/activity-payments" element={
        <ProtectedRoute allowedRoles={['master', 'admin', 'owner']} requiredModule="activity_payments">
          <Layout><ActivityPayments /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/monthly-fees" element={
        <ProtectedRoute allowedRoles={['master', 'admin', 'owner']} requiredModule="monthly_fees">
          <Layout><MonthlyFees /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/payment-portal" element={
        <ProtectedRoute allowedRoles={['alumnos']}>
          <Navigate to="/mobile/payment-portal" replace />
        </ProtectedRoute>
      } />
      <Route path="/payment-notifications" element={
        <ProtectedRoute allowedRoles={['master', 'admin', 'owner']} requiredModule="payment_notifications">
          <Layout><PaymentNotifications /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/reimbursements" element={
        <ProtectedRoute allowedRoles={['master', 'admin', 'owner']} requiredModule="reimbursements">
          <Layout><Reimbursements /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/scheduled-activities" element={
        <ProtectedRoute allowedRoles={['master', 'admin', 'owner']} requiredModule="scheduled_activities">
          <Layout><ScheduledActivities /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/admin/audit-logs" element={
        <ProtectedRoute allowedRoles={['master', 'owner', 'admin']}>
          <Layout><AuditLogs /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/meeting-minutes" element={
        <ProtectedRoute allowedRoles={['master', 'owner', 'admin', 'alumnos']}>
          <Layout><MeetingMinutes /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/posts" element={
        <ProtectedRoute allowedRoles={['master', 'owner', 'admin']}>
          <Layout><PostManagement /></Layout>
        </ProtectedRoute>
      } />

      {/* STITCH MOBILE ROUTES */}
      <Route path="/mobile" element={
        <ProtectedRoute allowedRoles={['alumnos']}>
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
