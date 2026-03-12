import type { StudentDashboardScheduledActivity } from "@/hooks/useStudentDashboardData";

export const getVisibleUpcomingActivities = (
  activities: StudentDashboardScheduledActivity[],
  upcomingActivities: StudentDashboardScheduledActivity[],
) => {
  const merged = new Map<string, StudentDashboardScheduledActivity>();
  [...activities, ...upcomingActivities].forEach((activity) => {
    merged.set(activity.id, activity);
  });

  return Array.from(merged.values())
    .filter((activity) => !activity.completed)
    .sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime());
};
