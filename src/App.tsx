import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { TenantProvider } from "./contexts/TenantContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { IndexSwitcher } from "./components/IndexSwitcher";

import Dashboard from "./pages/Dashboard";
import StudentDashboard from "./pages/StudentDashboard";
import Students from "./pages/Students";
import Income from "./pages/Income";
import Expenses from "./pages/Expenses";
import DebtReports from "./pages/DebtReports";
import PaymentReports from "./pages/PaymentReports";
import Balance from "./pages/Balance";
import AuditLogs from "./pages/admin/AuditLogs";
import MeetingMinutes from "./pages/MeetingMinutes";
import ImportData from "./pages/ImportData";
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
import Organizations from "./pages/admin/Organizations";
import OrganizationDetail from "./pages/admin/OrganizationDetail";
import TenantsList from "./pages/admin/TenantsList";
import UsersList from "./pages/admin/UsersList";
import OnboardingWizard from "./pages/onboarding/OnboardingWizard";
import { AdminLayout } from "./layouts/AdminLayout";

const queryClient = new QueryClient();

// Force Refresh Trigger
function AppRoutes() {
  // CHECK: First Login
  const { firstLogin, userRole, refreshUserData } = useAuth();
  if (firstLogin && (userRole === 'alumnos' || userRole === 'admin' || userRole === 'master')) {
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
        </Route>
      </Route>

      <Route path="/solicitud-pago-proveedor" element={<SupplierPaymentRequest />} />
      <Route path="/formulario/:id" element={<PublicForm />} />
      <Route path="/donaciones/:activityId" element={
        <ProtectedRoute allowedRoles={['alumnos']}>
          <SelectDonation />
        </ProtectedRoute>
      } />
      <Route path="/formularios" element={
        <ProtectedRoute allowedRoles={['master', 'admin']}>
          <FormList />
        </ProtectedRoute>
      } />
      <Route path="/formularios/nuevo" element={
        <ProtectedRoute allowedRoles={['master', 'admin']}>
          <FormBuilder />
        </ProtectedRoute>
      } />
      <Route path="/formularios/:id/editar" element={
        <ProtectedRoute allowedRoles={['master', 'admin']}>
          <FormBuilder />
        </ProtectedRoute>
      } />
      <Route path="/formularios/:id/respuestas" element={
        <ProtectedRoute allowedRoles={['master', 'admin']}>
          <FormResponses />
        </ProtectedRoute>
      } />
      <Route path="/onboarding" element={
        <ProtectedRoute>
          <OnboardingWizard />
        </ProtectedRoute>
      } />
      <Route path="/user-management" element={
        <ProtectedRoute allowedRoles={['master']}>
          <Layout><UserManagement /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/credit-management" element={
        <ProtectedRoute allowedRoles={['master']}>
          <Layout><CreditManagement /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/credit-movements" element={
        <ProtectedRoute allowedRoles={['master']}>
          <Layout><CreditMovements /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/student-profile" element={
        <ProtectedRoute allowedRoles={['master', 'admin']} requiredModule="student_profile">
          <Layout><StudentProfile /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/" element={<IndexSwitcher />} />
      <Route path="/dashboard" element={
        <ProtectedRoute allowedRoles={['master', 'admin', 'owner']}>
          <Layout><Dashboard /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/student-dashboard" element={
        <ProtectedRoute allowedRoles={['alumnos']}>
          <Layout><StudentDashboard /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/students" element={
        <ProtectedRoute allowedRoles={['master']} requiredModule="students">
          <Layout><Students /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/income" element={
        <ProtectedRoute allowedRoles={['master']} requiredModule="income">
          <Layout><Income /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/expenses" element={
        <ProtectedRoute allowedRoles={['master']} requiredModule="expenses">
          <Layout><Expenses /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/debt-reports" element={
        <ProtectedRoute allowedRoles={['master', 'admin']} requiredModule="debt_reports">
          <Layout><DebtReports /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/payment-reports" element={
        <ProtectedRoute allowedRoles={['master', 'admin']} requiredModule="payment_reports">
          <Layout><PaymentReports /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/balance" element={
        <ProtectedRoute allowedRoles={['master']} requiredModule="balance">
          <Layout><Balance /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/import" element={
        <ProtectedRoute allowedRoles={['master']} requiredModule="import">
          <Layout><ImportData /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/movements" element={
        <ProtectedRoute allowedRoles={['master']} requiredModule="movements">
          <Layout><Movements /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/activities" element={
        <ProtectedRoute allowedRoles={['master']} requiredModule="activities">
          <Layout><Activities /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/activity-exclusions" element={
        <ProtectedRoute allowedRoles={['master', 'admin']} requiredModule="activity_exclusions">
          <Layout><ActivityExclusions /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/activity-payments" element={
        <ProtectedRoute allowedRoles={['master']} requiredModule="activity_payments">
          <Layout><ActivityPayments /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/monthly-fees" element={
        <ProtectedRoute allowedRoles={['master']} requiredModule="monthly_fees">
          <Layout><MonthlyFees /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/payment-portal" element={
        <ProtectedRoute allowedRoles={['alumnos']}>
          <Layout><PaymentPortal /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/payment-notifications" element={
        <ProtectedRoute allowedRoles={['master', 'admin']} requiredModule="payment_notifications">
          <Layout><PaymentNotifications /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/reimbursements" element={
        <ProtectedRoute allowedRoles={['master', 'admin']} requiredModule="reimbursements">
          <Layout><Reimbursements /></Layout>
        </ProtectedRoute>
      } />
      <Route path="/scheduled-activities" element={
        <ProtectedRoute allowedRoles={['master', 'admin']} requiredModule="scheduled_activities">
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
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}


const App = () => (
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
);

export default App;
