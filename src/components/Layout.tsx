import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { MainLayout } from "@/layouts/MainLayout";
import { StudentLayout } from "@/layouts/StudentLayout";

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const { userRole: globalRole } = useAuth();
  const { roleInCurrentTenant } = useTenant();

  const activeRole = roleInCurrentTenant || globalRole;

  // Owners, Admins and Masters see the full App
  const showFullNav = activeRole === 'admin' || activeRole === 'master' || activeRole === 'owner';

  if (showFullNav) {
    return <MainLayout>{children}</MainLayout>;
  }

  // Fallback to student layout
  return <StudentLayout>{children}</StudentLayout>;
};

