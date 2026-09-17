## Receipt flow simplified (Sep 2026)
- Приход no longer uses patent at all: no patent photo/number, no patent mismatch check. Patent remains only on supplier cards (payables).
- Check number is entered MANUALLY — no scanReceiptDocs scanner for чек/патент. scanReceiptDocs in warehouse-ocr.functions.ts is now unused by UI.
- Duplicate check_number (normalized) warning + insert block remains. Check photo still required. docs_source always 'manual'.
- Trigger warehouse_receipts_manual_guard DROPPED (scripts/vps-schema-sync.sql) — manual entry is the standard flow now; companies.warehouse_manual_docs_allowed toggle removed from UI.
- Invoice items OCR (scanInvoiceItems, накладной → товарҳо) unchanged.

## Supplier patent/check verification (Sep 2026, superseded for receipts)
- suppliers: patent_number, patent_photo_path; bucket warehouse-docs (private, company-folder RLS).
