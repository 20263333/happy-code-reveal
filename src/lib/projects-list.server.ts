import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type ProjectClient = SupabaseClient<Database>;

function readError(stage: string, error: { code?: string; message: string }): Error {
  console.error(`[projects-list:${stage}]`, error.code, error.message);
  const code = error.code;
  if (code === "42703" || code === "42P01" || code === "PGRST204") {
    return new Error("Сохтори лоиҳаҳо дар сервер нав нашудааст. Фармони ҳамоҳангсозии базаро иҷро кунед.");
  }
  if (code === "42501") {
    return new Error("Иҷозати хондани лоиҳаҳо дар сервер нопурра аст. Қоидаҳои дастрасии базаро навсозӣ кунед.");
  }
  return new Error("Рӯйхати лоиҳаҳо бор нашуд. Дубора кӯшиш кунед; агар такрор шавад, сабти [projects-list] дар серверро санҷед.");
}

// All reads use the verified user's client; listing must not require an admin key.
export async function loadCompanyProjects(supabase: ProjectClient, userId: string) {
  const [profile, owned] = await Promise.all([
    supabase.from("profiles").select("company_id").eq("id", userId).maybeSingle(),
    supabase.from("companies").select("id").eq("owner_user_id", userId).maybeSingle(),
  ]);
  if (profile.error) throw readError("profile", profile.error);
  if (owned.error) throw readError("company", owned.error);
  const companyId = profile.data?.company_id ?? owned.data?.id;
  // Never issue an unscoped query when company identity cannot be resolved.
  if (!companyId) throw new Error("Шумо ҳоло ба ягон ширкат тааллуқ надоред.");

  const { data: roots, error } = await supabase.from("projects")
    .select("id, name, location, status, cover_url, created_at, company_id")
    .eq("company_id", companyId).is("parent_id", null)
    .order("created_at", { ascending: true });
  if (error) throw readError("projects", error);
  const projects = (roots ?? []).filter((project) => project.company_id === companyId);
  if (!projects.length) return [];

  const { data: children, error: childrenError } = await supabase.from("projects")
    .select("id, parent_id").eq("company_id", companyId)
    .in("parent_id", projects.map((project) => project.id));
  let statsAvailable = !childrenError;
  if (childrenError) console.error("[projects-list:blocks]", childrenError.code, childrenError.message);
  const childIds = (children ?? []).map((child) => child.id);
  let apartments: { project_id: string; status: string }[] = [];
  if (childIds.length) {
    const result = await supabase.from("apartments").select("project_id, status").in("project_id", childIds);
    if (result.error) {
      statsAvailable = false;
      console.error("[projects-list:apartments]", result.error.code, result.error.message);
    } else apartments = result.data ?? [];
  }

  const paths = projects.map((project) => project.cover_url)
    .filter((path): path is string => !!path && !path.startsWith("http"));
  const covers: Record<string, string> = {};
  if (paths.length) {
    try {
      const { data: signed } = await supabase.storage.from("project-covers").createSignedUrls(paths, 60 * 60 * 6);
      for (const item of signed ?? []) {
        if (item.path && item.signedUrl) covers[item.path] = item.signedUrl;
      }
    } catch {
      // Photos are optional; the browser can retry signing them independently.
    }
  }
  return projects.map((project) => ({
    ...project,
    stats_available: statsAvailable,
    cover_signed_url: project.cover_url?.startsWith("http")
      ? project.cover_url : covers[project.cover_url ?? ""] ?? null,
    children: (children ?? []).filter((child) => child.parent_id === project.id).map((child) => ({
      id: child.id,
      apartments: apartments.filter((apartment) => apartment.project_id === child.id),
    })),
  }));
}