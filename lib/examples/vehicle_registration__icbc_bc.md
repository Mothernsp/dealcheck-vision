## Doc type: vehicle_registration

### What it looks like

**Format / origin.** A BC Vehicle Registration Certificate issued by ICBC (Insurance Corporation of British Columbia). Typically a single-page document, sometimes a wallet-sized card insert. May also appear as a combined **"Registration & Insurance"** document when the vehicle has active ICBC insurance. Printed on security paper with a blue/teal header band.

**Layout.**

- **Header band (top):** "Province of British Columbia" on the left, ICBC logo on the right. Title "VEHICLE REGISTRATION CERTIFICATE" (or "VEHICLE REGISTRATION PERMIT" for temporary plates) centered below in bold.
- **Plate / expiry section:** License plate number in large bold type, labeled "PLATE NUMBER". Expiry date labeled "EXPIRY DATE" in `MMM DD YYYY` or `YYYY-MM-DD` format. Sometimes a "PERMIT NUMBER" instead of a plate number for temporary/in-transit registrations.
- **Vehicle information section:**
  - "VEHICLE IDENTIFICATION NUMBER (VIN)" — 17-character alphanumeric
  - "YEAR", "MAKE", "MODEL" on the same row or adjacent rows
  - "BODY STYLE" (e.g. `4DR`, `2DR`, `SUV`, `TRK`, `VAN`)
  - "COLOUR" — ICBC uses single-word colour codes (e.g. `WHITE`, `GREY`, `BLACK`, `BLUE`)
  - "GROSS VEHICLE WEIGHT" (kg) — for commercial vehicles
  - "NET VEHICLE WEIGHT" (kg) — for commercial vehicles
- **Owner section:**
  - "REGISTERED OWNER" — full name (individual or company)
  - "ADDRESS" — street, city, province, postal code
  - For leased vehicles: both "REGISTERED OWNER" (the leasing company) and "LESSEE" (the driver)
- **Transfer / dealer section (sometimes present):**
  - If issued to a dealer for a vehicle in inventory: "DEALER NAME" and dealer number
- **Footer:** ICBC contact information and a disclaimer about coverage.

**Combined Registration & Insurance variant:**
When ICBC insurance is active, the same document also shows:
- "POLICY NUMBER" (9-digit ICBC autoplan number)
- "INSURED" name (may differ from Registered Owner for fleet/dealer vehicles)
- Coverage summary (liability limit, collision deductible, etc.)
- "EFFECTIVE DATE" and "EXPIRY DATE" of insurance

**What this document is used for in a deal:**
- Confirms the registered owner of a **trade-in vehicle** — critical for lien and title checks
- Confirms the vehicle description (VIN, year, make, model) matches the BOS
- For a new vehicle, shows the plate assigned at registration

### Field label mapping

- `vin` → labeled "VEHICLE IDENTIFICATION NUMBER (VIN)"
- `year` / `make` / `model` → labeled "YEAR", "MAKE", "MODEL"
- `colour` → labeled "COLOUR" (ICBC single-word codes — may differ from BOS colour name)
- `customer_name` → labeled "REGISTERED OWNER". For dealer-owned inventory, this will be the dealership name, not the buyer.
- `customer_address` → address block under "REGISTERED OWNER"
- `province` → always `BC` for ICBC-issued registrations
- `dealer_name` → if "DEALER NAME" field present (dealer plate registrations)
- `signed_by_customer` → `false` — this is a government-issued certificate, not a signed document
- `signed_by_dealer` → `false`
- All financial fields → `null`
- `notes` → include plate number, expiry date, and whether this is for the subject vehicle or trade-in. If it's a combined Registration & Insurance document, note the policy number and insurance expiry.

### Correct extraction example

```json
{
  "doc_type": "vehicle_registration",
  "signed_by_customer": false,
  "signed_by_dealer": false,
  "fields": {
    "customer_name": "JORDAN ALEX MACKENZIE",
    "customer_address": "4827 ALDERWOOD CRESCENT, SURREY BC V3T 1A4",
    "vin": "1C4RDJDG9NC994215",
    "year": "2022",
    "make": "DODGE",
    "model": "DURANGO",
    "colour": "GREY",
    "odometer_km": null,
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
    "province": "BC",
    "lien_holder": null,
    "lien_amount": null,
    "dealer_name": null,
    "salesperson": null,
    "signed_date": null,
    "fees": [],
    "products": [],
    "notes": "BC Vehicle Registration Certificate. Plate: AB1234, expiry 2026-03-31. Registered owner matches buyer on BOS — this appears to be the trade-in registration document."
  }
}
```
