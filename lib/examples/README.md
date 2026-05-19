# Doc-type guides — "training" the vision classifier

Unlike the Textract version, Claude Vision reads the actual PDF directly — there is no
OCR text to paste. Examples here are **text descriptions** of what each document looks
like visually. Claude reads these at classification time and uses them to match your
specific dealer's document layouts.

Every `.md` file in this directory is appended to the classifier's system prompt at
module load. `README.md` is skipped. No code change needed — just drop in `.md` files
and restart the dev server.

## How to add a guide

1. Upload a single PDF to a new deal and watch the server terminal for:
   ```
   ========== VISION DUMP: your-doc.pdf ==========
   --- CLAUDE GUESSED ---
   { "doc_type": "other", ... }
   ```
2. If Claude got it **wrong** (e.g. said `other` for a Bill of Sale), write a guide
   for that doc type describing its visual layout.
3. If Claude got it **right**, a guide is still useful for rare or unusual formats.
4. Save as `<doc_type>__<short_label>.md` (e.g. `bill_of_sale__rsa_dealer.md`).

## File format

````markdown
## Doc type: bill_of_sale

### What it looks like

**Format / origin.** A single-page, portrait, densely packed pre-printed BC industry form titled **"MOTOR VEHICLE PURCHASE AGREEMENT (the Agreement)"** in the top center. The form is published jointly by the **NCDA** (New Car Dealers Association of BC) and **RVDA** (Recreation Vehicle Dealers Association of BC), with their twin logos in the top-right corner alongside an **ARA Automotive Retailing Association** stamp. Footer reads "The Motor Vehicle Sales Authority of B.C." with form revision code (e.g. "NOTE CONDITIONS ON REVERSE REV.05/22 © 2022"). When executed electronically, a **Docusign Envelope ID** strip runs along the very top edge above the seller header. The Applewood Chevrolet Buick GMC version of this form has a partial header stamp "T BUICK GMC PO BOX 759, PORT HARDY, BC V0N 2P0" bleeding in from the left margin at the top — this is dealer-specific letterhead and can be ignored.

**Overall layout: two columns running the full height of the page.**

The **left column** holds all narrative/identification content, top to bottom:

