# Chat-based model eval (claude.ai) — Opus vs Sonnet classification

Run this in claude.ai (covered by your subscription) instead of the metered API
harness. Goal: see whether Sonnet reads your scanned deal documents as accurately
as Opus, so compliance/classification can potentially move to the cheaper model.

## How to run

1. Pick **5 deals to start** (expand to 15-20 once the flow works). For each deal
   you need: the scanned file(s), and your **hand-verified correct answers**
   (doc types, VINs, dollar amounts) written down separately.
2. Open a **new chat on Claude Opus**. For each deal: upload its file(s), paste
   **PART A** below, send. Save the JSON it returns.
3. Reveal answers: paste **PART B** with your correct values filled in. Save the
   scorecard it returns.
4. Repeat steps 2-3 in a **new chat on Claude Sonnet**, same deals.
5. Bring back, per deal per model: the PART A JSON and the PART B scorecard.

Tips: use a fresh chat per model. One deal per message keeps the JSON clean. Do
NOT paste PART B until AFTER PART A has returned (keeps the read honest).

---

## PART A — extraction (paste with the uploaded scan, NO answers yet)

```
You are an F&I document classifier for a BC auto dealership.

You will receive one or more uploaded files. Each file may be a SINGLE document OR a multi-page scan containing SEVERAL different documents stapled together into one PDF.

Your job:
1. Scan every page of every file
2. Identify each distinct document — a new document starts when the page header, title, layout, or paper type changes to a completely different form
3. Extract fields from each document
4. Return ONE JSON object per distinct document found — NOT one per file

A single 30-page uploaded PDF might contain 10 separate documents. Return 10 objects.
A single 1-page uploaded PDF contains 1 document. Return 1 object.

Return ONLY a valid JSON array. No markdown, no explanation, no code fences.

Each object must follow this exact shape:
{
  "source_file": "<filename>",
  "doc_type": one of ["bill_of_sale","finance_contract","lease_agreement","credit_application","insurance_application","driver_license","trade_in_appraisal","pre_delivery_inspection","vehicle_history_report","odometer_disclosure","privacy_consent","carfax_report","lien_search","cheque_requisition","transfer_of_liability","vehicle_disclosure_statement","vehicle_registration","tax_exemption_form","deal_recap","other"],
  "signed_by_customer": true or false,
  "signed_by_dealer": true or false,
  "fields": {
    "customer_name": string or null,
    "vin": string or null,
    "year": string or null,
    "make": string or null,
    "model": string or null,
    "odometer_km": number or null,
    "sale_price": number or null,
    "trade_in_value": number or null,
    "down_payment": number or null,
    "amount_financed": number or null,
    "apr": number or null,
    "term_months": number or null,
    "monthly_payment": number or null,
    "gst_amount": number or null,
    "pst_amount": number or null,
    "lien_holder": string or null,
    "lien_amount": number or null,
    "signed_date": string or null
  }
}

Rules:
- Use null when a field is not visible. Do not invent values.
- Numbers must be numbers (35000.50), not strings ("$35,000.50").
- signed_by_customer / signed_by_dealer: look for actual signature marks, not just printed names.
```

---

## PART B — scoring (paste AFTER Part A returns, with your correct answers)

```
Here are the hand-verified correct values for this deal:

<PASTE YOUR GROUND TRUTH HERE as a JSON array in the same shape, e.g.:>
[
  { "doc_type": "bill_of_sale", "fields": { "vin": "2HGFC2F5XKH500001", "sale_price": 28999.00, "amount_financed": 24500.00 } },
  { "doc_type": "carfax_report", "fields": { "vin": "2HGFC2F5..." } }
]

Compare YOUR extraction from the previous message against these correct values
and output a scorecard. Scoring rules (be strict and mechanical):

- Align each correct document to your predicted document by matching doc_type,
  then VIN. Count an aligned pair as a doc-type hit only if doc_type matches.
- VIN match: uppercase both and strip every non-alphanumeric character, then
  compare exactly.
- Dollar match: correct if the numbers are within $0.01. Score these 8 fields
  only when the correct value is non-null: sale_price, amount_financed,
  down_payment, monthly_payment, trade_in_value, gst_amount, pst_amount,
  lien_amount.

Output exactly this, nothing else:
- Doc-type accuracy: X/Y (Z%)
- VIN accuracy: X/Y (Z%)
- Dollar accuracy: X/Y (Z%)
- Any misses, listed as: field | your value | correct value
```

---

## What to bring back to me

For each deal, both models: the three accuracy lines from Part B (and the raw
Part A JSON if you can). I'll aggregate across deals and apply the same bar the
API harness uses: a model that hits **>=98% of Opus** on doc-type, VIN, AND
dollar accuracy is a candidate to switch. The compliance call is text-only, so
strong Sonnet field-reading here is the green light to move compliance to Sonnet.
