## Doc type: carfax_report

### What it looks like

**Format / origin.** A multi-page (typically 6–10 pages) PDF titled **"CARFAX Canada Vehicle History Report"** generated from `vhr.carfax.ca`. Every page has identical chrome:

- **Top-left header:** generation timestamp in `MM/DD/YY, HH:MM AM/PM` format (e.g. `11/25/25, 11:27 AM`) — this is the **report retrieval time**, not the report date.
- **Top-center header:** the title "CARFAX Canada Vehicle History Report".
- **Bottom-left footer:** a long `https://vhr.carfax.ca/?id=...` URL with a URL-encoded token.
- **Bottom-right footer:** page number in `N/T` form (e.g. `1/8`, `2/8`).
- **Right margin watermark:** the **VIN printed vertically** on every page (rotated 90°). This is the most reliable VIN anchor — even if page 1 is missing or cropped, the VIN appears on every other page.

**Crucial cross-document identifier.** This VIN watermark is the single most important element on the document. The classifier must extract it and use it to tag the report's role (see "Vehicle role tagging" below).

---

### Page-by-page layout

**Page 1 — Summary / cover page.**

- **CARFAX wordmark** with red maple leaf in the upper-left band (Canadian variant).
- **Top-right info block:**
  - "Vehicle History Report + Lien Check #:" followed by an 8-digit report number (e.g. `66028837`)
  - "Report Date:" with full date and Eastern time (e.g. `November 25, 2025 | 2:11 p.m. EST`)
  - "Report Status:" — almost always `Complete`
  - "Reference:" — optional dealer-supplied reference string, often blank
- **Vehicle headline** in large bold type: `YEAR MAKE MODEL TRIM` (e.g. `2022 DODGE DURANGO GT`). The trim (`GT`, `SXT`, `Limited`, `R/T`, etc.) is appended to the model — note this for the field mapping.
- **Vehicle attribute line:** body style | cylinder count | fuel type (e.g. `Sport utility vehicle | 6 Cylinders | Flexible`).
- **VIN** printed directly below.
- **"Country of Assembly:"** (e.g. `United States`).
- **"Last Reported Odometer:"** in KM (e.g. `93,645 KM`). This is the odometer at the most recent reporting event in CARFAX's data, NOT necessarily the current reading.
- **Status icon grid** — a 3×3 or 4×2 grid of grey circular icons, each with a status caption underneath. Eight status tiles total:
  1. **LIEN CHECK** — `Lien Record(s) Found` (alert) or `No Lien Records Found` (clear).
  2. **Accident/Damage** — `No Accident/Damage Records Found` or `N Accident/Damage Record(s) Found`
  3. **Registration** — `Last Registered In:` followed by province + branding in parens, e.g. `Alberta (Normal)`. Branding values: `Normal`, `Salvage`, `Rebuilt`, `Non-repairable`, `Inspection Required`.
  4. **Service Records** — `N Service Records Found`
  5. **U.S. History** — `No U.S. History Found` or details
  6. **Open Recalls** — `N Open Recall(s) Found` or `No Open Recalls`
  7. **Stolen Check** — `Not Actively Declared Stolen` or stolen alert
  8. **Import/Export** — `No Import/Export Records Found` or details

**Page 2 — Lien Check, Accident/Damage, Registration, Service Records (start).**

- **Lien Check** section: green-check banner (`No Lien Records Found`) or alert banner (`Lien Record(s) found in [Province]`).
- **Accident/Damage** section: single banner or itemized accident details.
- **Registration** section: `This vehicle has been registered in the province of [PROVINCE] in Canada with [BRANDING] branding.`
- **Service Records** section: four-column table `DATE | ODOMETER | SOURCE | DETAILS`. Often spills onto page 3.

**Page 3 — Service Records (continued), Open Recalls, Stolen Vehicle Check.**

- **Open Recalls** section: each recall in a bordered box with `Recall #:`, title, `Recall Date:`, `Recall Description`, and `Remedy`.

