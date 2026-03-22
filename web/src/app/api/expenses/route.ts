import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

/**
 * POST /api/expenses
 * Body: {
 *   employee_id, image_base64,
 *   merchant, expense_date, net_price, tax_rate, tax_amount,
 *   total_price, currency, raw_ocr_json
 * }
 *
 * Called from the kiosk after the employee reviews OCR results.
 * Uses service_role to bypass RLS (trusted server-side insert).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      employee_id,
      image_base64,
      merchant,
      expense_date,
      net_price,
      tax_rate,
      tax_amount,
      total_price,
      currency,
      category,
      raw_ocr_json,
    } = body;

    if (!employee_id) {
      return NextResponse.json(
        { error: "Missing employee_id" },
        { status: 400 }
      );
    }

    const supabase = createAdminSupabase();

    // Generate expense ID first so we can use it in the storage path
    const expenseId = crypto.randomUUID();
    let receiptImagePath: string | null = null;

    // Upload receipt image to Supabase Storage
    if (image_base64) {
      const buffer = Buffer.from(image_base64, "base64");
      const storagePath = `${employee_id}/${expenseId}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("receipts")
        .upload(storagePath, buffer, {
          contentType: "image/jpeg",
          upsert: false,
        });

      if (uploadError) {
        console.error("Storage upload error:", uploadError);
        // Continue without image rather than failing the whole submission
      } else {
        receiptImagePath = storagePath;
      }
    }

    // Insert expense record
    const { data: expense, error: insertError } = await supabase
      .from("expenses")
      .insert({
        id: expenseId,
        employee_id,
        merchant: merchant || null,
        expense_date: expense_date || null,
        net_price: net_price != null ? parseFloat(net_price) : null,
        tax_rate: tax_rate != null ? parseFloat(tax_rate) : null,
        tax_amount: tax_amount != null ? parseFloat(tax_amount) : null,
        total_price: total_price != null ? parseFloat(total_price) : null,
        currency: currency || "TRY",
        category: category || "other",
        receipt_image_path: receiptImagePath,
        raw_ocr_json: raw_ocr_json || null,
        status: "pending",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Expense insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to save expense", details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ expense }, { status: 201 });
  } catch (err) {
    console.error("Create expense error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}


