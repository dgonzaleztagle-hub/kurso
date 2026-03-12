import { ReactNode, useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { MainLayout } from "@/layouts/MainLayout";
import { StudentLayout } from "@/layouts/StudentLayout";
import { LockModal } from "./subscription/LockModal";
import { getTenantBillingState } from "@/lib/saasBilling";
import { isGuardianRole, isOwnerRole, isStaffRole } from "@/lib/roles";

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const { userRole: globalRole } = useAuth();
  const { roleInCurrentTenant, currentTenant } = useTenant();
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    if (!currentTenant) {
      setIsLocked(false);
      return;
    }

    const billingState = getTenantBillingState(currentTenant);

    // SuperAdmin Override (Global Admins typically bypass, but here we test the flow)
    // If Global Role is 'master', we might want to bypass lock to help user?
    // User Requirement: "lock de ingreso". 
    // Let's allow Master (SuperAdmin) to bypass lock to fix things if needed, or see the org.
    if (isOwnerRole(globalRole)) {
      setIsLocked(false);
    } else {
      setIsLocked(billingState.isBlocked);
    }

  }, [currentTenant, globalRole]);

    const activeRole = roleInCurrentTenant || globalRole;
  const showFullNav = isStaffRole(activeRole) && !isGuardianRole(activeRole);

  // If locked, we show the modal AND maybe hide content or just overlay?
  // User asked for "lock de ingreso". Best is to show modal and render nothing behind or blur.
  // LockModal behaves as an overlay. If we render children, user *can* inspect.
  // But for UX, seeing the dashboard behind a blur is nice.

  return (
    <>
      <LockModal
        isOpen={isLocked}
        isGracePeriod={currentTenant?.subscription_status === 'grace_period'}
      />

      {/* If locked, we could wrap children in a blur div or just let Modal cover it. 
          Dialog with modal=true traps focus. 
      */}
      {showFullNav ? (
        <MainLayout>{children}</MainLayout>
      ) : (
        <StudentLayout>{children}</StudentLayout>
      )}
    </>
  );
};

