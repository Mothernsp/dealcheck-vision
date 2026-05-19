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
- BC tire advance disposal fee (with "tires @ $___ per tire" sub-line)
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

At the very bottom right is a **Financing Conditions** block: three frequency checkboxes ("Weekly / Bi-Weekly / Monthly"), two arrangement checkboxes ("Seller to arrange financing" / "Not applicable" / "Buyer to arrange financing"), and a sentence with four hand-filled blanks: **"This Agreement is subject to the Seller arranging Buyer financing for the sum of $__ at an interest rate not to exceed __% per year, with a term not to exceed __ months, and a payment not to exceed $__ [FREQUENCY]"**. The frequency word (e.g. "EVERY 2 WEEKS", "MONTHLY") is typed in caps next to the payment amount.

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
- `apr` → the percent blank inside the Financing Conditions sentence: "...at an interest rate not to exceed ____% per year..."
- `term_months` → the months blank inside the same sentence: "...with a term not to exceed ____ months..."
- `monthly_payment` → the dollar blank inside the same sentence: "...a payment not to exceed $____ [FREQUENCY]". **CRITICAL:** this is not always monthly. The frequency word (MONTHLY / BIWEEKLY / EVERY 2 WEEKS / WEEKLY) is typed in caps after the dollar amount, and is also indicated by the Weekly/Bi-Weekly/Monthly checkbox row. If the payment is not monthly, set `monthly_payment` to `null` and put the actual payment + frequency in `notes` and/or in `fees` as a labeled line — do not silently store a biweekly figure in the `monthly_payment` field.
- `gst_amount` → labeled as **"GST on purchase price"**
- `pst_amount` → labeled as **"PST on purchase price"**
- `lien_holder` → labeled as **"Owing to"** under the Trade-in block (i.e. the lienholder is on the trade-in being paid out, not on the purchased vehicle). May be a bank, finance co., or "N/A".
- `lien_amount` → labeled as **"Estimated amount of lien"** under the Trade-in block; should match the **"Lien payout on Trade-in"** line in the right-column ledger. Use the right-column ledger value when the two differ.
- `dealer_name` → the dealer name printed in the Seller Identification block (top-left), repeated again in the "Accepted by ___ Dealer" line near the bottom
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
