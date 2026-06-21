import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  FileText, 
  UploadCloud, 
  RefreshCw, 
  Database, 
  Edit2, 
  Save, 
  X, 
  Download, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldCheck, 
  Clipboard, 
  Sparkles, 
  ChevronDown, 
  ChevronUp, 
  Trash2, 
  ArrowUpDown, 
  Printer, 
  HelpCircle,
  Clock,
  History,
  Info
} from "lucide-react";
import { InvoiceRecord, AuditLog, SupabaseConfigStatus } from "./types";

export default function App() {
  // Application states
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [configStatus, setConfigStatus] = useState<SupabaseConfigStatus>({
    configured: false,
    usingFallback: true
  });
  
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [parsingState, setParsingState] = useState<"idle" | "parsing" | "saving" | "error">("idle");
  const [parsingError, setParsingError] = useState<string | null>(null);
  
  // OCR Form States
  const [rawPastedText, setRawPastedText] = useState("");
  const [originalSource, setOriginalSource] = useState<"Slack" | "Email" | "Pasted Text">("Pasted Text");
  
  // Selected Invoice for side details view
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  
  // Editing state - tracks raw fields of modifying items by ID
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<InvoiceRecord>>({});
  
  // Search, Filtering, and Sorting States
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<keyof InvoiceRecord>("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  
  // Modal for report preview / printable ledger
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"ledger" | "audit">("ledger");

  const [showSupabaseModal, setShowSupabaseModal] = useState(false);
  const [sqlCopySuccess, setSqlCopySuccess] = useState(false);

  // User credentials
  const financeUser = "yadagiri.fde9@gmail.com";

  // Quick Demo Presets
  const demoPresets = [
    {
      name: "Slack: Zoom Receipt",
      source: "Slack" as const,
      text: `@finance-bot Slack Billing Bridge: Zoom Video Communications Inc.\nTransaction Reference: ZM-89104-2026\nCharge Date: June 19, 2026\nAmount: $149.90 USD\nLicense Category: Enterprise Pro Video Suite (15 active seats)\nStatus: Approved automatically by team lead.`
    },
    {
      name: "Email: Database Billing",
      source: "Email" as const,
      text: `From: Supabase Support <billing@supabase.co>\nTo: yadagiri.fde9@gmail.com\nSubject: Your Monthly Invoice INV-SUB-2026-9081\nDate: June 17, 2026\nItems:\n- Team Tier Organization Subscription: $25.00\n- Overages (Database Storage 40GB): $10.00\n- Compute Add-on (Small instance): $30.00\nSubtotal: $65.00\nTax VAT (15%): $9.75\nGrand Total: $74.75 USD charged to Visa card ending in *9011.`
    },
    {
      name: "Logistics: Fedex Delivery",
      source: "Pasted Text" as const,
      text: `FEDEX EXPRESS OFFICE INVOICE\nBill Date: June 12, 2026\nTracking #90218-A\nVendor: FedEx Ground Express\nInternal PO: PO-90821-XP\nCategory: Shipping/Freight Logistics\nTotal Charge due: $45.20\nPayment Terms: Due Net 15 days.`
    }
  ];

  // Fetch initial data
  const fetchData = async () => {
    setLoadingInvoices(true);
    try {
      // Config status
      const statusRes = await fetch("/api/status");
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setConfigStatus(statusData);
      }
      
      // Invoices
      const invoicesRes = await fetch("/api/invoices");
      if (invoicesRes.ok) {
        const invoicesData = await invoicesRes.json();
        setInvoices(invoicesData);
      }

      // Audit logs
      const auditsRes = await fetch("/api/audit-logs");
      if (auditsRes.ok) {
        const auditsData = await auditsRes.json();
        setAuditLogs(auditsData);
      }
    } catch (err) {
      console.error("Error loading application states:", err);
    } finally {
      setLoadingInvoices(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleApplyPreset = (text: string, src: "Slack" | "Email" | "Pasted Text") => {
    setRawPastedText(text);
    setOriginalSource(src);
  };

  // OCR Parsing via server-side Gemini API
  const handleParseOCRData = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawPastedText.trim()) return;

    setParsingState("parsing");
    setParsingError(null);

    try {
      // 1. Call Gemini parser
      const parseResponse = await fetch("/api/parse-raw", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-finance-user": financeUser
        },
        body: JSON.stringify({
          content: rawPastedText,
          source: originalSource
        })
      });

      if (!parseResponse.ok) {
        throw new Error("Gemini receipt parsing api returned an error.");
      }

      const parsedData = await parseResponse.json();

      setParsingState("saving");

      // Handle both array responses and single object responses for absolute safety
      const parsedInvoices = Array.isArray(parsedData) ? parsedData : [parsedData];
      const newlySavedRecords: InvoiceRecord[] = [];

      for (const item of parsedInvoices) {
        const newInvoice: InvoiceRecord = {
          id: "rec_" + Math.random().toString(36).substr(2, 9) + "_" + Date.now(),
          vendor: item.vendor || "Unknown Vendor",
          amount: Number(item.amount) || 0.0,
          date: item.date || new Date().toISOString().substring(0, 10),
          category: item.category || "Other",
          raw_content: rawPastedText,
          original_source: originalSource,
          invoice_number: item.invoice_number || undefined,
          status: "Pending Approval",
          processed_at: new Date().toISOString(),
          extracted_metadata: {
            currency: item.extracted_metadata?.currency || "USD",
            taxAmount: Number(item.extracted_metadata?.taxAmount) || 0.0,
            vendorAddress: item.extracted_metadata?.vendorAddress || undefined,
            paymentTerms: item.extracted_metadata?.paymentTerms || undefined,
            confidenceScore: Number(item.extracted_metadata?.confidenceScore) || 85,
            lineItems: item.extracted_metadata?.lineItems || []
          }
        };

        const saveResponse = await fetch("/api/invoices", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-finance-user": financeUser
          },
          body: JSON.stringify(newInvoice)
        });

        if (saveResponse.ok) {
          const savedRecord = await saveResponse.json();
          newlySavedRecords.push(savedRecord);
        }
      }

      if (newlySavedRecords.length === 0) {
        throw new Error("Failed to write any invoices to the storage core.");
      }

      // Update states with all newly created invoice records
      setInvoices(prev => [...newlySavedRecords, ...prev]);
      setRawPastedText("");
      setSelectedInvoiceId(newlySavedRecords[0].id);
      setParsingState("idle");

      // Refresh Audit logs
      const auditsRes = await fetch("/api/audit-logs");
      if (auditsRes.ok) {
        const auditsData = await auditsRes.json();
        setAuditLogs(auditsData);
      }

    } catch (err: any) {
      console.error(err);
      setParsingState("error");
      setParsingError(err.message || "An unexpected error occurred during receipt parsing.");
    }
  };

  // Inline table row edit trigger
  const handleStartInlineEdit = (record: InvoiceRecord) => {
    setEditingInvoiceId(record.id);
    setEditForm({
      vendor: record.vendor,
      amount: record.amount,
      date: record.date,
      category: record.category,
      status: record.status,
      invoice_number: record.invoice_number,
      extracted_metadata: { ...record.extracted_metadata }
    });
  };

  // Save Inline record modifications directly from view table
  const handleSaveInlineEdit = async (recordId: string) => {
    try {
      const response = await fetch(`/api/invoices/${recordId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-finance-user": financeUser
        },
        body: JSON.stringify(editForm)
      });

      if (!response.ok) {
        throw new Error("Failed to save invoice modifications.");
      }

      const updatedRecord = await response.json();

      setInvoices(prev => prev.map(inv => inv.id === recordId ? updatedRecord : inv));
      setEditingInvoiceId(null);
      setEditForm({});
      
      // Update details panel if visible
      if (selectedInvoiceId === recordId) {
        setSelectedInvoiceId(null);
        setTimeout(() => setSelectedInvoiceId(recordId), 20);
      }

      // Refresh Audit logs
      const auditsRes = await fetch("/api/audit-logs");
      if (auditsRes.ok) {
        const auditsData = await auditsRes.json();
        setAuditLogs(auditsData);
      }

    } catch (err) {
      console.error("Update failed:", err);
      alert("Failed to update modifications. Please try again.");
    }
  };

  // Direct Status Update Toggle ("The Quick Super Power Button")
  const handleQuickStatusToggle = async (record: InvoiceRecord, newStatus: InvoiceRecord["status"]) => {
    try {
      const response = await fetch(`/api/invoices/${record.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-finance-user": financeUser
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) throw new Error();

      const updated: InvoiceRecord = await response.json();
      setInvoices(prev => prev.map(item => item.id === record.id ? updated : item));

      // Refresh audits
      const auditsRes = await fetch("/api/audit-logs");
      if (auditsRes.ok) {
        setAuditLogs(await auditsRes.json());
      }
    } catch {
      alert("Failed to quickly change record expense status.");
    }
  };

  // Sorting Handler
  const requestSort = (key: keyof InvoiceRecord) => {
    let direction: "asc" | "desc" = "asc";
    if (sortBy === key && sortDirection === "asc") {
      direction = "desc";
    }
    setSortBy(key);
    setSortDirection(direction);
  };

  // Selected invoice details object
  const selectedInvoice = useMemo(() => {
    if (!selectedInvoiceId) return null;
    return invoices.find(inv => inv.id === selectedInvoiceId) || null;
  }, [selectedInvoiceId, invoices]);

  // Filtered & Sorted Invoices
  const processedInvoices = useMemo(() => {
    let list = [...invoices];

    // 1. Search Query (Vendor, Amount string, Invoice No)
    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      list = list.filter(item => 
        item.vendor.toLowerCase().includes(lowerQuery) ||
        (item.invoice_number && item.invoice_number.toLowerCase().includes(lowerQuery)) ||
        item.amount.toString().includes(lowerQuery) ||
        item.category.toLowerCase().includes(lowerQuery) ||
        item.raw_content.toLowerCase().includes(lowerQuery)
      );
    }

    // 2. Status Categorization Filter
    if (statusFilter !== "all") {
      list = list.filter(item => item.status === statusFilter);
    }

    // 3. Department Cost Category Filter
    if (categoryFilter !== "all") {
      list = list.filter(item => item.category === categoryFilter);
    }

    // 4. Sort Ordering
    list.sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];

      if (aVal === undefined) return 1;
      if (bVal === undefined) return -1;

      if (typeof aVal === "string") {
        return sortDirection === "asc" 
          ? aVal.localeCompare(bVal as string) 
          : (bVal as string).localeCompare(aVal);
      } else {
        // Numbers
        return sortDirection === "asc"
          ? (aVal as number) - (bVal as number)
          : (bVal as number) - (aVal as number);
      }
    });

    return list;
  }, [invoices, searchQuery, statusFilter, categoryFilter, sortBy, sortDirection]);

  // Aggregate Metrics Calculations
  const metrics = useMemo(() => {
    const total = invoices.length;
    let sumSpend = 0;
    let pendingCount = 0;
    let flaggedCount = 0;
    let auditedCount = 0;

    invoices.forEach(inv => {
      sumSpend += inv.amount;
      if (inv.status === "Pending Approval") pendingCount++;
      if (inv.status === "Flagged") flaggedCount++;
      if (inv.status === "Audited") auditedCount++;
    });

    return {
      totalInvoices: total,
      totalSpend: sumSpend,
      avgInvoice: total ? sumSpend / total : 0,
      pendingCount,
      flaggedCount,
      auditedCount
    };
  }, [invoices]);

  // Category Spend breakdown
  const categorySplit = useMemo(() => {
    const map: { [key: string]: number } = {};
    invoices.forEach(inv => {
      map[inv.category] = (map[inv.category] || 0) + inv.amount;
    });
    return Object.entries(map).map(([name, val]) => ({ name, value: val }));
  }, [invoices]);

  // Corporate Exports triggers
  const handleExportCSV = () => {
    // Generate simple compliant CSV content string
    const headers = ["Invoice ID", "Vendor", "Amount", "Currency", "Date", "Category", "Invoice Number", "Source", "Status", "Processed At"];
    const rows = processedInvoices.map(inv => [
      inv.id,
      `"${inv.vendor.replace(/"/g, '""')}"`,
      inv.amount,
      inv.extracted_metadata?.currency || "USD",
      inv.date,
      inv.category,
      inv.invoice_number || "none",
      inv.original_source,
      inv.status,
      inv.processed_at
    ]);

    const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Corporate_Ledger_Export_${new Date().toISOString().substring(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Audit Log creation
    fetch("/api/audit-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "Data Exported",
        user: financeUser,
        details: `Downloaded spreadsheet CSV ledger report containing ${processedInvoices.length} rows.`
      })
    }).then(() => fetchData());
  };

  const handleExportJSON = () => {
    const rawData = JSON.stringify(processedInvoices, null, 2);
    const blob = new Blob([rawData], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Full_Enterprise_Dump_${new Date().toISOString().substring(0,10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    fetch("/api/audit-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "Data Exported",
        user: financeUser,
        details: `Exported rich structured JSON metadata dumps for ${processedInvoices.length} records.`
      })
    }).then(() => fetchData());
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans selection:bg-emerald-500 selection:text-slate-900">
      
      {/* Upper Navigation / Corporate Header Bar */}
      <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur sticky top-0 z-40 px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          
          {/* Logo / Title Block */}
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-emerald-600 to-teal-500 p-2.5 rounded-xl shadow-md shadow-emerald-950/20">
              <ShieldCheck className="w-6 h-6 text-slate-150 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-semibold font-mono tracking-widest text-emerald-400">Enterprise Suite</span>
                <span className="bg-slate-800 text-slate-300 text-[10px] font-mono px-2 py-0.5 rounded border border-slate-700">Audit-Ready</span>
              </div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white">Receipt / Invoice Parser</h1>
            </div>
          </div>

          {/* Configuration & Integration Badges */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            
            {/* Supabase Status Button */}
            <button
              onClick={() => setShowSupabaseModal(true)}
              className={`p-2 rounded-lg border flex items-center gap-2 font-mono hover:bg-slate-900 transition-all text-left cursor-pointer ${
                configStatus.configured && !configStatus.schemaErrorInvoices && !configStatus.schemaErrorAuditLogs
                  ? "bg-emerald-950/30 border-emerald-850 text-emerald-400" 
                  : "bg-amber-950/30 border-amber-800/60 text-amber-400"
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>
                Supabase: {
                  !configStatus.configured 
                    ? "Local Cache Mode" 
                    : (configStatus.schemaErrorInvoices || configStatus.schemaErrorAuditLogs)
                    ? "Schema Needed"
                    : "Cloud Connected"
                }
              </span>
              <Info className="w-3.5 h-3.5 text-slate-450 hover:text-white" />
            </button>

            {/* Gemini Parser Badge */}
            <div className="bg-indigo-950/30 border border-indigo-850 text-indigo-400 p-2 rounded-lg flex items-center gap-2 font-mono">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Gemini OCR: Active</span>
            </div>

            {/* Current Session Represent */}
            <div className="bg-slate-800 text-slate-200 px-3 py-2 rounded-lg border border-slate-700 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="font-mono font-medium">{financeUser}</span>
            </div>
          </div>

        </div>
      </header>

      {/* Main Core Dashboard Layout Wrapper */}
      <main className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">

        {/* Dynamic Supabase Schema Setup Error Banner */}
        {configStatus.configured && (configStatus.schemaErrorInvoices || configStatus.schemaErrorAuditLogs) && (
          <div className="bg-amber-950/40 border border-amber-900/80 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-950/80 rounded-lg text-amber-400 mt-0.5">
                <AlertTriangle className="w-5 h-5 shrink-0" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xs font-semibold font-mono text-amber-400 uppercase tracking-wider">Supabase Tables Missing in Schema</h3>
                <p className="text-xs text-slate-350 leading-relaxed">
                  Supabase configuration was detected, but critical tables are missing from your database schema cache. Run the setup SQL script to enable active cloud synchronization.
                </p>
                <p className="text-[10px] text-slate-500 font-mono italic">
                  Database Code: {configStatus.schemaErrorInvoices || configStatus.schemaErrorAuditLogs}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowSupabaseModal(true)}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold font-sans rounded-lg transition-all shadow-md shrink-0 flex items-center justify-center gap-2 cursor-pointer text-black"
            >
              <Database className="w-4 h-4 text-slate-950" />
              <span>Fix Schema (Copy SQL)</span>
            </button>
          </div>
        )}

        {/* SECTION 1: KEY PERFORMANCE METRICS (CFO GRID) */}
        <section aria-label="Key Performance Indicators" className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          
          <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl relative overflow-hidden">
            <p className="text-[11px] sm:text-xs font-mono font-semibold text-slate-400 uppercase tracking-wider">Total Managed Spend</p>
            <p className="text-xl sm:text-2xl font-bold font-mono text-white mt-1">
              ${metrics.totalSpend.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <div className="text-[10px] sm:text-xs text-slate-400 mt-2 flex items-center gap-1.5">
              <span className="text-emerald-400 font-bold">100%</span> parsed of all sources
            </div>
            <div className="absolute right-3 bottom-3 text-slate-800 font-black text-6xl pointer-events-none select-none select-none font-mono opacity-20">$</div>
          </div>

          <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl relative overflow-hidden">
            <p className="text-[11px] sm:text-xs font-mono font-semibold text-slate-400 uppercase tracking-wider">Total Vouchers</p>
            <p className="text-xl sm:text-2xl font-bold font-mono text-white mt-1">
              {metrics.totalInvoices} <span className="text-xs font-sans text-slate-400 font-normal">items</span>
            </p>
            <div className="text-[10px] sm:text-xs text-slate-400 mt-2 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>Slack & Email aggregates</span>
            </div>
            <div className="absolute right-3 bottom-0 text-slate-800 font-black text-6xl pointer-events-none select-none font-mono opacity-20">#</div>
          </div>

          <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl relative overflow-hidden">
            <p className="text-[11px] sm:text-xs font-mono font-semibold text-slate-400 uppercase tracking-wider">Pending Review</p>
            <p className="text-xl sm:text-2xl font-bold font-mono mt-1 text-sky-400">
              {metrics.pendingCount} <span className="text-xs font-sans text-slate-400 font-normal">unreviewed</span>
            </p>
            <div className="text-[10px] sm:text-xs text-slate-400 mt-2 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-sky-450" />
              <span>Awaiting final CFO stamp</span>
            </div>
            <div className="absolute right-3 bottom-0 text-slate-800 font-black text-6xl pointer-events-none select-none font-mono opacity-20">?</div>
          </div>

          <div className={`border p-4 rounded-xl relative overflow-hidden transition-colors ${
            metrics.flaggedCount > 0 
              ? "bg-red-950/20 border-red-900/60" 
              : "bg-slate-950 border-slate-850"
          }`}>
            <p className="text-[11px] sm:text-xs font-mono font-semibold text-slate-400 uppercase tracking-wider">Flagged Outliers</p>
            <p className={`text-xl sm:text-2xl font-bold font-mono mt-1 ${metrics.flaggedCount > 0 ? "text-red-400" : "text-slate-200"}`}>
              {metrics.flaggedCount} <span className="text-xs font-sans text-slate-400 font-normal">exceptions</span>
            </p>
            <div className="text-[10px] sm:text-xs text-slate-400 mt-2 flex items-center gap-1">
              <AlertTriangle className={`w-3.5 h-3.5 ${metrics.flaggedCount > 0 ? "text-red-400" : "text-slate-400"}`} />
              <span className={metrics.flaggedCount > 0 ? "text-red-300" : ""}>Requires immediate action</span>
            </div>
            <div className="absolute right-3 bottom-0 text-slate-800 font-black text-6xl pointer-events-none select-none font-mono opacity-20">!</div>
          </div>

        </section>

        {/* SECTION 2: OCR UPLOAD & GENERAL SPLIT WORKSPACE */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Work Block A: OCR Parser Canvas (5 Columns) */}
          <div className="lg:col-span-5 space-y-6">
            
            <div className="bg-slate-950 border border-slate-850 rounded-xl p-5 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <UploadCloud className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-sm uppercase font-mono tracking-wider font-bold text-white">Live Raw Data OCR</h2>
                </div>
                <span className="text-[10px] bg-slate-800 text-slate-300 font-mono px-2 py-0.5 rounded border border-slate-700">
                  Multimodal Parser
                </span>
              </div>

              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                Paste raw transaction text, vendor invoice email feeds, or message formats collected from Slack. Gemini AI automatically parses, cleans, extracts core line-items, and maps to tax departments.
              </p>

              {/* Demo Sample Presets */}
              <div className="mb-4">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-mono mb-2 font-semibold">Test with Demo Presets:</p>
                <div className="flex flex-wrap gap-1.5">
                  {demoPresets.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleApplyPreset(preset.text, preset.source)}
                      className="text-xs bg-slate-900 border border-slate-800 text-slate-350 hover:bg-slate-800 hover:text-white px-2.5 py-1 rounded-md transition-all font-medium flex items-center gap-1.5"
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        preset.source === "Slack" ? "bg-[#36C5F0]" : preset.source === "Email" ? "bg-amber-400" : "bg-emerald-400"
                      }`}></span>
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Form Input */}
              <form onSubmit={handleParseOCRData} className="space-y-4">
                <div>
                  <label htmlFor="raw-pasted-data" className="sr-only">Raw Ledger Text</label>
                  <textarea
                    id="raw-pasted-data"
                    value={rawPastedText}
                    onChange={(e) => setRawPastedText(e.target.value)}
                    placeholder="Example: @billing Amazon Web Services sent bill on June 18 for total USD 1,420.50 including database support..."
                    rows={7}
                    required
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition-colors font-mono resize-y focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex items-center justify-between gap-4">
                  
                  {/* Origin Source Tag Selector */}
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500 uppercase font-mono tracking-wider block font-semibold">Origin Feed Source:</span>
                    <div className="inline-flex rounded-lg p-0.5 bg-slate-900 border border-slate-800">
                      {(["Pasted Text", "Email", "Slack"] as const).map(src => (
                        <button
                          key={src}
                          type="button"
                          onClick={() => setOriginalSource(src)}
                          className={`text-[10px] px-2.5 py-1 rounded transition-colors font-semibold ${
                            originalSource === src 
                              ? "bg-slate-800 text-white font-bold" 
                              : "text-slate-400 hover:text-white"
                          }`}
                        >
                          {src}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Parse Action Click */}
                  <div className="self-end">
                    <button
                      type="submit"
                      disabled={parsingState === "parsing" || parsingState === "saving" || !rawPastedText.trim()}
                      className="px-4 py-2 bg-gradient-to-tr from-emerald-600 to-teal-500 text-slate-950 font-sans font-bold hover:from-emerald-500 hover:to-teal-400 text-xs sm:text-sm rounded-lg transition-all flex items-center gap-2 shadow-lg shadow-emerald-950/20 disabled:opacity-40 disabled:pointer-events-none hover:shadow-emerald-500/10 cursor-pointer text-black"
                    >
                      {parsingState === "parsing" && (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                          <span>Gemini Scanning...</span>
                        </>
                      )}
                      {parsingState === "saving" && (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                          <span>Saving to Ledger...</span>
                        </>
                      )}
                      {parsingState === "idle" && (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-slate-950" />
                          <span>Auto Parse OCR</span>
                        </>
                      )}
                      {parsingState === "error" && (
                        <>
                          <X className="w-4 h-4 text-slate-950" />
                          <span>Retry Parsing</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Error Banner */}
                {parsingError && (
                  <div className="bg-red-950/40 border border-red-900/60 p-3 rounded-lg text-xs text-red-300 flex items-start gap-2 animate-pulse">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                    <div>
                      <p className="font-bold">OCR Parser Warning</p>
                      <p className="opacity-90 text-[11px]">{parsingError}</p>
                    </div>
                  </div>
                )}
              </form>
            </div>

            {/* Quick Helper card explaining data mapping */}
            <div className="bg-slate-950 border border-slate-850 rounded-xl p-4 flex items-start gap-3">
              <div className="p-1.5 rounded-lg bg-emerald-950/50 text-emerald-400 mt-0.5">
                <HelpCircle className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-mono font-bold text-slate-200">Finance Head System Notes</p>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Modify individual field contents at any time by clicking the <Edit2 className="w-2.5 h-2.5 text-slate-300 inline" /> icon on any record. Use the Quick Toggle buttons inside the table rows for rapid status changes. System updates automatically generate log events in the corporate audit trail.
                </p>
              </div>
            </div>

          </div>

          {/* Work Block B: Selected Voucher / Detail Display (7 Columns) */}
          <div className="lg:col-span-7">
            <div className="bg-slate-950 border border-slate-850 rounded-xl p-5 shadow-xl h-full flex flex-col">
              
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-teal-400" />
                  <h2 className="text-sm uppercase font-mono tracking-wider font-bold text-white">Extracted Metadata & Line Items</h2>
                </div>
                {selectedInvoice ? (
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                    selectedInvoice.status === "Approved" 
                      ? "bg-emerald-950/40 border-emerald-800 text-emerald-400"
                      : selectedInvoice.status === "Flagged"
                      ? "bg-red-950/40 border-red-900 text-red-400"
                      : selectedInvoice.status === "Audited"
                      ? "bg-violet-950/40 border-violet-900 text-violet-400"
                      : "bg-sky-950/40 border-sky-900 text-sky-400"
                  }`}>
                    {selectedInvoice.status}
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-500 font-mono">No record highlighted</span>
                )}
              </div>

              {!selectedInvoice ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-800 rounded-lg bg-slate-950">
                  <div className="p-3 bg-slate-900 rounded-full text-slate-500 mb-3 border border-slate-850">
                    <Clipboard className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-mono font-semibold text-slate-300">No Voucher Highlighted</p>
                  <p className="text-xs text-slate-500 max-w-xs mt-1">
                    Select a record from the table below, or input raw transaction details on the left, to load rich, OCR extracted line items and billing addresses.
                  </p>
                </div>
              ) : (
                <div className="flex-1 flex flex-col justify-between space-y-4">
                  
                  {/* Detailed summary overview */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-900 p-4 rounded-lg border border-slate-800">
                    <div className="space-y-2">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-mono tracking-wide font-medium block">Vendor</span>
                        <span className="text-sm font-bold text-white block">{selectedInvoice.vendor}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-mono tracking-wide font-medium block">Extracted Total</span>
                        <span className="text-sm font-bold font-mono text-emerald-400 block">
                          {selectedInvoice.extracted_metadata?.currency || "USD"} ${selectedInvoice.amount.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-mono tracking-wide font-medium block">Date & Timestamp</span>
                        <span className="text-xs font-mono text-slate-300 block">{selectedInvoice.date}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-mono tracking-wide font-medium block">Category Assigned</span>
                        <span className="text-xs bg-slate-800 border border-slate-700 text-slate-200 px-2.5 py-0.5 rounded-full inline-block font-medium mt-1">
                          {selectedInvoice.category}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-mono tracking-wide font-medium block">Invoice / Reference ID</span>
                        <span className="text-xs font-mono text-slate-300 block font-medium mt-0.5">
                          {selectedInvoice.invoice_number || <span className="text-slate-650 font-normal italic">None detected</span>}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-mono tracking-wide block">Confidence Score</span>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${
                                (selectedInvoice.extracted_metadata?.confidenceScore || 0) > 90 
                                  ? "bg-emerald-500" 
                                  : (selectedInvoice.extracted_metadata?.confidenceScore || 0) > 70 
                                  ? "bg-sky-500" 
                                  : "bg-amber-500"
                              }`}
                              style={{ width: `${selectedInvoice.extracted_metadata?.confidenceScore || 85}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-mono text-slate-400">{selectedInvoice.extracted_metadata?.confidenceScore || 85}%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* OCR Line Items Details Section */}
                  <div className="flex-1">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider font-mono font-bold mb-2">Itemized Breakdown Structure</p>
                    
                    {!(selectedInvoice.extracted_metadata?.lineItems && selectedInvoice.extracted_metadata.lineItems.length > 0) ? (
                      <div className="bg-slate-900 border border-slate-850 p-3 rounded text-center text-xs text-slate-500 font-mono italic">
                        No distinct line items extracted by OCR.
                      </div>
                    ) : (
                      <div className="border border-slate-800 rounded-lg overflow-x-auto max-h-48 overflow-y-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-900/60 sticky top-0 border-b border-slate-800 text-slate-400 font-mono text-[10px] uppercase font-bold">
                            <tr>
                              <th className="p-2 pl-3">Description</th>
                              <th className="p-2 text-center">Qty</th>
                              <th className="p-2 text-right">Unit Price</th>
                              <th className="p-2 text-right pr-3">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-900 bg-slate-950">
                            {selectedInvoice.extracted_metadata.lineItems.map((item, idx) => (
                              <tr key={idx} className="hover:bg-slate-900/30">
                                <td className="p-2 pl-3 text-slate-300 truncate max-w-xs">{item.description}</td>
                                <td className="p-2 text-center text-slate-400 font-mono">{item.quantity || 1}</td>
                                <td className="p-2 text-right text-slate-400 font-mono">
                                  ${(item.unitPrice || item.amount).toFixed(2)}
                                </td>
                                <td className="p-2 text-right text-slate-200 font-mono pr-3">${item.amount.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Supplemental Legal Metadata */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono border-t border-slate-800/80 pt-3">
                    <div>
                      <span className="text-[11px] text-slate-500 uppercase font-mono tracking-wider block mb-1">Billing Location</span>
                      <p className="text-slate-300 text-[11px] leading-snug">
                        {selectedInvoice.extracted_metadata?.vendorAddress || <span className="italic text-slate-600">No address captured</span>}
                      </p>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 uppercase font-mono tracking-wider block mb-1">Extracted Tax</span>
                      <p className="text-slate-300 font-mono">
                        Tax: ${selectedInvoice.extracted_metadata?.taxAmount?.toFixed(2) || "0.00"} USD
                      </p>
                      {selectedInvoice.extracted_metadata?.paymentTerms && (
                        <p className="text-slate-400 text-[11px] mt-1">
                          Terms: <span className="text-slate-200 font-bold">{selectedInvoice.extracted_metadata.paymentTerms}</span>
                        </p>
                      )}
                    </div>
                  </div>

                </div>
              )}
            </div>
          </div>

        </section>

        {/* SECTION 3: TAB CONTROL FOR LEDGER & REPORTING ACTIONS */}
        <section className="bg-slate-950 border border-slate-850 rounded-xl overflow-hidden shadow-xl">
          
          {/* Header Controls, Search Filter row */}
          <div className="p-4 sm:p-5 border-b border-slate-850 bg-slate-950 flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            {/* View Selector Tabs */}
            <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg">
              <button
                onClick={() => setActiveTab("ledger")}
                className={`flex items-center gap-2 text-xs font-semibold font-mono tracking-wide px-3.5 py-2 rounded-md transition-colors ${
                  activeTab === "ledger"
                    ? "bg-gradient-to-tr from-emerald-900/50 to-teal-900/50 text-emerald-400 border border-emerald-850"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Clipboard className="w-3.5 h-3.5" />
                <span>Enterprise Ledger</span>
              </button>
              <button
                onClick={() => setActiveTab("audit")}
                className={`flex items-center gap-2 text-xs font-semibold font-mono tracking-wide px-3.5 py-2 rounded-md transition-colors ${
                  activeTab === "audit"
                    ? "bg-gradient-to-tr from-emerald-900/50 to-teal-900/50 text-emerald-400 border border-emerald-850"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Corporate Audit Logs</span>
              </button>
            </div>

            {/* Dynamic Search & Operations */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              
              {/* Search text */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Filter by vendor, amount, raw content..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 font-mono w-full sm:w-64"
                />
              </div>

              {/* Status Select */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-350 focus:outline-none focus:border-emerald-500 font-mono"
              >
                <option value="all">Statuses (All)</option>
                <option value="Approved">Approved</option>
                <option value="Pending Approval">Pending</option>
                <option value="Audited">Audited</option>
                <option value="Flagged">Flagged</option>
              </select>

              {/* Category Select */}
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-350 focus:outline-none focus:border-emerald-500 font-mono"
              >
                <option value="all">Category (All)</option>
                <option value="Hosting">Hosting</option>
                <option value="Software">Software</option>
                <option value="Marketing">Marketing/Ad</option>
                <option value="Office Supplies">Office Supplies</option>
                <option value="Travel/Logistics">Travel</option>
                <option value="Other">Other</option>
              </select>

              {/* CFO Printing / Reports Overlay Button */}
              <button
                onClick={() => setShowPrintModal(true)}
                className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-750 text-slate-300 rounded-lg transition-colors flex items-center justify-center gap-1.5 text-xs font-mono cursor-pointer"
                title="Print ledger report"
              >
                <Printer className="w-4 h-4" />
                <span className="hidden sm:inline">Ledger Preview</span>
              </button>

              {/* Export Trigger */}
              <div className="relative group">
                <button
                  className="px-3.5 py-2 bg-slate-905 hover:bg-slate-850 border border-slate-800 flex items-center gap-1.5 text-xs font-mono text-slate-200 rounded-lg cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>CFO Export Options</span>
                </button>
                <div className="absolute right-0 top-10 bg-slate-950 border border-slate-850 rounded-lg shadow-2xl p-1.5 hidden group-hover:block z-50 w-48 text-left">
                  <button
                    onClick={handleExportCSV}
                    className="w-full text-left p-2 hover:bg-slate-900 rounded text-xs text-slate-300 font-mono block cursor-pointer"
                  >
                    Export Ledger (CSV)
                  </button>
                  <button
                    onClick={handleExportJSON}
                    className="w-full text-left p-2 hover:bg-slate-900 rounded text-xs text-slate-300 font-mono block cursor-pointer"
                  >
                    Full Metadata (JSON)
                  </button>
                </div>
              </div>

            </div>
          </div>

          <div className="relative overflow-x-auto">
            
            {activeTab === "ledger" ? (
              <div className="min-w-full inline-block align-middle">
                
                {loadingInvoices ? (
                  <div className="flex flex-col items-center justify-center p-12 text-slate-555">
                    <RefreshCw className="w-8 h-8 animate-spin text-emerald-500 mb-2" />
                    <p className="text-sm font-mono text-slate-400">Loading audit ledger data state...</p>
                  </div>
                ) : processedInvoices.length === 0 ? (
                  <div className="text-center p-12 text-slate-500">
                    <Info className="w-8 h-8 mx-auto mb-2 text-slate-650" />
                    <p className="text-sm font-semibold font-mono text-slate-400">No Expenses Found Matching Criteria</p>
                    <p className="text-xs text-slate-600 mt-1">Try broadening your search query or reset filters.</p>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-900/80 text-slate-400 text-[10px] sm:text-xs uppercase font-mono font-bold tracking-wider border-b border-slate-850 sticky top-0">
                      <tr>
                        <th className="p-3.5 pl-5 cursor-pointer hover:text-white transition-colors" onClick={() => requestSort("vendor")}>
                          <div className="flex items-center gap-1.5">
                            <span>Vendor</span>
                            {sortBy === "vendor" && <ArrowUpDown className="w-3 h-3 text-emerald-400" />}
                          </div>
                        </th>
                        <th className="p-3.5 cursor-pointer hover:text-white transition-colors" onClick={() => requestSort("amount")}>
                          <div className="flex items-center gap-1.5">
                            <span>Amount</span>
                            {sortBy === "amount" && <ArrowUpDown className="w-3 h-3 text-emerald-400" />}
                          </div>
                        </th>
                        <th className="p-3.5 cursor-pointer hover:text-white transition-colors" onClick={() => requestSort("date")}>
                          <div className="flex items-center gap-1.5">
                            <span>Date</span>
                            {sortBy === "date" && <ArrowUpDown className="w-3 h-3 text-emerald-400" />}
                          </div>
                        </th>
                        <th className="p-3.5 cursor-pointer hover:text-white transition-colors hidden sm:table-cell" onClick={() => requestSort("category")}>
                          <div className="flex items-center gap-1.5">
                            <span>Category</span>
                            {sortBy === "category" && <ArrowUpDown className="w-3 h-3 text-emerald-400" />}
                          </div>
                        </th>
                        <th className="p-3.5 hidden md:table-cell">References #</th>
                        <th className="p-3.5 hidden sm:table-cell">Origin</th>
                        <th className="p-3.5">Review Approval Status</th>
                        <th className="p-3.5 pr-5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900 font-mono text-xs">
                      {processedInvoices.map((inv) => {
                        const isEditing = editingInvoiceId === inv.id;
                        const isHighlighted = selectedInvoiceId === inv.id;

                        return (
                          <tr 
                            key={inv.id} 
                            onClick={() => {
                              if (!isEditing) setSelectedInvoiceId(inv.id);
                            }}
                            className={`transition-colors cursor-pointer ${
                              isHighlighted 
                                ? "bg-slate-900/50 hover:bg-slate-900/70" 
                                : "hover:bg-slate-900/20"
                            }`}
                          >
                            
                            {/* VENDOR COLUMN */}
                            <td className="p-4 pl-5">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editForm.vendor || ""}
                                  onChange={(e) => setEditForm(prev => ({ ...prev, vendor: e.target.value }))}
                                  onClick={(e) => e.stopPropagation()}
                                  className="bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-emerald-500 rounded px-2 py-1 text-slate-100 font-mono text-xs max-w-[150px] w-full"
                                />
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-slate-200 block text-xs truncate max-w-[140px]">{inv.vendor}</span>
                                </div>
                              )}
                            </td>

                            {/* AMOUNT COLUMN */}
                            <td className="p-4 font-bold">
                              {isEditing ? (
                                <div className="flex items-center bg-slate-950 border border-slate-850 rounded px-2 max-w-[100px]" onClick={(e) => e.stopPropagation()}>
                                  <span className="text-slate-500 text-[10px] mr-1">$</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={editForm.amount || 0.0}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, amount: Number(e.target.value) }))}
                                    className="bg-transparent border-none text-slate-100 font-mono text-xs w-full focus:outline-none"
                                  />
                                </div>
                              ) : (
                                <span className="text-emerald-400">
                                  ${inv.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              )}
                            </td>

                            {/* DATE COLUMN */}
                            <td className="p-4 text-slate-350">
                              {isEditing ? (
                                <input
                                  type="date"
                                  value={editForm.date || ""}
                                  onChange={(e) => setEditForm(prev => ({ ...prev, date: e.target.value }))}
                                  onClick={(e) => e.stopPropagation()}
                                  className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-100 font-mono text-xs max-w-[125px] focus:outline-none focus:border-emerald-500"
                                />
                              ) : (
                                <span>{inv.date}</span>
                              )}
                            </td>

                            {/* CATEGORY COLUMN */}
                            <td className="p-4 hidden sm:table-cell">
                              {isEditing ? (
                                <select
                                  value={editForm.category || ""}
                                  onChange={(e) => setEditForm(prev => ({ ...prev, category: e.target.value }))}
                                  onClick={(e) => e.stopPropagation()}
                                  className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-100 font-mono text-xs max-w-[130px] focus:outline-none focus:border-emerald-500"
                                >
                                  <option value="Hosting">Hosting</option>
                                  <option value="Software">Software</option>
                                  <option value="Marketing/Advertising">Marketing/Ad</option>
                                  <option value="Office Supplies">Office Supplies</option>
                                  <option value="Travel/Logistics">Travel</option>
                                  <option value="Meals & Entertainment">Meals/Ent</option>
                                  <option value="Utilities">Utilities</option>
                                  <option value="Other">Other</option>
                                </select>
                              ) : (
                                <span className="text-slate-450 text-[11px] font-semibold">{inv.category}</span>
                              )}
                            </td>

                            {/* REFERENCES ID */}
                            <td className="p-4 text-slate-400 hidden md:table-cell">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editForm.invoice_number || ""}
                                  onChange={(e) => setEditForm(prev => ({ ...prev, invoice_number: e.target.value }))}
                                  onClick={(e) => e.stopPropagation()}
                                  placeholder="No reference"
                                  className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-100 font-mono text-xs max-w-[110px] focus:outline-none"
                                />
                              ) : (
                                <span>{inv.invoice_number || "—"}</span>
                              )}
                            </td>

                            {/* SOURCE COLUMN */}
                            <td className="p-4 hidden sm:table-cell">
                              <span className={`px-2 py-0.5 rounded text-[10px] border font-bold ${
                                inv.original_source === "Slack" 
                                  ? "bg-[#36C5F0]/10 border-[#36C5F0]/20 text-[#36C5F0]"
                                  : inv.original_source === "Email"
                                  ? "bg-amber-950/20 border-amber-900/40 text-amber-500"
                                  : "bg-emerald-950/20 border-emerald-900/40 text-emerald-500"
                              }`}>
                                {inv.original_source}
                              </span>
                            </td>

                            {/* STATUS COLUMN */}
                            <td className="p-4" onClick={(e) => e.stopPropagation()}>
                              {isEditing ? (
                                <select
                                  value={editForm.status || ""}
                                  onChange={(e) => setEditForm(prev => ({ ...prev, status: e.target.value as any }))}
                                  className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-100 font-mono text-xs focus:outline-none focus:border-emerald-500"
                                >
                                  <option value="Pending Approval">Pending</option>
                                  <option value="Approved">Approved</option>
                                  <option value="Audited">Audited</option>
                                  <option value="Flagged">Flagged</option>
                                </select>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] border font-semibold tracking-wide ${
                                    inv.status === "Approved"
                                      ? "bg-emerald-950 text-emerald-400 border-emerald-900"
                                      : inv.status === "Flagged"
                                      ? "bg-red-950 text-red-400 border-red-900"
                                      : inv.status === "Audited"
                                      ? "bg-violet-950 text-violet-400 border-violet-900"
                                      : "bg-sky-950 text-sky-450 border-sky-900"
                                  }`}>
                                    {inv.status}
                                  </span>

                                  {/* Super-Power Action buttons */}
                                  <div className="flex items-center gap-1 opacity-0 hover:opacity-100 group-hover:opacity-100 transition-opacity ml-1 bg-slate-900 px-1 py-0.5 rounded border border-slate-800">
                                    {(["Approved", "Flagged"] as const).map(st => (
                                      <button
                                        key={st}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleQuickStatusToggle(inv, st);
                                        }}
                                        className={`px-1 rounded text-[9px] font-bold tracking-tighter uppercase transition-colors ${
                                          st === "Approved" 
                                            ? "text-emerald-500 hover:bg-emerald-950" 
                                            : "text-red-500 hover:bg-red-950"
                                        }`}
                                        title={`Mark as ${st}`}
                                      >
                                        {st === "Approved" ? "Approve" : "Flag"}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </td>

                            {/* RECONCILIATIONS ACTIONS */}
                            <td className="p-4 pr-5 text-right font-semibold" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1.5">
                                {isEditing ? (
                                  <>
                                    <button
                                      onClick={() => handleSaveInlineEdit(inv.id)}
                                      className="p-1 bg-emerald-950 hover:bg-emerald-900 text-emerald-400 rounded transition-colors"
                                      title="Save change"
                                    >
                                      <Save className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => setEditingInvoiceId(null)}
                                      className="p-1 bg-slate-900 hover:bg-slate-800 text-slate-400 rounded transition-colors"
                                      title="Cancel"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    onClick={() => handleStartInlineEdit(inv)}
                                    className="p-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-350 rounded-lg transition-colors inline-flex cursor-pointer"
                                    title="Edit fields inline"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>

                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            ) : (
              
              /* AUDIT LOG TAB VIEW */
              <div className="p-4 space-y-4">
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-sm font-semibold font-mono text-white">Continuous Compliance Ledger Trail</h3>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">Immutable chronological stream</span>
                </div>

                <div className="space-y-2.5 max-h-[450px] overflow-y-auto pr-2">
                  {auditLogs.length === 0 ? (
                    <div className="text-center p-6 text-slate-600 font-mono italic text-xs">
                      No compliance logs captured yet.
                    </div>
                  ) : (
                    auditLogs.map((log) => (
                      <div key={log.id} className="border border-slate-850 p-3 bg-slate-950 rounded-lg space-y-1.5 hover:border-slate-800 transition-colors">
                        
                        <div className="flex items-start sm:items-center justify-between flex-col sm:flex-row gap-1 text-[11px] font-mono">
                          
                          {/* Left log head details */}
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] text-slate-500">{new Date(log.timestamp).toLocaleString()}</span>
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                              log.action === "Invoice Parsed & Created" 
                                ? "bg-emerald-950 text-emerald-400 border border-emerald-900/60"
                                : log.action === "Status Changed"
                                ? "bg-indigo-950 text-indigo-400 border border-indigo-900/60"
                                : "bg-sky-950 text-sky-400 border border-sky-900/60"
                            }`}>
                              {log.action}
                            </span>
                          </div>

                          {/* Operator */}
                          <span className="text-slate-400 text-[10px]">
                            Operator: <strong className="text-slate-300 font-semibold">{log.user}</strong>
                          </span>
                        </div>

                        {/* Description details */}
                        <p className="text-xs text-slate-300 font-sans tracking-wide leading-relaxed pl-1.5 border-l-2 border-emerald-850">
                          {log.details}
                        </p>

                        {/* Changes details list table (for inline modifications logs) */}
                        {log.changes && log.changes.length > 0 && (
                          <div className="mt-2 text-[10px] bg-slate-900 p-2 rounded-md font-mono space-y-1 border border-slate-850">
                            <p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold font-mono">Modified Fields Old vs New:</p>
                            {log.changes.map((c, cIdx) => (
                              <div key={cIdx} className="flex flex-wrap items-center gap-2 text-slate-350">
                                <span className="bg-slate-800 px-1 py-0.5 rounded border border-slate-700 text-slate-200">{c.field}</span>
                                <span>changed from</span>
                                <span className="text-red-400 italic font-medium">"{String(c.oldValue || "empty")}"</span>
                                <span>to</span>
                                <span className="text-emerald-400 font-bold">"{String(c.newValue)}"</span>
                              </div>
                            ))}
                          </div>
                        )}

                      </div>
                    ))
                  )}
                </div>

              </div>
            )}
            
          </div>
        </section>

      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-850 py-6 px-4 mt-12 bg-slate-950">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-xs font-mono text-slate-500">
          <div>
            <p className="font-semibold text-slate-400">Finance Ledger System v2.4 (Enterprise Edition)</p>
            <p className="mt-1 font-normal text-[11px]">Designed exclusively for Corporate CFOs, Auditors, & Finance Heads. Fully secure.</p>
          </div>
          <div>
            <p>Active Operator Session ID: <strong className="text-slate-400">{Math.random().toString(36).substring(3, 9).toUpperCase()}</strong></p>
            <p className="mt-1">Last Sync Check: <span className="text-emerald-400">Online & Encrypted</span></p>
          </div>
        </div>
      </footer>

      {/* REPORT AND LEDGER PRINT MODAL OVERLAY */}
      <AnimatePresence>
        {showPrintModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col font-sans"
            >
              
              {/* Modal Header controls */}
              <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Printer className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-sm uppercase font-mono tracking-wider font-bold text-white">Print-Ready Financial Ledger Reconciliation</h3>
                </div>
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="p-1 px-2.5 bg-slate-900 hover:bg-slate-800 rounded-md border border-slate-800 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>

              {/* Printable Body Sheet */}
              <div className="p-6 overflow-y-auto space-y-6 bg-white text-slate-900" id="finance-print-area">
                
                {/* Printable Header */}
                <div className="border-b-2 border-slate-900 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <span className="text-xs uppercase font-mono font-bold tracking-widest text-slate-500">Corporate Finance Suite</span>
                    <h1 className="text-2xl font-black text-slate-950">Expense ledger Reconciliation Sheet</h1>
                    <p className="text-xs text-slate-500 mt-1">Generated chronologically by audit automation bridges on {new Date().toLocaleDateString()}</p>
                  </div>
                  <div className="text-right font-mono text-xs text-slate-800">
                    <p>Report Ref: <strong className="text-slate-950 font-bold">RECON-{Math.floor(Math.random() * 900000) + 100000}</strong></p>
                    <p>Auditor: <strong className="text-slate-950 font-bold">{financeUser}</strong></p>
                    <p>Origin: <strong className="text-slate-950 font-bold">Supabase Live Connector</strong></p>
                  </div>
                </div>

                {/* KPI aggregation split table */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs text-slate-900">
                  <div className="p-3 bg-slate-100 rounded-lg border border-slate-200">
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Accumulated Volume</p>
                    <p className="text-lg font-black text-slate-950 mt-1">
                      ${metrics.totalSpend.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                    </p>
                  </div>
                  <div className="p-3 bg-slate-100 rounded-lg border border-slate-200">
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Average Invoice Cost</p>
                    <p className="text-lg font-black text-slate-950 mt-1">
                      ${metrics.avgInvoice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                    </p>
                  </div>
                  <div className="p-3 bg-slate-100 rounded-lg border border-slate-200">
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Audited / Approved Ratio</p>
                    <p className="text-lg font-black text-slate-950 mt-1">
                      {processedInvoices.filter(i => ["Approved", "Audited"].includes(i.status)).length} / {processedInvoices.length} Items
                    </p>
                  </div>
                </div>

                {/* Main Table list */}
                <div className="space-y-2">
                  <p className="text-xs uppercase font-mono font-bold tracking-widest text-slate-500">Expense records breakdown</p>
                  <table className="w-full text-left text-xs border border-slate-350">
                    <thead className="bg-slate-200 text-slate-800 font-mono text-[10px] uppercase font-bold border-b border-slate-400">
                      <tr>
                        <th className="p-2 border-r border-slate-350">Vendor Issuer</th>
                        <th className="p-2 border-r border-slate-350">Reference #</th>
                        <th className="p-2 border-r border-slate-350">Invoice Date</th>
                        <th className="p-2 border-r border-slate-350">Department Category</th>
                        <th className="p-2 border-r border-slate-350 text-right">Extracted Tax (USD)</th>
                        <th className="p-2 text-right">Sum (USD)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-300 font-mono text-[11px] text-slate-900">
                      {processedInvoices.map((inv) => (
                        <tr key={inv.id}>
                          <td className="p-2 border-r border-slate-350 font-bold">{inv.vendor}</td>
                          <td className="p-2 border-r border-slate-350">{inv.invoice_number || "—"}</td>
                          <td className="p-2 border-r border-slate-350">{inv.date}</td>
                          <td className="p-2 border-r border-slate-350">{inv.category}</td>
                          <td className="p-2 border-r border-slate-350 text-right font-semibold">
                            ${inv.extracted_metadata?.taxAmount?.toFixed(2) || "0.00"}
                          </td>
                          <td className="p-2 text-right font-black">${inv.amount.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-slate-900 bg-slate-100 font-mono font-bold text-xs">
                      <tr>
                        <td colSpan={5} className="p-2 text-right uppercase border-r border-slate-350">Cumulative Total Reconciliation Sheet:</td>
                        <td className="p-2 text-right font-black text-slate-950 text-sm">
                          ${metrics.totalSpend.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Department aggregators breakdown table */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-300">
                  
                  <div className="space-y-1.5">
                    <p className="text-[10px] uppercase font-mono font-bold tracking-widest text-slate-500">Cost Category Subtotals</p>
                    <table className="w-full text-left text-xs border border-slate-300">
                      <thead className="bg-slate-100 border-b border-slate-300 font-bold">
                        <tr>
                          <th className="p-1.5 pl-2">Category</th>
                          <th className="p-1.5 text-right pr-2">Total Amount Allocated</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {categorySplit.map((cat, idx) => (
                          <tr key={idx} className="font-mono text-[11px]">
                            <td className="p-1.5 pl-2">{cat.name}</td>
                            <td className="p-1.5 text-right pr-2 font-bold">${cat.value.toFixed(2)} USD</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="space-y-2 text-slate-500 leading-normal text-[11px] font-sans">
                    <p className="font-bold text-slate-800 font-mono">Ledger Reconciliation Signoff</p>
                    <p>I verify that the above ledger statements represent fully compiled operational expenses processed through Slack channels or formal email billing setups. Correct corresponding corporate tax category assignments have been fully matched.</p>
                    
                    {/* Signed lines mock */}
                    <div className="pt-6 flex items-center justify-between gap-4 font-mono text-[10px]">
                      <div>
                        <div className="w-32 border-b border-slate-400 h-10"></div>
                        <p className="mt-1">Prepared Authorized Officer</p>
                      </div>
                      <div>
                        <div className="w-32 border-b border-slate-400 h-10"></div>
                        <p className="mt-1">Reviewed CFO Auditor</p>
                      </div>
                    </div>
                  </div>

                </div>

              </div>

              {/* Printable Modal Footer controls */}
              <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowPrintModal(false)}
                  className="px-4 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:border-slate-750 text-slate-300 rounded-lg text-xs font-mono cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-gradient-to-tr from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-slate-950 font-sans font-bold rounded-lg text-xs flex items-center gap-2 cursor-pointer text-black"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Send to Printer / Save PDF</span>
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Supabase Setup Helper Modal */}
      <AnimatePresence>
        {showSupabaseModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl w-full max-w-3xl flex flex-col max-h-[85vh]"
            >
              {/* Modal Header */}
              <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-sm uppercase font-mono tracking-wider font-bold text-white">Supabase Schema Configuration Guide</h3>
                </div>
                <button
                  onClick={() => setShowSupabaseModal(false)}
                  className="p-1 px-2.5 bg-slate-950 hover:bg-slate-850 rounded-md border border-slate-800 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-4 text-xs font-sans text-slate-300">
                <div className="space-y-1">
                  <span className="text-[10px] text-emerald-400 block uppercase tracking-wider font-mono font-bold">Durable Cloud Persistence Setup</span>
                  <p className="leading-relaxed">
                    To activate durable cloud persistence, please execute the SQL script below within your **Supabase SQL Editor** to establish the essential tables.
                  </p>
                </div>

                {/* Instructions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950 border border-slate-850 p-4 rounded-lg">
                  <div>
                    <h4 className="text-slate-200 font-bold mb-1 font-mono text-[11px]">Step 1: Open Supabase Console</h4>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      Go to your Supabase project dashboard, click on the **SQL Editor** tab from the left sidebar, and click **New Query**.
                    </p>
                  </div>
                  <div>
                    <h4 className="text-slate-200 font-bold mb-1 font-mono text-[11px]">Step 2: Copy-Paste and Run Script</h4>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      Copy the SQL script below, paste it into the editor workspace, and press the **Run** button to generate correct table structures.
                    </p>
                  </div>
                </div>

                {/* SQL Code Block */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 font-mono">schema.sql</span>
                    <button
                      onClick={() => {
                        const sqlCode = `-- Create invoices table\nCREATE TABLE IF NOT EXISTS public.invoices (\n    id TEXT PRIMARY KEY,\n    vendor TEXT NOT NULL,\n    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,\n    date TEXT NOT NULL,\n    category TEXT NOT NULL,\n    raw_content TEXT DEFAULT '',\n    original_source TEXT NOT NULL,\n    invoice_number TEXT,\n    status TEXT NOT NULL DEFAULT 'Pending Approval',\n    processed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),\n    extracted_metadata JSONB DEFAULT '{}'::jsonb\n);\n\n-- Enable Row Level Security (Optional)\nALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;\nCREATE POLICY "Enable read for anonymous users" ON public.invoices FOR SELECT USING (true);\nCREATE POLICY "Enable insert for anonymous users" ON public.invoices FOR INSERT WITH CHECK (true);\nCREATE POLICY "Enable update for anonymous users" ON public.invoices FOR UPDATE USING (true);\nCREATE POLICY "Enable delete for anonymous users" ON public.invoices FOR DELETE USING (true);\n\n-- Create audit_logs table\nCREATE TABLE IF NOT EXISTS public.audit_logs (\n    id TEXT PRIMARY KEY,\n    timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),\n    action TEXT NOT NULL,\n    "user" TEXT NOT NULL,\n    "recordId" TEXT,\n    details TEXT DEFAULT '',\n    changes JSONB DEFAULT '[]'::jsonb\n);\n\nALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;\nCREATE POLICY "Enable read/write for all client posts" ON public.audit_logs FOR ALL USING (true);`;
                        navigator.clipboard.writeText(sqlCode);
                        setSqlCopySuccess(true);
                        setTimeout(() => setSqlCopySuccess(false), 2000);
                      }}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-sans font-bold text-[10px] rounded cursor-pointer"
                    >
                      {sqlCopySuccess ? "Copied Successfully!" : "Copy SQL Script"}
                    </button>
                  </div>
                  <pre className="p-3 bg-slate-950 border border-slate-850 rounded-lg text-[10px] font-mono text-slate-300 overflow-x-auto max-h-56 leading-relaxed select-all">
{`-- Create invoices table
CREATE TABLE IF NOT EXISTS public.invoices (
    id TEXT PRIMARY KEY,
    vendor TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    date TEXT NOT NULL,
    category TEXT NOT NULL,
    raw_content TEXT DEFAULT '',
    original_source TEXT NOT NULL,
    invoice_number TEXT,
    status TEXT NOT NULL DEFAULT 'Pending Approval',
    processed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    extracted_metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable Row Level Security (Optional)
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read for anonymous users" ON public.invoices FOR SELECT USING (true);
CREATE POLICY "Enable insert for anonymous users" ON public.invoices FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for anonymous users" ON public.invoices FOR UPDATE USING (true);
CREATE POLICY "Enable delete for anonymous users" ON public.invoices FOR DELETE USING (true);

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    action TEXT NOT NULL,
    "user" TEXT NOT NULL,
    "recordId" TEXT,
    details TEXT DEFAULT '',
    changes JSONB DEFAULT '[]'::jsonb
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read/write for all client posts" ON public.audit_logs FOR ALL USING (true);`}
                  </pre>
                </div>

                {/* Confirm instructions button */}
                <div className="pt-2">
                  <p className="text-[11px] text-slate-400">
                    Once the tables are created, check back or hit "Reload Application" to refresh database cache references.
                  </p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
                <span className="text-[10px] text-slate-500 font-mono">Supabase Setup Standard v1.0.0</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      fetchData();
                      setShowSupabaseModal(false);
                    }}
                    className="px-4 py-2 bg-slate-900 border border-slate-805 hover:bg-slate-850 hover:border-slate-755 text-slate-300 rounded-lg text-xs font-mono cursor-pointer"
                  >
                    Close & Sync
                  </button>
                  <button
                    onClick={() => {
                      fetchData();
                    }}
                    className="px-4 py-2 bg-gradient-to-tr from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-slate-950 font-sans font-bold text-xs rounded-lg cursor-pointer text-black"
                  >
                    Sync Now
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
