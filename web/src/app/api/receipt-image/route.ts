import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

/**
 * GET /api/receipt-image?path=receipts/employee-id/expense-id.jpg
 *
 * Returns a signed URL for a private receipt image.
 * Uses the service role to bypass RLS on storage.
 */
export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get("path");

  if (!path) {
    return NextResponse.json({ error: "Missing path" }, { status: 400 });
  }

  const supabase = createAdminSupabase();

  // The DB stores the full path as used in .upload(), which is the path
  // WITHIN the bucket. Pass it directly — no stripping needed.
  const filePath = path;

  console.log("Generating signed URL for:", { bucket: "receipts", filePath });

  const { data, error } = await supabase.storage
    .from("receipts")
    .createSignedUrl(filePath, 60 * 60);

  if (error) {
    console.error("Supabase storage error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate signed URL" },
      { status: 500 }
    );
  }

  if (!data?.signedUrl) {
    return NextResponse.json(
      { error: "No signed URL returned" },
      { status: 500 }
    );
  }

  return NextResponse.json({ url: data.signedUrl });
}