**Page 4–5 — Detailed History.**

- Five-column table: `DATE | ODOMETER | SOURCE | RECORD TYPE | DETAILS`. Sorted chronologically. The Details column for renewals often contains **"Previous Use:"** markers (`Personal`, `Rental`, `Lease`, `Commercial`, `Taxi`, `Police`, `Government`) and `Vehicle colour noted as ___`.

**Pages 6–8 (only present when liens found) — Lien Details.**

- Raw dump of provincial Personal Property Registry (PPR) results. Each lien block contains:
  - `Search ID #:`, `Serial Number Collateral Search For:` (VIN), `Date of Search:`, `Time of Search:`
  - `Registration Number:`, `Registration Date:`, `Registration Type:` (usually `SECURITY AGREEMENT`), `Registration Status:` (usually `Current`), `Expiry Date:`
  - **`Debtor(s)`** block — borrower names and addresses. Multiple name variants of the same person are alias blocks, NOT separate debtors.
  - **`Secured Party / Parties`** block — the **lienholder/lender** name and address (e.g. `TD AUTO FINANCE (CANADA) INC.`, `RIFCO NATIONAL AUTO FINANCE CORPORATION`, `ICEBERG FINANCE INC.`, `SCOTIABANK`).
- **CRITICAL:** A single CARFAX report can contain **multiple lien blocks** (multiple liens registered against the same VIN). Extract ALL of them.
- **CRITICAL:** PPR lien blocks do NOT contain dollar amounts. `lien_amount` will almost always be `null` from CARFAX alone.

---

### Vehicle role tagging (cross-document reconciliation)

A complete deal scan typically contains TWO CARFAX reports — one for the subject vehicle and one for the trade-in. Distinguish them by matching the CARFAX VIN against VINs found elsewhere in the scan:

- CARFAX VIN == BOS `vin` → set `vehicle_role` to `"subject_vehicle"`
- CARFAX VIN == BOS `trade_in_vin` → set `vehicle_role` to `"trade_in"`
- No match or no BOS present → set `vehicle_role` to `"unknown"`

Do NOT guess role from year/make/model alone — many deals involve trading in the same make/model for a newer one. VIN match is the only reliable signal.

---

### Cross-document discrepancy detection

When paired with a BOS, populate a `discrepancies` array flagging:

| Check | Flag when |
|---|---|
| Out-of-province registration | CARFAX shows last registered in non-BC but BOS declaration 3(a) says "No" |
| Prior rental/commercial use | CARFAX shows non-"Personal" prior use but BOS declaration 2 says "No" |
| Accident/damage history | CARFAX shows accidents but BOS declaration 4 says "No" |
| Odometer plausibility | BOS odometer < CARFAX last reported (rollback indicator) |
| Brand status | CARFAX brand is anything other than `Normal` — always flag |
| Lien on trade-in vs. disclosed | CARFAX shows liens but BOS lien fields are blank/N/A |
| VIN mismatch / typo | Single-character difference between CARFAX VIN and BOS VIN |
| Open safety recall | Always note open recalls in discrepancies for buyer awareness |
| Stolen vehicle | Any active stolen alert — hard stop, escalate |

Each discrepancy: `{ "field": "...", "carfax_value": "...", "bos_value": "...", "severity": "low|medium|high" }`.

---

### Field label mapping