1. **Seller Identification (the "Seller")** — dealer name, street address, GST #, phone, fax, dealer #, and "Seller's Contract #" (a sequential contract number unique to this dealer).
2. **Buyer Identification (the "Buyer")** — includes a checkbox "Tick this box if the Buyer is under 19 years of age", contract date, buyer's printed name(s), DL #, street address, e-mail address, city/province, postal code, and four phone fields (Bus. Tel, Res. Tel, Cell Tel, Fax).
3. **Description of Vehicle (the "Vehicle")** — Year, Make, Series & Model, # of Cylinders, Odometer with Km/Mi checkboxes, Colour ext., Colour int. (optional), VIN #, Stock #, RV Coach VIN #, Year Coach, SVW/Camper Net Weight.
4. **Vehicle Declarations** — six numbered yes/no statements with checkboxes in two narrow columns at the right edge of the section: (1) suitability for transportation, (2) prior use as taxi/police/emergency/racing/rental, (3a) previously registered outside BC + jurisdiction line and (3b) brought into BC for resale, (4) damages over $2,000, (5) for new vehicles, damage >20% of asking price, (6) odometer accuracy.
5. **Description of Trade-in** — same vehicle fields as above, repeated for **two possible trade-ins** stacked vertically (T1 and T2), plus "Estimated amount of lien" and "Owing to" lines for each.
6. **Trade-in Declarations** — six yes/no statements mirroring the vehicle declarations, with two pairs of yes/no columns (one pair per trade-in: T1 and T2).
7. **"Is there an addendum to this contract?"** — single yes/no row.
8. **Confirmation of Offer to Purchase** — multi-paragraph fine-print legal block. Below it: **two buyer signature lines** (Buyer's signature + Date, repeated for a co-buyer), and a "Personal Information" consent paragraph with three small checkboxes ("The Seller CONSENTS to (Tick all that apply)") for marketing/manufacturer info sharing.
9. **Seller's Acceptance** — "Accepted by [dealer name] Dealer", then **Signature** + License #, then **Salesperson's Name** + License #, then a **"RECEIPT OF AGREEMENT"** line at the bottom with buyer's initials confirming a copy was received.

The **right column** is the entire **PURCHASE PRICE CALCULATION** ledger, with a thin vertical tax-treatment indicator running down the left edge of the column labeling each block as **"G.S.T. & P.S.T."**, **"G.S.T. ONLY"**, or **"NO TAX"** (rotated text). The ledger runs top to bottom:

- Price of Vehicle
- Additional equipment, services or warranties (several blank label lines where dealer-added items are hand-written — on this dealer's form, lines used include "DEALER PREP - USED", "FINANCE PLACEMENT FEE", "Extended Vehicle Warranty", "LENDER ADMIN FEE")
- Administrative/Documentation fees
- BC tire advance disposal fee (with "tires @ $\_\_\_ per tire" sub-line)
- An xxxxx'd-out / struck-through line (legacy field, ignore)
- **TOTAL VEHICLE PRICE**
- FEDERAL LUXURY TAX
- TRADE-IN ALLOWANCE
- PRICE DIFFERENCE
- **PURCHASE PRICE**
- GST on purchase price (with "Buyer's GST number" sub-field)
- PST on purchase price (with "Buyer's PST number" sub-field)
- Less manufacturer's rebate
- Disability Insurance / Critical Illness
- Life Insurance
- **PURCHASE PRICE WITH GST/PST**
- Lien payout on Trade-in
- **TOTAL PURCHASE PRICE**
- Payments (non-refundable, "as provided in paragraph 5")
- Deposit
- **BALANCE OWING**
- PPSA fee
- **AMOUNT TO FINANCE**

At the very bottom right is a **Financing Conditions** block: three frequency checkboxes ("Weekly / Bi-Weekly / Monthly"), two arrangement checkboxes ("Seller to arrange financing" / "Not applicable" / "Buyer to arrange financing"), and a sentence with four hand-filled blanks: **"This Agreement is subject to the Seller arranging Buyer financing for the sum of $**\_\_** at an interest rate not to exceed \_**\_% per year, with a term not to exceed \_\_** months, and a payment not to exceed $**\_\_** [FREQUENCY]"**. The frequency word (e.g. "EVERY 2 WEEKS", "MONTHLY") is typed in caps next to the payment amount.

**Signature elements.**

- Two **Buyer signature** lines (primary + co-buyer), each with its own date. Second line is often "N/A".
- One **Dealer signature** line under "Accepted by [dealer name]".
- One **Salesperson's Name** line (printed name, not a signature).
- One **buyer initials** line at the very bottom right confirming receipt.
- When Docusigned, signatures appear as cursive font renderings rather than wet-ink scrawls, and the Docusign Envelope ID is the unmissable tell at the top.

**Distinctive markers for THIS dealer (Applewood Chevrolet Buick GMC, Port Hardy).**

- Pre-printed dealer block: "APPLEWOOD CHEVROLET BUICK GMC / 9045 GRANVILLE STREET, PORT HARDY, BC V0N 2P0".
- GST # 75873 6532 RT0001, Dealer # 41668.
- Phone (250)949-7442, Fax (250)949-7440.
- "DEALER PREP - USED", "FINANCE PLACEMENT FEE", and "LENDER ADMIN FEE" are routinely written into the "Additional equipment, services or warranties" lines.
- A header line "T BUICK GMC PO BOX 759, PORT HARDY, BC V0N 2P0" appears half-cut at the top of the page — this is the dealer's mailing-address letterhead, not relevant to extraction.

### Field label mapping

This is the single most important section for this form — most of the printed labels do NOT match the JSON field names.

- `customer_name` → labeled as **"Names"** on this form (under "Buyer Identification")
- `customer_address` → built from **"Address / Chief Executive Office Address"** + **"Postal Code"** rows; city/province sits on the unlabeled line just left of "Postal Code"
- `vin` → labeled as **"VIN #"** under "Description of Vehicle"
- `year` / `make` / `model` → labeled as **"Year"**, **"Make"**, **"Series & Model"** (note: the model is on the "Series & Model" line, not a standalone "Model" field)
- `colour` → labeled as **"Colour - ext."** (exterior); "Colour - int. (optional)" exists but is usually blank
- `odometer_km` → labeled as **"Odometer"** with adjacent **"Km" / "Mi"** checkboxes — only extract as `odometer_km` if the Km box is ticked
- `sale_price` → labeled as **"Price of Vehicle"** (the very top line of the right-column ledger). Do NOT use "PURCHASE PRICE" or "TOTAL PURCHASE PRICE" — those are post-trade-in / post-tax totals.
- `trade_in_value` → labeled as **"TRADE-IN ALLOWANCE"** (NOT "Estimated amount of lien" — that's the payout owing on the trade-in)
- `trade_in_vin` → the **"VIN #"** under the "Description of Trade-in" block (first trade-in row; second row is usually blank)
- `down_payment` → labeled as **"Deposit"** in the lower-right ledger
- `amount_financed` → labeled as **"AMOUNT TO FINANCE"** (bottom of right-column ledger, after PPSA fee is added to Balance Owing)
- `apr` → the percent blank inside the Financing Conditions sentence: "...at an interest rate not to exceed \_\_\_\_% per year..."
- `term_months` → the months blank inside the same sentence: "...with a term not to exceed \_\_\_\_ months..."
- `monthly_payment` → the dollar blank inside the same sentence: "...a payment not to exceed $\_\_\_\_ [FREQUENCY]". **CRITICAL:** this is not always monthly. The frequency word (MONTHLY / BIWEEKLY / EVERY 2 WEEKS / WEEKLY) is typed in caps after the dollar amount, and is also indicated by the Weekly/Bi-Weekly/Monthly checkbox row. If the payment is not monthly, set `monthly_payment` to `null` and put the actual payment + frequency in `notes` and/or in `fees` as a labeled line — do not silently store a biweekly figure in the `monthly_payment` field.
- `gst_amount` → labeled as **"GST on purchase price"**
- `pst_amount` → labeled as **"PST on purchase price"**
- `lien_holder` → labeled as **"Owing to"** under the Trade-in block (i.e. the lienholder is on the trade-in being paid out, not on the purchased vehicle). May be a bank, finance co., or "N/A".
- `lien_amount` → labeled as **"Estimated amount of lien"** under the Trade-in block; should match the **"Lien payout on Trade-in"** line in the right-column ledger. Use the right-column ledger value when the two differ.
- `dealer_name` → the dealer name printed in the Seller Identification block (top-left), repeated again in the "Accepted by \_\_\_ Dealer" line near the bottom
- `salesperson` → labeled as **"Salesperson's Name"** (NOT the unlabeled "Signature" line above it, which is the dealer principal's signature)
- `signed_date` → the **"Date"** field next to the Buyer's signature (top buyer line), formatted YYYY-MM-DD on this form
- `fees` → all hand-written lines under "Additional equipment, services or warranties" PLUS "Administrative/Documentation fees", "BC tire advance disposal fee", and "PPSA fee". On this dealer's form these typically include: "DEALER PREP - USED", "FINANCE PLACEMENT FEE", "LENDER ADMIN FEE", "PPSA fee".
- `products` → "Extended Vehicle Warranty", "Disability Insurance / Critical Illness", "Life Insurance" (each pre-printed; capture only if a price is filled in)
- `province` → the buyer's province from the Buyer Identification block (the unlabeled token between city and Postal Code, e.g. "BC", "AB"). Do NOT default to BC just because the dealer is in BC; this form is regularly used for out-of-province buyers.

**Signature detection.**

- `signed_by_customer` → true if the top **Buyer's signature** line contains any mark (cursive Docusign rendering, wet-ink scrawl, or typed name). The "N/A" on the second buyer line does not count.
- `signed_by_dealer` → true if the **Signature** line under "Accepted by [dealer]" contains any mark. The printed Salesperson's Name does not by itself satisfy this — look for the signature line above it.

### Correct extraction example

```json
{
  "doc_type": "bill_of_sale",
  "signed_by_customer": true,
  "signed_by_dealer": true,
  "fields": {
    "customer_name": "JORDAN MACKENZIE",
    "customer_address": "4827 ALDERWOOD CRESCENT, SURREY, BC V3T 1A4",
    "vin": "1C4RDJDGXRC998742",
    "year": 2024,
    "make": "DODGE",
    "model": "DURANGO",
    "colour": "WHITE",
    "odometer_km": 33940,
    "sale_price": 56950.0,
    "trade_in_value": 30500.0,
    "trade_in_vin": "1C4RDJDG9NC994215",
    "down_payment": null,
    "amount_financed": 96852.18,
    "apr": 6.49,
    "term_months": 96,
    "monthly_payment": null,
    "gst_amount": 1412.45,
    "pst_amount": 0.0,
    "province": "BC",
    "lien_holder": null,
    "lien_amount": 67000.0,
    "dealer_name": "APPLEWOOD CHEVROLET BUICK GMC",
    "salesperson": "ASHLEY RAFAOUI",
    "signed_date": "2025-09-15",
    "fees": [
      { "label": "DEALER PREP - USED", "amount": 795.0 },
      { "label": "FINANCE PLACEMENT FEE", "amount": 1004.0 },
      { "label": "LENDER ADMIN FEE", "amount": 149.0 },
      { "label": "PPSA fee", "amount": 41.73 }
    ],
    "products": [],
    "notes": "Financing is BIWEEKLY at $605.57 every 2 weeks, not monthly. Trade-in is a 2022 Dodge Durango with a $67,000 lien payout absorbed into the financed amount. Buyer is from out of province (BC dealer, BC-resident buyer in this example); verify PST treatment matches buyer's province. Signed via Docusign (Envelope ID present at top of page)."
  }
}
```
````

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
- **Status icon grid** — a 3×3 or 4×2 grid of grey circular icons, each with a status caption underneath. Each icon has an **alert dot** (orange circle with `!`) if something was found, or no dot / green check if clear. Eight status tiles total:
  1. **LIEN CHECK** — `Lien Record(s) Found` (alert) or `No Lien Records Found` (clear). Always labeled "LIEN CHECK" above the icon.
  2. **Accident/Damage** — `No Accident/Damage Records Found` (clear) or `N Accident/Damage Record(s) Found` (alert)
  3. **Registration** — `Last Registered In:` followed by the province + branding in parens, e.g. `Alberta (Normal)`. Branding values include `Normal`, `Salvage`, `Rebuilt`, `Non-repairable`, `Inspection Required`.
  4. **Service Records** — `N Service Records Found` (always numeric)
  5. **U.S. History** — `No U.S. History Found` (clear) or details of US records (alert)
  6. **Open Recalls** — `N Open Recall(s) Found` (alert if N > 0) or `No Open Recalls`
  7. **Stolen Check** — `Not Actively Declared Stolen` (clear) or stolen alert
  8. **Import/Export** — `No Import/Export Records Found` (clear) or details (alert)
- A grey **disclaimer paragraph** at the bottom about CARFAX data sources.

**Page 2 — Lien Check, Accident/Damage, Registration, Service Records (start).**

- **Section header:** "Vehicle History Report + Lien Check" in large type.
- **Lien Check** section with magnifying-glass icon. Shows a green-check banner (`No Lien Records Found`) or an alert banner (`Lien Record(s) found in [Province]`). Always followed by two side-by-side info boxes: "How We Check for Liens" (process explanation) and "CARFAX Canada Canadian Lien Guarantee" (the $5,000 reimbursement promise).
- **Accident/Damage** section with warning-triangle icon. Single banner: `There are no accidents/damage reported on this vehicle` (clear) or itemized accident details (alert).
- **Registration** section with car icon. Banner: `This vehicle has been registered in the province of [PROVINCE] in Canada with [BRANDING] branding.` Followed by a small line: `We checked for: Inspection Required, Normal, Non-repairable, Rebuilt, Salvage and Stolen.`
- **Service Records** section with wrench icon. **Four-column table:** `DATE | ODOMETER | SOURCE | DETAILS`. Each row is a service event. Source shows the shop name and city/province/country. Details is a bulleted list of services performed. The table often spills onto page 3.

**Page 3 — Service Records (continued), Open Recalls, Stolen Vehicle Check.**

- Service records table continues without header repeat.
- **Open Recalls** section: each open recall is in a bordered box containing `Recall #:`, recall title (e.g. `2022 DF DJ WD ABS Control Module - Software`), `Recall Date:`, `Recall Description`, and `Remedy`. A short paragraph notes the recall was open as of report generation and links to the OEM recall page.
- **Stolen Vehicle Check** section: single banner `This vehicle is not actively declared stolen` or alert.

**Page 4–5 — Detailed History.**

- **Section header:** "Detailed History".
- **Five-column table:** `DATE | ODOMETER | SOURCE | RECORD TYPE | DETAILS`. Sorted chronologically (oldest first). `Record Type` values include: `Canadian Renewal`, `Service Record`, `Odometer reading`, `Recall`, `Accident`, `Auction`, `Registration Issued or Renewed`. The Details column for renewals often contains the critical **"Previous Use:"** marker (`Personal`, `Rental`, `Lease`, `Commercial`, `Taxi`, `Police`, `Government`) and `Vehicle colour noted as ___`.

**Page 5 (end) — Disclaimer + raccoon mascot.**

- A small raccoon illustration (CARFAX's mascot) appears with "Questions? We're here to help. Visit us at support.carfax.ca".
- Below it: a dense block of legal disclaimer text in small font.
- `© [YEAR] CARFAX CANADA ULC. All rights reserved.` and the CARFAX logo bottom-right.

**Pages 6–8 (or later) — Lien Details (only present when liens were found).**

- **Section header:** "Lien Details" with magnifying-glass icon.
- Bordered box containing what looks like a **raw dump of the provincial Personal Property Registry (PPR/PPRS) search results**, formatted as plain key-value text rather than a styled CARFAX table. Each lien block contains:
  - `Personal Property Registry Search Results Report`
  - `Search ID #:` (e.g. `Z19457508`)
  - `Page X of Y` (PPR's own pagination, unrelated to PDF pagination — IGNORE)
  - `Serial Number Collateral Search For:` followed by the VIN
  - `Date of Search:` and `Time of Search:`
  - `Registration Number:` (the PPR registration ID) and `Registration Date:`
  - `Registration Type:` (usually `SECURITY AGREEMENT`) and `Registration Status:` (usually `Current`)
  - `Expiry Date:`
  - **`Debtor(s)`** block — name(s) and address(es) of the borrower(s). May contain multiple name variants of the same person (e.g. "SAPRIKIN, BILL" and "SAPRIKIN, WILLIAM" and "SAPRIKIN, BILL, WILLIAM" — these are alias blocks for the same debtor, not three separate people).
  - `Birth Date:` (one per debtor variant)
  - **`Secured Party / Parties`** block — the **lienholder/lender** name and address. Examples: `TD AUTO FINANCE (CANADA) INC.`, `RIFCO NATIONAL AUTO FINANCE CORPORATION`, `ICEBERG FINANCE INC.`, `SCOTIABANK`.
  - `Status Current` (repeated multiple times — one per debtor block)
  - `Collateral: Serial Number Goods` block — confirms VIN/year/make/model
  - `Collateral: General` block — may contain a `Block Description` with legal boilerplate about "all attachments, accessories, additions...".
- **CRITICAL:** A single CARFAX report can contain **multiple lien blocks** (multiple liens registered against the same VIN by different lenders — this happens when a vehicle has been refinanced or when the trade-in has had multiple owners with their own loans). Each block is a separate lien. The classifier must extract ALL of them.
- **CRITICAL:** PPR lien blocks do NOT contain dollar amounts. The lien_amount field will almost always be null when extracted from CARFAX alone — payoff amounts come from the BOS, finance contract, or a separate lien payout statement.

---

### Vehicle role tagging (cross-document reconciliation)

**This is unique to carfax_report — most other doc types don't require this.** A complete dealership deal scan typically contains TWO CARFAX reports:

1. One for the **subject vehicle** (the car being sold to the customer)
2. One for the **trade-in vehicle** (the car the customer is trading in)

The classifier must distinguish these by **matching the CARFAX VIN against VINs found elsewhere in the scan**:

- If CARFAX VIN == BOS `vin` → set `vehicle_role` to `"subject_vehicle"`
- If CARFAX VIN == BOS `trade_in_vin` → set `vehicle_role` to `"trade_in"`
- If CARFAX VIN matches neither, or no BOS is present in the scan → set `vehicle_role` to `"unknown"`
- If two CARFAX reports share the same VIN (e.g. an older pulled report + a newer one), tag them both with the matching role and note the duplication in `notes`.

The classifier should NOT guess role from the year/make/model alone. Many deals involve trading in the same make/model for a newer one (as in the source document used to build this guide — both vehicles are Dodge Durangos). VIN match is the only reliable signal.

---

### Cross-document discrepancy detection

When a CARFAX is paired with a BOS, the classifier should populate a `discrepancies` array flagging mismatches between CARFAX facts and BOS declarations. Common discrepancies to check:

| Check                                     | CARFAX source                                                       | BOS source                                                                                   | Flag when                                                                                                                                                                                                                       |
| ----------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Out-of-province registration**          | Registration section / Detailed History                             | BOS Vehicle Declaration 3(a) "registered outside British Columbia" with jurisdiction         | CARFAX shows last registered in a non-BC province but BOS declaration 3(a) is marked "No", OR jurisdictions don't match                                                                                                         |
| **Brought into BC for resale**            | Detailed History — recent province transitions                      | BOS Vehicle Declaration 3(b)                                                                 | CARFAX shows the vehicle was just moved from another province but BOS says "No"                                                                                                                                                 |
| **Prior rental/commercial use**           | Detailed History "Previous Use: Rental / Taxi / Lease / Commercial" | BOS Vehicle Declaration 2 (taxi/police/emergency/racing/rental)                              | CARFAX shows any non-"Personal" prior use but BOS declaration 2 is marked "No". The 2022 Dodge Durango in the source document was used as a Rental for its first three registration cycles — this MUST be disclosed on the BOS. |
| **Accident/damage history**               | Accident/Damage section + Detailed History                          | BOS Vehicle Declaration 4 (damages > $2,000)                                                 | CARFAX shows accident records but BOS says "No"                                                                                                                                                                                 |
| **Odometer plausibility**                 | Last Reported Odometer + service record progression                 | BOS "Odometer" field (under Description of Vehicle or Description of Trade-in)               | BOS odometer < CARFAX last reported odometer (rollback indicator), OR BOS odometer is implausibly far above CARFAX last reading given short elapsed time                                                                        |
| **Brand status**                          | Registration section "with [BRANDING] branding"                     | BOS implicit (no explicit field, but any non-Normal branding should be disclosed in writing) | CARFAX brand is anything other than `Normal` — always flag, regardless of BOS                                                                                                                                                   |
| **Lien on trade-in vs. payout disclosed** | Lien Details section (count + lienholders)                          | BOS Trade-in "Estimated amount of lien" and "Owing to"                                       | CARFAX shows ≥1 active lien but BOS lien fields are blank/`N/A`, OR lienholder names don't match                                                                                                                                |
| **VIN mismatch / typo**                   | VIN watermark + page 1 VIN                                          | BOS `vin` or `trade_in_vin`                                                                  | Single-character difference suggests a typo on the BOS                                                                                                                                                                          |
| **Year/make/model mismatch**              | Page 1 vehicle headline                                             | BOS Year/Make/Series & Model                                                                 | Any of the three don't match                                                                                                                                                                                                    |
| **Open safety recall undisclosed**        | Open Recalls section                                                | BOS (no field)                                                                               | Always note open recalls in `discrepancies` for buyer awareness, even though BOS has no field for this                                                                                                                          |
| **Stolen vehicle**                        | Stolen Vehicle Check section                                        | BOS (implicit — sale of stolen vehicle is fraud)                                             | Any active stolen alert — this is a hard stop, escalate                                                                                                                                                                         |
| **U.S. history undisclosed**              | U.S. History section                                                | BOS (no explicit field but materially relevant)                                              | CARFAX shows US history not noted elsewhere in the deal file                                                                                                                                                                    |

Each discrepancy entry should be an object: `{ "field": "...", "carfax_value": "...", "bos_value": "...", "severity": "low|medium|high" }`.

---

### Field label mapping

CARFAX uses very few cryptic labels — most fields are self-describing — but the schema mapping still has non-obvious moments:

- `vin` → labeled **"VIN"** under the headline on page 1, AND printed vertically as a watermark on every page's right margin. Use the watermark as backup if page 1 is missing/cropped.
- `year` / `make` → first two tokens of the page-1 vehicle headline.
- `model` → the third token of the headline, **including any trim suffix** (e.g. `DURANGO GT`, `F-150 XLT`, `CIVIC SI`). The BOS "Series & Model" field usually includes trim too, so this matches downstream.
- `colour` → **NOT on page 1.** Pull from the Detailed History table — look for `Vehicle colour noted as ___` inside `Canadian Renewal` record `DETAILS` cells. Use the most recent renewal's colour. CARFAX colour vocabulary is generic ("medium gray", "white", "black") and may not match the BOS's specific name (e.g. CARFAX "medium gray" vs. BOS "BILLET METALLIC") — don't flag this as a discrepancy.
- `odometer_km` → labeled **"Last Reported Odometer:"** on page 1. The value is in km (CARFAX Canada always reports km).
- `province` → the province inside the parens on the page-1 "Last Registered In:" tile (e.g. `Alberta` from `Alberta (Normal)`). Confirmed in the Registration section banner on page 2.
- `lien_holder` → labeled as **"Secured Party / Parties"** in each Lien Details block. If multiple liens exist, this becomes an array; otherwise the first/only one. Strip the address — keep only the corporate name.
- `lien_amount` → **almost always `null` from CARFAX.** PPR registrations don't record dollar amounts. Document this clearly in `notes`.
- `customer_name`, `customer_address`, `dealer_name`, `salesperson`, `sale_price`, `trade_in_value`, `trade_in_vin`, `down_payment`, `amount_financed`, `apr`, `term_months`, `monthly_payment`, `gst_amount`, `pst_amount`, `signed_date` → **all `null` for CARFAX.** This is a vehicle report, not a transaction document. The Lien Details section does contain debtor names and addresses, but those are NOT the dealership customer — they are the prior owner(s) who took out the lien against the trade-in. **Never populate `customer_name` from CARFAX debtor data** — this is a privacy issue and will produce wrong results downstream (e.g. trade-in debtor is the trade-in's prior owner, not the buyer of the new vehicle).
- `fees` → `null` / empty array.
- `products` → `null` / empty array.

**CARFAX-specific extended fields** (not in the original schema — put these as nested data inside `notes` or as a structured `carfax_summary` block):

- Report number (e.g. `66028837`)
- Report date / pull time
- Accident count
- Service record count
- Open recall count and recall IDs
- Registration brand (`Normal` / `Rebuilt` / etc.)
- US history flag
- Stolen status
- Prior uses array (extracted from `Previous Use:` lines in Detailed History — deduplicated, e.g. `["Rental", "Personal"]`)
- Lien count

### Correct extraction example

This example represents a CARFAX for a **trade-in vehicle** that matches the trade-in VIN on the bill of sale in the same scan. Note the discrepancies flagged.

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
    "notes": "CARFAX Canada Vehicle History Report #74119503, pulled 2025-09-10 at 11:27 AM EST, report status Complete. Three current lien registrations against this VIN in Alberta PPR (registered 2024-01-05, 2024-07-04, and 2025-06-19). PPR records do not include dollar amounts — payoff figures must come from the BOS or a lien payout statement. Two distinct debtor identities appear across the three lien blocks (one debtor 'SAPRIKIN, BILL/WILLIAM' on the oldest registration; a different debtor 'SHORT, CRYSTAL AMY' on the two newer registrations) — this suggests a private resale between owners with the older lien unresolved. Last reported odometer 93,645 KM as of 2025-10-27. Eleven service records, no reported accidents, one open recall (#55B — ABS Control Module software, opened 2024-06-13), not declared stolen, no US history. Registration brand is Normal. Previous Use field shows 'Rental' for first three registration renewals (2022 Jun–Sep) and 'Personal' thereafter — vehicle was a former rental fleet unit."
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
      "field": "trade_in_debtor_identity",
      "carfax_value": "Two distinct debtor identities on PPR (Saprikin and Short) — current seller may not have clear title",
      "bos_value": "N/A — BOS does not capture trade-in debtor history",
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

## Doc type: deal_recap

> **Schema note:** This document type is NOT in the current `doc_type` enum. The closest existing bucket is `other`, but a deal recap is structurally and semantically distinct from every other type in the list — it's the dealer's internal accounting view of the deal, not a customer-facing document. **Strongly recommend adding `deal_recap` to the enum.** If you can't change the enum yet, set `doc_type` to `other` and put `"actual_type": "deal_recap"` in the JSON to make downstream routing possible. The rest of this guide assumes the enum will be extended.

### What it looks like

**Format / origin.** A 2-page (sometimes more), portrait, computer-generated PDF produced by the **Tekion DMS** (Tekion Corp's dealership management system). The footer of every page reads `© Tekion Corp 2025` on the bottom-left and `Page N of T` plus a print timestamp `Day MMM DD, YYYY | HH:MM AM` on the bottom-right. There is NO dealer letterhead, NO logo, NO printed title bar at the top — Tekion recaps are visually minimalist by design. The structural giveaway is the **three-block header layout** at the top of page 1 (legal entity / customer / deal metadata) followed by **four labeled accounting sections** running down the page (Front Gross → Back Gross → Total Sales → Other Charges).

**Origin tells.** The phrase **"Deal Recap"** in large bold type in the top-right header, accompanied by a deal number, a status word (`In Recap`, `Closed`, `Pre-close`, etc.), and a status date, is the definitive identifier. The Tekion footer is the secondary confirmation.

---

### Page 1 layout

**Top-of-page header — three horizontal blocks, no border.**

- **Top-left block:** the dealership's **legal operating entity name**, NOT the consumer-facing dealer brand. Format is typically a BC numbered company like `1231937 BC Ltd.` This will NOT match the `dealer_name` extracted from a BOS (which uses the trade name like "Applewood Chevrolet Buick GMC"). The classifier should record this as the dealer's underlying corporate entity and flag the brand/entity mismatch separately.
- **Top-center block:** **Customer information**, no field labels — just raw values stacked vertically:
  - Line 1: Customer full name
  - Line 2: Customer account/ID number (Tekion's internal customer ID, e.g. `1033510`)
  - Line 3: Phone number with country code (`+1-(778) 214-3108`)
  - Line 4: Email
  - Line 5: Street address
  - Line 6: City + sub-region + province (e.g. `Stony Plain Parkland AB` — Tekion concatenates city and municipal sub-area without commas)
  - Line 7: Postal code (lowercase in source — e.g. `t7z0n2`)
- **Top-right block:** **Deal metadata**, partially labeled:
  - "Deal Recap" (the title)
  - Deal number in large bold (e.g. `18127`) — this **should match the BOS "Seller's Contract #"** if both documents are from the same deal
  - Status string (`In Recap`, `Booked`, `Closed`, `Pre-Close`, etc.)
  - A date with month spelled out (`Nov 21 2025`) — this is the status date, NOT necessarily the contract date

**Second header band — three more horizontal blocks below.**

- **Left block — Vehicle information** (the subject vehicle, the one being sold):
  - Year + Make + Model on line 1 (`2024 Dodge Durango`)
  - Stock number with `#` prefix and a `Used` or `New` pill/tag on line 2 (`#P5477 Used`)
  - VIN on line 3
  - Odometer + unit on line 4 (`33940 km`)
  - Unladen / gross vehicle weight on line 5 (often `0 kg` for non-commercial vehicles)
- **Middle block — Finance terms** (no header label — you have to infer it from the content):
  - Lender code on line 1 (`TDCA`, `RBC`, `SCOTIA`, `RFCO`, `ICEBERG`, etc. — abbreviated lender names, not always self-evident; `TDCA` = TD Auto Finance Canada, `RFCO` = Rifco)
  - Payment + frequency suffix (`$597.50/bi` — the suffix is `/bi` for biweekly, `/wk` for weekly, `/mo` for monthly, `/semi` for semi-monthly)
  - Amount Financed (`$96,852.18 Amount Financed`)
  - First payment date with month spelled out (`Dec 5 2025 First Payment Date`)
  - **Three percentage rates on one line:** `6.49% 6.49% 0% Sell/Buy/Spread` — these are **sell rate / buy rate / spread**:
    - **Sell rate** is the APR shown to the customer (matches BOS APR)
    - **Buy rate** is what the lender charges the dealer
    - **Spread** is the difference (sell minus buy); the dealer captures this as Finance Reserve income on the Back Gross
    - When spread is non-zero, expect a corresponding Back Gross "Financial Reserve" line
  - Term in number + frequency unit (`Term 96 Bi` means 96 biweekly periods, NOT 96 months — this is critical)
- **Right block — Dates** (Tekion's deal lifecycle milestones):
  - `Reserved Date:` — when the deal was first reserved/quoted (often `-`)
  - `Sold Date:` — when the deal was marked sold (often `-` for in-flight recaps)
  - `Contract Date:` — the date on the BOS/contract (should match BOS signed_date)
  - `Pre-close Date:` — when F&I started closing the deal
  - `Final Accounting Date:` — when the deal was posted to the GL (often `-` until closed)

---

### Accounting sections (page 1 main body)

Each section is a table with the same four-column structure:
**`[Section Name] | Description | Sale | Cost | Dealer Gross`**

The first column shows the section name only on the first row of each line group, then leaves it blank for sub-rows. Each section has a bold header row showing column totals. Currency values are right-aligned, always prefixed with `$`, use comma thousands separators, and include two decimal places. Negative numbers are shown with a leading `-` (e.g. `-$500.00`).

**Section 1: Front Gross.** The front-of-house margin — vehicle sale plus trade-in deltas plus dealer accessories minus cost adjustments.

- **Vehicle Sale** row: stock number in Description; Sale = retail vehicle price; Cost = dealer's book/landed cost; Gross = Sale − Cost. **Sale should match BOS "Price of Vehicle"** exactly.
- **Trade-ins** row group: trade-in year/make/model in the Description column; Sale = trade allowance given to customer; Cost = trade allowance (same value, so gross is zero on the trade itself). Below this, additional sub-rows appear:
  - Trade-in VIN (no dollar values)
  - `Trade Payoff: $X` (no dollar columns — this is informational; the actual payoff hits Cost Adjustments)
  - `LIEN PAYOFF | Lien Amt: $X` (also informational)
- **Accessories** row group: dealer-added items that the customer is being charged for (Sale populated). Examples: `FINANCE PLACEMENT FEE`, `EXTENDED WARRANTY`, `THEFT PROTECTION`, `RUST PROTECTION`, `TIRE & RIM`, `GAP INSURANCE`. **Each accessory row should ideally have BOTH a Sale and a Cost — Sale without Cost means the dealer kept 100% of the line (suspicious for warranty-type products that have real provider costs); Cost without Sale means the dealer is absorbing the cost (a "pack" — see Cost Adjustments below).**
- **Cost Adjustments** row group (label may be truncated to `Cost Adjustm...` due to column width): dealer-side cost lines that reduce the dealer's gross. Sale is blank, Cost is positive, Dealer Gross is negative. Common labels:
  - `AP7 Policy Accrual` / `AP7 Pack` — dealer "packs" (internal cost allocations like fixed overhead per used car). Tekion shows these as Cost-only with a negative gross impact.
  - `DEALER PREP USED` — reconditioning cost (this also commonly appears as a Sale-side line in Accessories and again in Other Charges — Tekion's recap can show the same fee in multiple places; verify with the BOS which one is the actual customer charge)
  - `DELIVERY` — internal delivery cost
  - `LIEN PAYOUT [LENDER]` — **THE TRADE-IN LIEN PAYOFF AS A COST**. This is how the lien payout is "set up" on the deal financially. The trade payoff amount in the trade-in row group is informational only; the actual money movement is here. If the trade has a lien but no `LIEN PAYOUT [...]` cost line exists, the lien payout is NOT set up and the deal cannot close cleanly — this is the user's specific concern and should always be flagged.
- **Front Gross totals row** (above the body, bolded): `Sale | Cost | Dealer Gross` = sums of the columns.

**Section 2: Back Gross.** The F&I (finance & insurance) margin — typically just the finance reserve, sometimes also includes commission on aftermarket products sold through F&I.

- **Financial Res...** (truncated from `Financial Reserve`) row: Description shows the lender code (matches the middle block above). Sale = the reserve the lender pays the dealer for placing the loan (a function of the rate spread, the term, and the amount financed). Cost = $0. Gross = Sale.
- If F&I-sold products (extended warranty, GAP, life/disability insurance) exist, they appear here with both Sale and Cost.
- **Back Gross totals row** at the top of the section.

**Section 3: Total Sales.** A summary row showing Sale / Cost / Dealer Gross summed across Front Gross + Back Gross.

**Section 4: Other Charges.** Pass-through charges to the customer that don't generate dealer gross — they're collected and remitted to third parties. The header row shows a single `Amount` column (not Sale/Cost/Gross). Common entries:

- `Dealer Prep - Used` — note this appears here AND in Front Gross Cost Adjustments; in Tekion this is normal but bears verification against the BOS
- `PPSA Fee` — provincial Personal Property Security Act registration fee (should match BOS PPSA fee exactly)
- `Lender Admin Fee` — admin fee passed through from the lender
- `Tire Levy`, `AC Excise Tax`, `Federal Luxury Tax` (when applicable)

---

### Page 2 (typically present, not in this sample)

The sample provided is page 1 of 2. Page 2 of a Tekion recap usually contains one or more of:

- Tax breakdown table (GST, PST, total tax)
- Insurance/warranty product detail
- Customer signature line (rare — recaps are internal docs)
- Deal stipulations / lender conditions
- Manager initials block

If only page 1 is scanned, set `notes` to flag that page 2 was not provided.

### Handwritten markup

This particular scan has handwritten markings that are **scan artifacts, not data**:

- Small checkmarks (✓) before some dollar amounts in the Cost column — these are F&I manager verification marks confirming each cost was sourced from the GL/PO. Ignore for extraction.
- A large hand-drawn oval circling the "Other Charges" totals — F&I manager review annotation. Ignore.

The classifier should ignore all handwritten marks on this document type. Extracted values come from the printed figures only.

---

### Field label mapping

Tekion recaps don't use printed field labels for many values — fields are positional. Map accordingly:

- `customer_name` → first line of the **top-center customer block** (no label)
- `customer_address` → lines 5–7 of the top-center block, joined: street + city/sub-region + province + postal code
- `vin` → line 3 of the **vehicle information block** (no label; identifiable as a 17-character alphanumeric)
- `year` / `make` → first tokens of line 1 of the vehicle block
- `model` → remaining tokens of line 1 (trim is rarely included on the recap, unlike on CARFAX)
- `colour` → **NOT on the recap.** Use `null`.
- `odometer_km` → line 4 of the vehicle block (label is the unit suffix `km`, not a field name)
- `sale_price` → the `Sale` column value on the **Vehicle Sale** row of Front Gross. NOT the Total Sales total — that's all-in.
- `trade_in_value` → the `Sale` column value on the **Trade-ins** row of Front Gross
- `trade_in_vin` → the VIN sub-row inside the Trade-ins group of Front Gross
- `down_payment` → **NOT on page 1 of a recap.** May appear on page 2 as "Cash Down" or "Customer Deposit". Use `null` if page 2 not present.
- `amount_financed` → labeled as **"Amount Financed"** in the finance middle block (top of page)
- `apr` → the **first** percentage on the `Sell/Buy/Spread` line in the finance middle block (the Sell rate)
- `term_months` → the number on the `Term N [Frequency]` line in the finance middle block — **but only if the frequency is `Mo` (monthly). For `Bi`, `Wk`, or `Semi`, this is NOT months — convert: biweekly term ÷ 2.1667 ≈ months, weekly term ÷ 4.333 ≈ months. Better: store the raw term in `notes` and put converted months in `term_months`, OR leave `term_months` null if you can't convert reliably.** In this sample, `Term 96 Bi` = ~44 months, NOT 96 months.
- `monthly_payment` → the payment value in the finance middle block, **only if the frequency suffix is `/mo`**. For `/bi`, `/wk`, or `/semi`, set `monthly_payment` to `null` and note the actual payment + frequency in `notes`.
- `gst_amount` / `pst_amount` → **NOT broken out on page 1 of a recap.** GST/PST appear on page 2 (when present) or have to be inferred from the difference between Total Sales and BOS "PURCHASE PRICE WITH GST/PST". Use `null` if page 2 not available.
- `province` → **No explicit province field on the recap.** The customer's province is in the address block but represents customer residence, not deal province. The deal province is the dealership's province (BC for a BC dealer). Use BC unless evidence suggests otherwise.
- `lien_holder` → the lender name(s) from `LIEN PAYOUT [LENDER]` cost-adjustment rows in Front Gross. If multiple LIEN PAYOUT lines exist (e.g. trade-in had multiple liens), capture all as an array.
- `lien_amount` → the cost value on `LIEN PAYOUT [LENDER]` rows. If multiple, sum them OR capture as an array of `{holder, amount}`. Note this is the trade-in's lien payout — same as BOS "Lien payout on Trade-in".
- `dealer_name` → **the legal entity** from the top-left block (e.g. `1231937 BC Ltd.`). Always flag this against the BOS dealer trade name as an expected-but-noteworthy difference, not a discrepancy.
- `salesperson` → **NOT on page 1.** May appear on page 2. Use `null` if not visible.
- `signed_date` → **A recap is not signed.** Use the `Contract Date:` from the dates block as the deal date, but technically `signed_date` should remain `null` — the BOS holds the signed_date.
- `fees` → all line items from the **Other Charges** section as `{label, amount}` pairs.
- `products` → F&I products from **Back Gross** (excluding Financial Reserve) as `{name, price}` where price is the Sale value. Plus any warranty/insurance entries from Front Gross Accessories where both Sale and Cost are populated.
- `notes` → extensive — use to capture finance reserve amount, sell/buy/spread, term frequency conversion, dealer pack lines, and any reconciliation flags.

**Recap-specific extended fields** (proposed additions, mirroring the CARFAX guide approach):

- `front_gross` / `back_gross` / `total_sales` — three sub-objects, each containing `{sale, cost, dealer_gross}` to preserve the accounting totals
- `finance_reserve` — the Back Gross financial reserve amount
- `rate_spread` — the `Sell/Buy/Spread` triple as `{sell, buy, spread}`
- `dealer_legal_entity` — the top-left numbered company (separate from `dealer_name` so the trade name reconciles against the BOS)
- `deal_number` — the recap deal number (must match BOS Seller's Contract #)
- `deal_status` — `In Recap`, `Closed`, etc.

---

### Cross-document reconciliation checks (recap vs. BOS)

This is the user's primary concern. The classifier should populate a `discrepancies` array flagging any of the following:

| Check                                    | Recap source                                                                 | BOS source                                                                                       | Flag when                                                                                                                                                                      |
| ---------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Deal number match**                    | Top-right deal number                                                        | BOS "Seller's Contract #"                                                                        | Values differ                                                                                                                                                                  |
| **Vehicle price match**                  | Front Gross → Vehicle Sale row → Sale                                        | BOS "Price of Vehicle"                                                                           | Values differ                                                                                                                                                                  |
| **Trade allowance match**                | Front Gross → Trade-ins row → Sale                                           | BOS "TRADE-IN ALLOWANCE"                                                                         | Values differ                                                                                                                                                                  |
| **Trade VIN match**                      | Front Gross → Trade-ins VIN sub-row                                          | BOS trade-in "VIN #"                                                                             | Values differ                                                                                                                                                                  |
| **Trade payoff set up**                  | Front Gross → Cost Adjustments → `LIEN PAYOUT [LENDER]` row                  | BOS "Lien payout on Trade-in"                                                                    | Recap missing LIEN PAYOUT cost line when BOS shows lien payout > 0 — this is the user's explicit concern: **"lien payout for the trade is setup"**                             |
| **Trade payoff amount match**            | Sum of LIEN PAYOUT rows                                                      | BOS "Lien payout on Trade-in"                                                                    | Sums differ                                                                                                                                                                    |
| **Amount financed match**                | Middle block "Amount Financed"                                               | BOS "AMOUNT TO FINANCE"                                                                          | Values differ                                                                                                                                                                  |
| **APR match**                            | Middle block sell rate (first %)                                             | BOS interest rate                                                                                | Values differ                                                                                                                                                                  |
| **Term match**                           | Middle block Term × frequency conversion                                     | BOS term in months                                                                               | Converted months differ                                                                                                                                                        |
| **Payment match**                        | Middle block payment/frequency                                               | BOS payment/frequency                                                                            | Frequencies differ, OR same-frequency amounts differ by more than $1                                                                                                           |
| **Contract date match**                  | Right block "Contract Date"                                                  | BOS signed date                                                                                  | Values differ                                                                                                                                                                  |
| **PPSA fee match**                       | Other Charges → PPSA Fee                                                     | BOS "PPSA fee"                                                                                   | Values differ                                                                                                                                                                  |
| **Lender Admin Fee match**               | Other Charges → Lender Admin Fee                                             | BOS "LENDER ADMIN FEE"                                                                           | Values differ                                                                                                                                                                  |
| **Dealer Prep match**                    | Other Charges → Dealer Prep - Used                                           | BOS "DEALER PREP - USED"                                                                         | Values differ                                                                                                                                                                  |
| **Finance Placement Fee match**          | Front Gross → Accessories → FINANCE PLACEMENT FEE → Sale                     | BOS "FINANCE PLACEMENT FEE"                                                                      | Values differ                                                                                                                                                                  |
| **Warranty has matching cost**           | Any Back Gross or Front Gross warranty/insurance/protection row              | —                                                                                                | Sale populated but Cost is blank/zero — dealer is selling a product that should have a provider cost. This is the user's explicit concern: **"warranties if sold has a cost"** |
| **Warranty appears on BOS**              | Any product/warranty row with non-zero Sale                                  | BOS Extended Vehicle Warranty / Disability Insurance / Life Insurance                            | Recap shows a customer-charged warranty product but BOS doesn't show it (under-disclosure)                                                                                     |
| **Hidden pack disclosure**               | Cost Adjustments rows (cost-only)                                            | —                                                                                                | Cost without Sale → these are internal packs and should be noted (not necessarily a discrepancy, but useful to surface for audit)                                              |
| **Dealer Prep double-counting**          | Dealer Prep appearing in BOTH Front Gross Cost Adjustments AND Other Charges | BOS "DEALER PREP - USED" (single line)                                                           | The amounts in both recap locations should sum/reconcile consistently; flag if the customer is being charged twice                                                             |
| **Lender match**                         | Middle block lender code + LIEN PAYOUT lender names                          | BOS financing arrangement                                                                        | If the deal lender (e.g. TDCA) matches a lien being paid off, this is normal refinancing; if BOS shows "Buyer to arrange financing" but recap shows a specific lender, flag    |
| **CARFAX-disclosed liens accounted for** | All LIEN PAYOUT cost rows                                                    | Compare against any carfax_report in the scan with vehicle_role = "trade_in" → lien_holder array | CARFAX shows N liens but recap shows M < N LIEN PAYOUT lines → undisclosed liens not being paid off (very high severity)                                                       |

Each discrepancy entry: `{ "field": "...", "recap_value": "...", "bos_value": "...", "severity": "low|medium|high" }`.

---

### Correct extraction example

This example uses anonymized BC-realistic data. The discrepancies array shows what the classifier should produce when reconciling this recap against the BOS from the same deal file. Several discrepancies are deliberately included to illustrate the kinds of issues the classifier should catch.

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
    "lien_holder": [
      "TDCA (trade refinance lender)",
      "ICEBERG (trade lien being paid off)"
    ],
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
    "notes": "Tekion DMS deal recap, deal #18127, status 'In Recap' as of Nov 21 2025. Page 1 of 2 — page 2 not provided in scan (likely contains tax breakdown, additional product detail, and possibly salesperson). Finance terms: 96 biweekly payments at $597.50/bi = ~44 months equivalent (NOT 96 months). Sell/Buy/Spread = 6.49%/6.49%/0% — no rate markup, dealer finance reserve of $692.13 is a flat lender placement payment rather than a spread reserve. Front Gross $2,879.29, Back Gross $692.13, Total Dealer Gross $3,571.42. AP7 Policy Accrual ($500) and AP7 Pack ($3,000) appear as Cost-only adjustments — these are internal dealer packs (Applewood Protection 7), not customer-facing charges. DEALER PREP USED ($795) appears in BOTH Front Gross Cost Adjustments AND Other Charges — verify with BOS this is not double-billed to customer. Two separate trade-in lien payouts on the deal: $67,000 main payoff (matches BOS) plus $3,474.71 to Iceberg Finance (NOT shown on BOS — CARFAX disclosed three liens on the trade-in, only one was acknowledged on the BOS Trade-in 'Estimated amount of lien'). Dealer legal entity is '1231937 BC Ltd.' which is the underlying numbered company for the dealer trade name on the BOS — normal, not a discrepancy."
  },
  "recap_accounting": {
    "front_gross": {
      "sale": 88454.0,
      "cost": 85574.71,
      "dealer_gross": 2879.29
    },
    "back_gross": { "sale": 692.13, "cost": 0.0, "dealer_gross": 692.13 },
    "total_sales": {
      "sale": 89146.13,
      "cost": 85574.71,
      "dealer_gross": 3571.42
    },
    "other_charges_total": 985.73,
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
      "field": "contract_date",
      "recap_value": "2025-11-21",
      "bos_value": "2025-11-24",
      "severity": "low"
    },
    {
      "field": "payment_amount",
      "recap_value": "$597.50 biweekly",
      "bos_value": "$605.57 biweekly (BOS 'payment not to exceed' figure)",
      "severity": "low",
      "note": "BOS shows the 'not to exceed' ceiling; recap shows the actual quoted payment. $597.50 ≤ $605.57 so this is within the BOS limit, but downstream should verify the finance contract matches the recap not the BOS ceiling."
    },
    {
      "field": "trade_in_lien_payouts",
      "recap_value": "Two LIEN PAYOUT lines: $67,000 (no lender label) + $3,474.71 (Iceberg)",
      "bos_value": "Single 'Lien payout on Trade-in' of $67,000 with 'Owing to: N/A'",
      "severity": "high",
      "note": "Recap pays off a $3,474.71 Iceberg Finance lien that is NOT disclosed on the BOS. CARFAX for the trade-in shows three active liens (TD Auto Finance, Rifco, Iceberg) — the recap only resolves two of them ($67,000 + $3,474.71). The Rifco lien may still be active post-close. Strongly recommend escalating to F&I."
    },
    {
      "field": "dealer_prep_used_double_appearance",
      "recap_value": "$795.00 in Front Gross Cost Adjustments AND $795.00 in Other Charges",
      "bos_value": "$795.00 (single line under 'Additional equipment, services or warranties')",
      "severity": "medium",
      "note": "Tekion sometimes reports the same fee in both Cost Adjustments (as a cost) and Other Charges (as a customer pass-through) — this is structurally normal in the DMS but should be reconciled to ensure the customer is charged $795 once, not $1,590."
    },
    {
      "field": "term_unit_mismatch",
      "recap_value": "96 biweekly periods (~44 months)",
      "bos_value": "96 months",
      "severity": "high",
      "note": "BOS 'Financing Conditions' sentence reads 'term not to exceed 96 months' but the recap shows 96 BIWEEKLY periods. The BOS wording is almost certainly incorrect — at $597.50 biweekly for 96 months the total payments would be $124,680 against $96,852.18 financed, which is implausible. Likely BOS clerical error; the recap (96 bi) is the truth. Flag for F&I to correct the BOS or finance contract."
    },
    {
      "field": "ap7_packs",
      "recap_value": "$500 AP7 Policy Accrual + $3,000 AP7 Pack (Cost-only)",
      "bos_value": "N/A",
      "severity": "low",
      "note": "Internal dealer packs, no customer-facing charge — flagged for audit visibility only, not a true discrepancy."
    }
  ]
}
```

## Strategy

- Start with one guide per doc type you commonly see.
- **Every wrong guess becomes a new guide** — that is how the system improves over time.
- The "Your dealer's specific layout" section is the most valuable part. Describe
  exactly what makes your dealer's version of that doc distinctive.
- Keep guides concise — a short accurate description beats a long vague one.

## Verifying guides are loaded

Restart the dev server, upload a deal, and check the terminal. If the system prompt
appended any examples you will see the guides section echoed in the log on first load.
