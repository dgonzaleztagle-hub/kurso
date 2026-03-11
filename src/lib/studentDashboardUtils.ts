import type { StudentDashboardScheduledActivity } from "@/hooks/useStudentDashboardData";

export const getVisibleUpcomingActivities = (
  activities: StudentDashboardScheduledActivity[],
  upcomingActivities: StudentDashboardScheduledActivity[],
) => {
  const base = upcomingActivities.length > 0 ? upcomingActivities : activities;

  return base
    .filter((activity) => !activity.completed)
    .sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime());
};
