import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

/**
 * POST /api/auth/rfid
 * Body: { rfid_uid: "RFID_EMP_001" }
 *
 * Called by the kiosk daemon after reading an RFID card.
 * Only employees use the kiosk to submit receipts.
 * Returns the employee record if found.
 */
export async function POST(request: NextRequest) {
  try {
    const { rfid_uid } = await request.json();

    if (!rfid_uid) {
      return NextResponse.json(
        { error: "Missing rfid_uid" },
        { status: 400 }
      );
    }

    const supabase = createAdminSupabase();

    // Look up in employees table
    const { data: employee, error } = await supabase
      .from("employees")
      .select("id, name, email, manager_id")
      .eq("rfid_uid", rfid_uid)
      .single();

    if (employee) {
      return NextResponse.json({
        user: { ...employee, table: "employees" as const },
      });
    }

    // Also allow managers to scan (e.g. for testing or future use)
    const { data: manager } = await supabase
      .from("managers")
      .select("id, name, email")
      .eq("rfid_uid", rfid_uid)
      .single();

    if (manager) {
      return NextResponse.json({
        user: { ...manager, table: "managers" as const },
      });
    }

    return NextResponse.json(
      { error: "RFID card not recognized. Please contact IT." },
      { status: 404 }
    );
  } catch (err) {
    console.error("RFID auth error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
