## Doc type: deal_recap

> **Schema note:** `deal_recap` has been added to the `doc_type` enum. If you encounter a deal recap before this enum update is deployed, set `doc_type` to `other` and put `"actual_type": "deal_recap"` in `notes`.

### What it looks like

**Format / origin.** A 2-page (sometimes more), portrait, computer-generated PDF produced by the **Tekion DMS** (Tekion Corp's dealership management system). The footer of every page reads `© Tekion Corp 2025` on the bottom-left and `Page N of T` plus a print timestamp on the bottom-right. There is NO dealer letterhead, NO logo, NO printed title bar at the top — Tekion recaps are visually minimalist. The structural giveaway is the **three-block header layout** at the top of page 1 followed by **four labeled accounting sections** (Front Gross → Back Gross → Total Sales → Other Charges).

**Definitive identifier:** The phrase **"Deal Recap"** in large bold type in the top-right header, accompanied by a deal number, a status word (`In Recap`, `Closed`, `Pre-close`, etc.), and a status date. The Tekion footer is the secondary confirmation.

---

### Page 1 layout

**Top-of-page header — three horizontal blocks, no border.**

- **Top-left block:** the dealership's **legal operating entity name** — typically a BC numbered company like `1231937 BC Ltd.` This will NOT match the consumer-facing dealer brand on the BOS (e.g. "Applewood Chevrolet Buick GMC"). Record as `dealer_name` and flag the brand/entity difference as expected.
- **Top-center block:** **Customer information**, no field labels — raw values stacked vertically:
  - Line 1: Customer full name
  - Line 2: Customer account/ID number (Tekion internal ID, e.g. `1033510`)
  - Line 3: Phone number with country code (`+1-(778) 214-3108`)
  - Line 4: Email
  - Line 5: Street address
  - Line 6: City + sub-region + province (e.g. `Stony Plain Parkland AB` — Tekion concatenates without commas)
  - Line 7: Postal code (lowercase in source)
- **Top-right block:** **Deal metadata**:
  - "Deal Recap" (the title)
  - Deal number in large bold (e.g. `18127`) — **must match BOS "Seller's Contract #"**
  - Status string (`In Recap`, `Booked`, `Closed`, `Pre-Close`, etc.)
  - A date with month spelled out (`Nov 21 2025`) — the status date

**Second header band — three more horizontal blocks.**

- **Left block — Vehicle information:**
  - Year + Make + Model on line 1 (`2024 Dodge Durango`)
  - Stock number with `#` prefix and `Used`/`New` pill (`#P5477 Used`)
  - VIN on line 3
  - Odometer + unit on line 4 (`33940 km`)
- **Middle block — Finance terms** (no label — infer from content):
  - Lender code on line 1 (`TDCA` = TD Auto Finance Canada, `RFCO` = Rifco, `RBC`, `SCOTIA`, `ICEBERG`, etc.)
  - Payment + frequency suffix (`$597.50/bi` — `/bi` = biweekly, `/wk` = weekly, `/mo` = monthly, `/semi` = semi-monthly)
  - Amount Financed (`$96,852.18 Amount Financed`)
  - First payment date (`Dec 5 2025 First Payment Date`)
  - **Three percentage rates:** `6.49% 6.49% 0% Sell/Buy/Spread` — sell rate (APR to customer) / buy rate (lender charges dealer) / spread (dealer captures as Finance Reserve)
  - Term (`Term 96 Bi` means 96 biweekly periods, **NOT 96 months**)
- **Right block — Deal lifecycle dates:**
  - `Reserved Date:`, `Sold Date:`, `Contract Date:`, `Pre-close Date:`, `Final Accounting Date:`

---

### Accounting sections (page 1 main body)

Each section: `[Section Name] | Description | Sale | Cost | Dealer Gross`

**Section 1: Front Gross.**

- **Vehicle Sale** row: Sale = retail price (**must match BOS "Price of Vehicle"**)
- **Trade-ins** row group: trade allowance in Sale column. Sub-rows show trade-in VIN, `Trade Payoff: $X`, `LIEN PAYOFF | Lien Amt: $X` (informational)
- **Accessories** row group: dealer-added items charged to customer. Each should have both Sale AND Cost — Sale without Cost means 100% margin (suspicious for warranty products).
- **Cost Adjustments** row group: dealer-side cost lines (Sale blank, Cost positive, Gross negative). Key entries:
  - `AP7 Policy Accrual` / `AP7 Pack` — internal dealer packs, not customer-facing
  - `DEALER PREP USED` — reconditioning cost
  - **`LIEN PAYOUT [LENDER]`** — **THE TRADE-IN LIEN PAYOFF AS A COST.** If trade has a lien but no LIEN PAYOUT cost line exists, the lien payout is NOT set up and the deal cannot close — always flag this.

**Section 2: Back Gross.**

- `Financial Res...` (Financial Reserve) row: reserve the lender pays dealer for placing the loan. Cost = $0.
- F&I-sold products (warranty, GAP, life/disability) appear here with both Sale and Cost.

**Section 3: Total Sales.** Summary of Front + Back Gross totals.

**Section 4: Other Charges.** Pass-through charges collected and remitted to third parties. Single `Amount` column. Common entries: `Dealer Prep - Used`, `PPSA Fee`, `Lender Admin Fee`, `Tire Levy`, `Federal Luxury Tax`.

---

### Field label mapping

- `customer_name` → first line of top-center customer block (no label)
- `customer_address` → lines 5–7 of top-center block joined: street + city/sub-region + province + postal code
- `vin` → line 3 of vehicle block (17-character alphanumeric, no label)
- `year` / `make` → first tokens of vehicle block line 1
- `model` → remaining tokens of line 1 (trim rarely included on recap)
- `colour` → NOT on recap, use `null`
- `odometer_km` → line 4 of vehicle block (suffix `km`)
- `sale_price` → `Sale` column on **Vehicle Sale** row of Front Gross. NOT Total Sales total.
- `trade_in_value` → `Sale` column on **Trade-ins** row of Front Gross
- `trade_in_vin` → VIN sub-row inside Trade-ins group
- `down_payment` → NOT on page 1; may appear on page 2 as "Cash Down". Use `null` if page 2 absent.
- `amount_financed` → labeled **"Amount Financed"** in finance middle block
- `apr` → **first** percentage on `Sell/Buy/Spread` line (the Sell rate)
- `term_months` → **CRITICAL — only if frequency is `Mo`.** For `Bi`, convert: biweekly term ÷ 2.1667 ≈ months. For `Wk`: ÷ 4.333. Store raw term in `notes` and converted months in `term_months`, or leave `null` if conversion is unreliable. `Term 96 Bi` = ~44 months, NOT 96 months.
- `monthly_payment` → payment value only if frequency suffix is `/mo`. For `/bi`, `/wk`, `/semi`: set `monthly_payment` to `null` and note actual payment + frequency in `notes`.
- `gst_amount` / `pst_amount` → NOT broken out on page 1; appear on page 2 or must be inferred. Use `null` if page 2 absent.
- `lien_holder` → lender names from `LIEN PAYOUT [LENDER]` cost-adjustment rows. If multiple, capture as array.
- `lien_amount` → cost value on `LIEN PAYOUT [LENDER]` rows (trade-in lien payout)
- `dealer_name` → legal entity from top-left block (e.g. `1231937 BC Ltd.`). Flag expected mismatch with BOS trade name — not a discrepancy.
- `salesperson` → NOT on page 1. Use `null`.
- `signed_date` → recap is not signed. Use `Contract Date:` from dates block as deal date; keep `signed_date` technically `null`.
- `fees` → all Other Charges section line items as `{label, amount}` pairs
- `products` → F&I products from Back Gross (excluding Financial Reserve) as `{name, price}` where price = Sale value

---

### Cross-document reconciliation checks (recap vs. BOS)

Populate a `discrepancies` array:

| Check | Flag when |
|---|---|
| Deal number match | Recap deal number ≠ BOS "Seller's Contract #" |
| Vehicle price match | Front Gross Vehicle Sale ≠ BOS "Price of Vehicle" |
| Trade allowance match | Front Gross Trade-ins Sale ≠ BOS "TRADE-IN ALLOWANCE" |
| Trade VIN match | Front Gross trade VIN ≠ BOS trade-in "VIN #" |
| **Trade payoff set up** | Recap missing LIEN PAYOUT cost line when BOS shows lien payout > 0 |
| Trade payoff amount match | Sum of LIEN PAYOUT rows ≠ BOS "Lien payout on Trade-in" |
| Amount financed match | Recap "Amount Financed" ≠ BOS "AMOUNT TO FINANCE" |
| APR match | Recap sell rate ≠ BOS interest rate |
| Term match | Converted months ≠ BOS term in months |
| Payment match | Frequencies differ, OR same-frequency amounts differ by more than $1 |
| Contract date match | Recap "Contract Date" ≠ BOS signed date |
| PPSA fee match | Other Charges PPSA Fee ≠ BOS "PPSA fee" |
| **Warranty has matching cost** | Sale populated but Cost blank/zero — product sold without disclosed provider cost |
| Warranty appears on BOS | Recap shows customer-charged product but BOS doesn't show it |
| Dealer Prep double-counting | Dealer Prep in BOTH Cost Adjustments AND Other Charges — verify not double-billed |
| CARFAX liens accounted for | CARFAX shows N liens on trade-in but recap shows M < N LIEN PAYOUT lines |

Each discrepancy: `{ "field": "...", "recap_value": "...", "bos_value": "...", "severity": "low|medium|high" }`.

---

### Correct extraction example

```json
{
  "doc_type": "deal_recap",
  "signed_by_customer": false,
  "signed_by_dealer": false,
  "fields": {
    "customer_name": "JORDAN MACKENZIE",
    "customer_address": "4827 ALDERWOOD CRESCENT, SURREY BC, V3T 1A4",
    "vin": "1C4RDJDGXRC998742",
    "year": 2024,
    "make": "Dodge",
    "model": "Durango",
    "colour": null,
    "odometer_km": 33940,
    "sale_price": 56950.0,
    "trade_in_value": 30500.0,
    "trade_in_vin": "1C4RDJDG9NC994215",
    "down_payment": null,
    "amount_financed": 96852.18,
    "apr": 6.49,
    "term_months": 44,
    "monthly_payment": null,
    "gst_amount": null,
    "pst_amount": null,
    "province": "BC",
    "lien_holder": ["TDCA", "ICEBERG"],
    "lien_amount": 70474.71,
    "dealer_name": "1231937 BC Ltd.",
    "salesperson": null,
    "signed_date": null,
    "fees": [
      { "label": "Dealer Prep - Used", "amount": 795.0 },
      { "label": "PPSA Fee", "amount": 41.73 },
      { "label": "Lender Admin Fee", "amount": 149.0 }
    ],
    "products": [],
    "notes": "Tekion DMS deal recap, deal #18127, status 'In Recap' as of Nov 21 2025. Page 1 of 2 — page 2 not provided (likely contains tax breakdown and salesperson). Finance terms: 96 biweekly payments at $597.50/bi = ~44 months equivalent (NOT 96 months). Sell/Buy/Spread = 6.49%/6.49%/0%. Front Gross $2,879.29, Back Gross $692.13 (finance reserve flat placement, no spread). Two trade-in lien payouts: $67,000 main payoff + $3,474.71 to Iceberg Finance (Iceberg lien NOT on BOS). DEALER PREP USED ($795) appears in both Front Gross Cost Adjustments and Other Charges — verify not double-billed. AP7 Policy Accrual ($500) and AP7 Pack ($3,000) are internal dealer packs, not customer charges."
  },
  "recap_accounting": {
    "front_gross": { "sale": 88454.0, "cost": 85574.71, "dealer_gross": 2879.29 },
    "back_gross": { "sale": 692.13, "cost": 0.0, "dealer_gross": 692.13 },
    "total_sales": { "sale": 89146.13, "cost": 85574.71, "dealer_gross": 3571.42 },
    "finance_reserve": 692.13,
    "rate_spread": { "sell": 6.49, "buy": 6.49, "spread": 0.0 },
    "deal_number": "18127",
    "deal_status": "In Recap",
    "dealer_legal_entity": "1231937 BC Ltd.",
    "lender_code": "TDCA",
    "payment_amount": 597.5,
    "payment_frequency": "biweekly",
    "term_count": 96,
    "term_frequency": "biweekly",
    "first_payment_date": "2025-12-05",
    "contract_date": "2025-11-21"
  },
  "discrepancies": [
    {
      "field": "trade_in_lien_payouts",
      "recap_value": "Two LIEN PAYOUT lines: $67,000 + $3,474.71 (Iceberg)",
      "bos_value": "Single 'Lien payout on Trade-in' of $67,000, Owing to: N/A",
      "severity": "high"
    },
    {
      "field": "term_unit_mismatch",
      "recap_value": "96 biweekly periods (~44 months)",
      "bos_value": "96 months (BOS Financing Conditions sentence)",
      "severity": "high",
      "note": "BOS wording is almost certainly a clerical error. Recap (96 bi) is the truth. Flag for F&I to correct the BOS or finance contract."
    }
  ]
}
```
