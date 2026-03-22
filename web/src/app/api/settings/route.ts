import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase/server";

/**
 * GET /api/settings?key=ocr_model
 * Returns the current value of a system setting.
 */
export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key");
  if (!key) {
    return NextResponse.json({ error: "Missing key" }, { status: 400 });
  }

  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from("system_settings")
    .select("value, updated_at")
    .eq("key", key)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Setting not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}

/**
 * PUT /api/settings
 * Body: { key: "ocr_model", value: "gemini" }
 * Only admins can update settings.
 */
export async function PUT(request: NextRequest) {
  const { key, value } = await request.json();

  if (!key || !value) {
    return NextResponse.json({ error: "Missing key or value" }, { status: 400 });
  }

  // Verify the user is an admin
  const serverSupabase = await createServerSupabase();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const adminSupabase = createAdminSupabase();

  const { data: admin } = await adminSupabase
    .from("admins")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (!admin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  // Upsert the setting
  const { data, error } = await adminSupabase
    .from("system_settings")
    .upsert(
      {
        key,
        value,
        updated_at: new Date().toISOString(),
        updated_by: admin.id,
      },
      { onConflict: "key" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
