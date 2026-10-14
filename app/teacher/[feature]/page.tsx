import RolePortal from "../../role-portal";

const teacherFeatures = new Set(["classes", "attendance", "results", "syllabus", "holiday-projects", "announcements", "profile"]);

export default async function TeacherFeaturePage({ params }: PageProps<"/teacher/[feature]">) {
  const { feature } = await params;
  if (!teacherFeatures.has(feature)) return <RolePortal role="teacher" feature="not-found" />;
  return <RolePortal role="teacher" feature={feature} />;
}
