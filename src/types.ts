export interface ExtractedMetadata {
  invoiceNumber?: string;
  vendorAddress?: string;
  taxAmount?: number;
  currency?: string;
  lineItems?: Array<{
    description: string;
    quantity?: number;
    unitPrice?: number;
    amount: number;
  }>;
  paymentTerms?: string;
  confidenceScore?: number;
}

export interface InvoiceRecord {
  id: string;
  vendor: string;
  amount: number;
  date: string; // YYYY-MM-DD
  category: string;
  raw_content: string;
  original_source: "Slack" | "Email" | "Pasted Text";
  invoice_number?: string;
  status: "Pending Approval" | "Approved" | "Audited" | "Flagged";
  processed_at: string; // ISO String
  extracted_metadata: ExtractedMetadata;
}

export interface AuditLog {
  id: string;
  timestamp: string; // ISO string
  action: string; // e.g. "Invoice Parsed & Created", "Record Updated", "Status Changed", "Data Exported", "Supabase Synchronized"
  user: string;
  recordId?: string;
  details: string; // text description
  changes?: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
}

export interface SupabaseConfigStatus {
  configured: boolean;
  supabaseUrl?: string;
  usingFallback: boolean;
  schemaErrorInvoices?: string | null;
  schemaErrorAuditLogs?: string | null;
}
