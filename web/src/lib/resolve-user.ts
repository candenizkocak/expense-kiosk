import { SupabaseClient } from "@supabase/supabase-js";
import type { AuthenticatedUser } from "@/lib/types";

/**
 * Resolve a Supabase auth user into admin, manager, or employee.
 * Checks admins first (highest privilege), then managers, then employees.
 */
export async function resolveUser(
  supabase: SupabaseClient,
  authUserId: string
): Promise<AuthenticatedUser | null> {
  // Check admins first
  const { data: admin } = await supabase
    .from("admins")
    .select("id, name, email")
    .eq("auth_user_id", authUserId)
    .single();

  if (admin) {
    return { id: admin.id, name: admin.name, email: admin.email, table: "admins" };
  }

  // Then managers
  const { data: manager } = await supabase
    .from("managers")
    .select("id, name, email")
    .eq("auth_user_id", authUserId)
    .single();

  if (manager) {
    return { id: manager.id, name: manager.name, email: manager.email, table: "managers" };
  }

  // Then employees
  const { data: employee } = await supabase
    .from("employees")
    .select("id, name, email")
    .eq("auth_user_id", authUserId)
    .single();

  if (employee) {
    return { id: employee.id, name: employee.name, email: employee.email, table: "employees" };
  }

  return null;
}
