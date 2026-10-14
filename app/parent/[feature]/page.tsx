import RolePortal from "../../role-portal";

const parentFeatures = new Set(["children", "results", "attendance", "syllabus", "holiday-projects", "fees", "announcements", "profile"]);

export default async function ParentFeaturePage({ params }: PageProps<"/parent/[feature]">) {
  const { feature } = await params;
  if (!parentFeatures.has(feature)) return <RolePortal role="parent" feature="not-found" />;
  return <RolePortal role="parent" feature={feature} />;
}
