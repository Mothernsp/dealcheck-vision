# Golden eval set

Hand-labeled deal jackets used by `npm run eval` (`scripts/eval-models.mjs`) to
compare model accuracy. Aim for **15–20 real deals** that represent your actual
scan quality and document mix.

## Layout

One folder per deal. The folder name is just a label.

```
evals/golden/
  deal-001/
    scan.pdf            ← input file(s): the actual uploaded jacket
    expected.json       ← hand-verified expected classification
  deal-002/
    page1.jpg
    page2.jpg
    expected.json
  ...
```

- Put the **real uploaded file(s)** for the deal in the folder (same files a
  dealer would upload — PDFs and/or images).
- `expected.json` is what a correct classification *should* return. You fill this
  in by hand once per deal.

Folders starting with `.` or `_` are ignored (use `_` for templates/notes).

## `expected.json` format

An array of the distinct documents in the jacket (or `{ "documents": [ ... ] }`).
Only include fields you want scored — `doc_type`, `vin`, and the dollar fields
are what the harness measures. Use the **exact** `doc_type` strings from
`DOC_TYPES` in `lib/vision.mjs`.

```json
[
  {
    "doc_type": "bill_of_sale",
    "fields": {
      "vin": "2HKRW2H59MH123456",
      "sale_price": 35990.00,
      "down_payment": 5000.00,
      "amount_financed": 32500.50,
      "gst_amount": 1799.50,
      "pst_amount": 2519.30
    }
  },
  {
    "doc_type": "carfax_report",
    "fields": { "vin": "2HKRW2H59MH123456" }
  }
]
```

## What gets scored

| Metric | How |
|---|---|
| **DocType accuracy** | fraction of expected docs whose `doc_type` the model produced (docs aligned by type + VIN) |
| **VIN accuracy** | among expected docs with a `vin`, fraction read correctly (case/spacing-insensitive) |
| **$ accuracy** | among expected non-null dollar fields, fraction read to the cent |

Cost + latency are also reported per model. A non-baseline model that hits
**≥98%** of the baseline on all three accuracy metrics is flagged as a candidate
switch — but the switch is never made automatically.

## Running

```bash
npm run eval
# or pick models:
node scripts/eval-models.mjs --models=claude-opus-4-7,claude-sonnet-4-6
```

⚠️ Every run makes real API calls for **each deal × each model** — it costs money.
Reports are written to `evals/results/{timestamp}.md`.
