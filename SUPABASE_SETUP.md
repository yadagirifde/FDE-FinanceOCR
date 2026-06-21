# Supabase Database Setup Guide

To enable live persistent storage on Supabase and resolve schema cache errors, run the following SQL script in your **Supabase SQL Editor** (found in your Supabase Dashboard under `SQL Editor` > `New query`).

## 1. SQL Initialization Script

```sql
-- Create invoices table
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

-- Enable RLS (Optional, or disable for direct API integration)
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
CREATE POLICY "Enable read/write for all client posts" ON public.audit_logs FOR ALL USING (true);
```

## 2. Environment Variables Configuration

Ensure you have provided the following environment variable keys in the **Secrets** panel in Google AI Studio:

- `SUPABASE_URL` = `https://your-project-id.supabase.co`
- `SUPABASE_ANON_KEY` = `your-anonymous-public-key`
