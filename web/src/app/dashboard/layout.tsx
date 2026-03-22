import { createServerSupabase } from "@/lib/supabase/server";
import { resolveUser } from "@/lib/resolve-user";
import { redirect } from "next/navigation";
import { Sidebar } from "./sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabase();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) redirect("/");

  const profile = await resolveUser(supabase, authUser.id);
  if (!profile) redirect("/");

  return (
    <div className="min-h-screen flex">
      <Sidebar profile={profile} />
      <main className="flex-1 overflow-auto">
        <div className="p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
