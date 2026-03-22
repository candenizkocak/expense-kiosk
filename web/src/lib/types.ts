export type ExpenseStatus = "pending" | "approved" | "rejected";

export type ExpenseCategory =
  | "food_dining"
  | "transportation"
  | "office_supplies"
  | "travel"
  | "accommodation"
  | "utilities"
  | "entertainment"
  | "software_subscriptions"
  | "equipment"
  | "healthcare"
  | "education"
  | "other";

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  food_dining: "Food & Dining",
  transportation: "Transportation",
  office_supplies: "Office Supplies",
  travel: "Travel",
  accommodation: "Accommodation",
  utilities: "Utilities",
  entertainment: "Entertainment",
  software_subscriptions: "Software & Subscriptions",
  equipment: "Equipment",
  healthcare: "Healthcare",
  education: "Education & Training",
  other: "Other",
};

export const CATEGORY_ICONS: Record<ExpenseCategory, string> = {
  food_dining: "🍽️",
  transportation: "🚗",
  office_supplies: "📎",
  travel: "✈️",
  accommodation: "🏨",
  utilities: "💡",
  entertainment: "🎭",
  software_subscriptions: "💻",
  equipment: "🔧",
  healthcare: "🏥",
  education: "📚",
  other: "📦",
};

export interface Manager {
  id: string;
  auth_user_id: string | null;
  rfid_uid: string;
  name: string;
  email: string;
  created_at: string;
}

export interface Employee {
  id: string;
  auth_user_id: string | null;
  rfid_uid: string;
  name: string;
  email: string;
  manager_id: string;
  created_at: string;
}

export interface Admin {
  id: string;
  auth_user_id: string | null;
  name: string;
  email: string;
  created_at: string;
}

export type UserTable = "managers" | "employees" | "admins";

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  table: UserTable;
}

export interface Expense {
  id: string;
  employee_id: string;
  merchant: string | null;
  expense_date: string | null;
  net_price: number | null;
  tax_rate: number | null;
  tax_amount: number | null;
  total_price: number | null;
  currency: string;
  category: ExpenseCategory;
  receipt_image_path: string | null;
  raw_ocr_json: OCRResult | null;
  status: ExpenseStatus;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  rejection_reason: string | null;
  payment_date: string | null;
  notes: string | null;
}

export interface ExpenseWithEmployee extends Expense {
  employee: Pick<Employee, "id" | "name" | "email">;
}

export interface OCRResult {
  merchant: string | null;
  date: string | null;
  line_items: LineItem[];
  net_price: number | null;
  tax_rate: number | null;
  tax_amount: number | null;
  total_price: number | null;
  currency: string;
  raw_text: string | null;
  confidence: number;
  model_used: string;
  error?: string;
}

export interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface RFIDScanResponse {
  uid: string;
  timestamp: string;
}

export interface CameraCaptureResponse {
  image_base64: string;
  timestamp: string;
}

export interface ExpenseFilters {
  status?: ExpenseStatus | "all";
  category?: ExpenseCategory | "all";
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  employeeId?: string;
}
