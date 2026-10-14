import RolePortal from "../../role-portal";

const studentFeatures = new Set(["results", "attendance", "timetable", "syllabus", "holiday-projects", "fees", "announcements", "profile"]);

export default async function StudentFeaturePage({ params }: PageProps<"/student/[feature]">) {
  const { feature } = await params;
  if (!studentFeatures.has(feature)) return <RolePortal role="student" feature="not-found" />;
  return <RolePortal role="student" feature={feature} />;
}
