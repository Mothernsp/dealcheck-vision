## Doc type: driver_license

### What it looks like

**Format / origin.** A BC driver's licence is a wallet-sized card (85.6 mm × 54 mm) issued by ICBC. It is almost always scanned as an image (JPEG or PNG) rather than a PDF, often submitted as two separate scans — front and back. Some dealers scan both sides onto one page.

**Front of card.**

- **Top band:** "British Columbia" in white text on a dark blue/navy background strip across the top.
- **Left side:** A colour photo of the licence holder (head and shoulders). Below the photo: a small BC government logo and the word "DRIVER'S LICENCE" (or "IDENTIFICATION CARD" for a BCID with no driving privileges).
- **Right side (top to bottom):**
  - Licence number — 7 digits, printed in large bold type (e.g. `4123456`).
  - Full legal name — LAST NAME on one line, GIVEN NAME(S) on the next, both in capitals.
  - Date of birth — labeled "DATE OF BIRTH / DATE DE NAISSANCE" in `YYYY MMM DD` format (e.g. `1985 MAR 22`).
  - Address — street, city, postal code (the registered address, not necessarily the current address).
  - Sex (`M` or `F`), Height in cm.
  - Issue date ("DATE DE DÉLIVRANCE") and expiry date ("DATE D'EXPIRATION") both in `YYYY MMM DD` format.
  - Licence class — labeled "CLASS / CLASSE" followed by a single digit (e.g. `5` for standard passenger vehicle). Conditions (restrictions) shown as letter codes (e.g. `G` for glasses required).
- **Security features:** A holographic overlay covers most of the card. A ghost image (smaller duplicate photo) appears near the bottom-right.
- **Bottom strip:** A 2D barcode (PDF417) runs along the bottom edge of the card.

**Back of card.**

- Repeats name and licence number at the top.
- Lists endorsements / conditions in full text (e.g. "CORRECTIVE LENSES REQUIRED").
- May show organ donor status.
- Magnetic stripe along the top edge.
- Another barcode (or repeat of PDF417).

**What to do with front + back scans submitted separately:**
Both images classify as `driver_license`. On the back scan, most fields will be `null` — do not attempt to re-extract name/DOB from the back. Extract the licence number from whichever scan shows it most clearly.

### Field label mapping

BC DL fields map to the extraction schema as follows:

- `customer_name` → full name from front of card: GIVEN NAME(S) + LAST NAME (combine into natural order, e.g. "JORDAN A MACKENZIE")
- `customer_address` → address block on front of card (street + city + postal code)
- `customer_dob` → "DATE OF BIRTH" field; convert from `YYYY MMM DD` to `YYYY-MM-DD` (e.g. `1985-03-22`)
- `signed_by_customer` → `false` — a DL is a government ID, not a signed document
- `signed_by_dealer` → `false`
- All financial fields (`sale_price`, `amount_financed`, etc.) → `null`
- `vin`, `year`, `make`, `model` → `null`
- `notes` → note the licence class and any conditions (e.g. "Class 5, condition G — corrective lenses required"), plus whether this is front only, back only, or both sides.

**IMPORTANT — privacy note:** Driver's licences contain PII. The extraction schema intentionally does not include a field for the DL number itself. Do NOT put the licence number in `notes` or any other field — this is a privacy boundary. Confirm only that a DL was present and extract name/address for the deal record.

### Correct extraction example

```json
{
  "doc_type": "driver_license",
  "signed_by_customer": false,
  "signed_by_dealer": false,
  "fields": {
    "customer_name": "JORDAN ALEX MACKENZIE",
    "customer_address": "4827 ALDERWOOD CRESCENT, SURREY BC V3T 1A4",
    "customer_dob": "1985-03-22",
    "vin": null,
    "year": null,
    "make": null,
    "model": null,
    "colour": null,
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
    "notes": "BC Driver's Licence, Class 5, no conditions. Front of card scanned."
  }
}
```