- `vin` → labeled **"VIN"** on page 1, AND printed vertically as watermark on every page's right margin
- `year` / `make` → first two tokens of the page-1 vehicle headline
- `model` → third+ tokens of the headline, **including trim suffix** (e.g. `DURANGO GT`)
- `colour` → NOT on page 1. Pull from Detailed History — look for `Vehicle colour noted as ___` in `Canadian Renewal` DETAILS cells. Use the most recent renewal's colour.
- `odometer_km` → labeled **"Last Reported Odometer:"** on page 1 (always km for CARFAX Canada)
- `province` → province inside parens on the page-1 "Last Registered In:" tile (e.g. `Alberta` from `Alberta (Normal)`)
- `lien_holder` → labeled as **"Secured Party / Parties"** in each Lien Details block. If multiple liens, capture as array — strip address, keep only corporate name.
- `lien_amount` → **almost always `null` from CARFAX.** PPR registrations don't record dollar amounts.
- `customer_name`, `customer_address`, `dealer_name`, `salesperson`, `sale_price`, `trade_in_value`, `trade_in_vin`, `down_payment`, `amount_financed`, `apr`, `term_months`, `monthly_payment`, `gst_amount`, `pst_amount`, `signed_date` → **all `null` for CARFAX.** This is a vehicle report, not a transaction document.
- **NEVER populate `customer_name` from CARFAX debtor data** — the Lien Details debtor is the trade-in's prior owner, not the dealership's customer.
- `fees` → empty array
- `products` → empty array

### Correct extraction example

```json
{
  "doc_type": "carfax_report",
  "vehicle_role": "trade_in",
  "signed_by_customer": false,
  "signed_by_dealer": false,
  "fields": {
    "customer_name": null,
    "customer_address": null,
    "vin": "1C4RDJDG9NC994215",
    "year": 2022,
    "make": "DODGE",
    "model": "DURANGO GT",
    "colour": "medium gray",
    "odometer_km": 93645,
    "sale_price": null,
    "trade_in_value": null,
    "trade_in_vin": null,
    "down_payment": null,
    "amount_financed": null,
    "apr": null,
    "term_months": null,
    "monthly_payment": null,
    "gst_amount": null,
    "pst_amount": null,
    "province": "Alberta",
    "lien_holder": [
      "TD AUTO FINANCE (CANADA) INC.",
      "RIFCO NATIONAL AUTO FINANCE CORPORATION",
      "ICEBERG FINANCE INC."
    ],
    "lien_amount": null,
    "dealer_name": null,
    "salesperson": null,
    "signed_date": null,
    "fees": [],
    "products": [],
    "notes": "CARFAX Canada Vehicle History Report #74119503, pulled 2025-09-10 at 11:27 AM EST. Three current lien registrations in Alberta PPR. PPR records do not include dollar amounts — payoff figures must come from BOS or lien payout statement. Last reported odometer 93,645 KM. Eleven service records, no reported accidents, one open recall (#55B — ABS Control Module software). Not declared stolen, no US history. Registration brand Normal. Previous Use: Rental for first three registration renewals (2022), Personal thereafter — former rental fleet unit."
  },
  "carfax_summary": {
    "report_number": "74119503",
    "report_date": "2025-09-10",
    "accident_count": 0,
    "service_record_count": 11,
    "open_recall_count": 1,
    "open_recall_ids": ["55B"],
    "registration_brand": "Normal",
    "us_history": false,
    "stolen": false,
    "import_export": false,
    "prior_uses": ["Rental", "Personal"],
    "lien_count": 3
  },
  "discrepancies": [
    {
      "field": "trade_in_declaration_2_prior_use",
      "carfax_value": "Previous Use: Rental (2022 Jun, Jul, Sep registration renewals)",
      "bos_value": "No (declaration 2 marked No on BOS trade-in declarations)",
      "severity": "high"
    },
    {
      "field": "trade_in_declaration_3a_registered_outside_bc",
      "carfax_value": "Last registered in Alberta",
      "bos_value": "Trade-in declaration 3(a) blank on BOS",
      "severity": "medium"
    },
    {
      "field": "trade_in_lien_count",
      "carfax_value": "3 active liens in Alberta PPR (TD Auto Finance, Rifco, Iceberg Finance)",
      "bos_value": "BOS shows single 'Owing to: N/A' on trade-in block with $67,000 estimated lien amount",
      "severity": "high"
    },
    {
      "field": "open_safety_recall",
      "carfax_value": "Recall #55B (ABS Control Module software) open as of report date",
      "bos_value": "BOS has no recall disclosure field",
      "severity": "low"
    }
  ]
}
```
