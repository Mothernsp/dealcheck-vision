import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

let _client;
function getClient() {
  if (!_client) _client = new Anthropic();
  return _client;
}

const HAIKU = 'claude-haiku-4-5-20251001';

const SUPPORTED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

// Build the vision block Claude needs for a file (PDF or image).
function toVisionBlock(bytes, mimeType) {
  const base64 = bytes.toString('base64');

  if (mimeType === 'application/pdf') {
    return {
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: base64 },
    };
  }

  if (SUPPORTED_IMAGE_TYPES.has(mimeType)) {
    return {
      type: 'image',
      source: { type: 'base64', media_type: mimeType, data: base64 },
    };
  }

  throw new Error(`Unsupported file type for vision: ${mimeType}`);
}

// Guess MIME type from filename extension when not provided.
export function mimeFromFilename(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const map = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    tif: 'image/jpeg',
    tiff: 'image/jpeg',
  };
  return map[ext] || 'application/octet-stream';
}

const DOC_TYPES = [
  'bill_of_sale',
  'finance_contract',
  'lease_agreement',
  'credit_application',
  'insurance_application',
  'driver_license',
  'trade_in_appraisal',
  'pre_delivery_inspection',
  'vehicle_history_report',
  'odometer_disclosure',
  'privacy_consent',
  'carfax_report',
  'lien_search',
  'cheque_requisition',
  'transfer_of_liability',
  'vehicle_disclosure_statement',
  'vehicle_registration',
  'tax_exemption_form',
  'deal_recap',
  'other',
];

// Load text-based doc-type guides from lib/examples/*.md.
// These describe what each document looks like visually so Claude can
// classify your specific dealer's document layouts more accurately.
// README.md is skipped. No code change needed — just drop in .md files.
function loadExamples() {
  try {
    const dir = join(process.cwd(), 'lib', 'examples');
    const files = readdirSync(dir)
      .filter((f) => f.endsWith('.md') && f !== 'README.md')
      .sort();
    if (!files.length) return '';
    const blocks = files.map((f) => readFileSync(join(dir, f), 'utf8'));
    return '\n\n---\n\n# Document type guides\n\n' + blocks.join('\n\n---\n\n');
  } catch {
    return '';
  }
}

// Built once at module load and cached for the lifetime of the process.
const CLASSIFY_SYSTEM =
  `You are an F&I document classifier for a BC auto dealership.

You will receive one or more documents from a single deal jacket, each labeled with its filename.
For each document:
1. Identify the document type from the list below
2. Extract every visible field relevant to a vehicle sale
3. Use cross-document context where available — e.g. match a CARFAX VIN against the bill of sale VIN to set vehicle_role

Return ONLY a valid JSON array — one object per document, in the same order they were presented.
No markdown, no explanation, no code fences. Just the raw JSON array.

Each object must follow this exact shape:
{
  "filename": "<filename as labeled above the document>",
  "doc_type": one of ${JSON.stringify(DOC_TYPES)},
  "signed_by_customer": true or false,
  "signed_by_dealer": true or false,
  "fields": {
    "customer_name": string or null,
    "customer_address": string or null,
    "vin": string or null,
    "year": string or null,
    "make": string or null,
    "model": string or null,
    "colour": string or null,
    "odometer_km": number or null,
    "sale_price": number or null,
    "trade_in_value": number or null,
    "trade_in_vin": string or null,
    "down_payment": number or null,
    "amount_financed": number or null,
    "apr": number or null,
    "term_months": number or null,
    "monthly_payment": number or null,
    "gst_amount": number or null,
    "pst_amount": number or null,
    "province": string or null,
    "lien_holder": string or null,
    "lien_amount": number or null,
    "dealer_name": string or null,
    "salesperson": string or null,
    "signed_date": string or null,
    "fees": [{"label": string, "amount": number}],
    "products": [{"name": string, "price": number}],
    "notes": string or null
  }
}

Rules:
- Use null when a field is not visible. Do not invent values.
- Numbers must be numbers (35000.50), not strings ("$35,000.50").
- Dates: prefer YYYY-MM-DD; fall back to original string if unclear.
- signed_by_customer / signed_by_dealer: look for actual signature marks, not just printed names.` +
  loadExamples();

function stripCodeFence(s) {
  return s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
}

// Used by classifyAllDocuments — always returns an array.
function parseJsonArray(text) {
  const cleaned = stripCodeFence(text);
  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    // Try to extract a JSON array from surrounding text
    const arrMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrMatch) {
      try {
        const parsed = JSON.parse(arrMatch[0]);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch { /* fall through */ }
    }
    // Last resort: single object wrapped in array
    const objMatch = cleaned.match(/\{[\s\S]*\}/);
    if (objMatch) return [JSON.parse(objMatch[0])];
    throw new Error('Model did not return valid JSON');
  }
}

// Used by runComplianceCheck — always returns a plain object.
function parseJsonObject(text) {
  const cleaned = stripCodeFence(text);
  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed[0] : parsed;
  } catch {
    const objMatch = cleaned.match(/\{[\s\S]*\}/);
    if (objMatch) return JSON.parse(objMatch[0]);
    throw new Error('Model did not return valid JSON');
  }
}

function logCacheUsage(label, usage) {
  if (!usage) return;
  const read = usage.cache_read_input_tokens ?? 0;
  const created = usage.cache_creation_input_tokens ?? 0;
  const fresh = usage.input_tokens ?? 0;
  console.log(
    `[${label}] cache_read=${read} cache_created=${created} fresh_input=${fresh} output=${usage.output_tokens ?? 0}`
  );
}

// Classify ALL documents from a deal jacket in a single Claude Vision call.
// files: [{ bytes: Buffer, filename: string }]
// Returns: [{ filename, doc_type, signed_by_customer, signed_by_dealer, fields }]
export async function classifyAllDocuments(files) {
  if (files.length === 0) return [];

  // Build a single message with all documents interleaved with filename labels.
  // Claude sees: "--- DOCUMENT: foo.pdf ---" then the PDF, then the next, etc.
  const content = [];
  for (const { bytes, filename } of files) {
    const mimeType = mimeFromFilename(filename);
    content.push({ type: 'text', text: `--- DOCUMENT: ${filename} ---` });
    content.push(toVisionBlock(bytes, mimeType));
  }
  content.push({
    type: 'text',
    text: `Classify all ${files.length} document(s) above and return the JSON array.`,
  });

  const res = await getClient().messages.create({
    model: HAIKU,
    // 8192 handles ~16 documents at ~500 output tokens each.
    // Increase if you regularly process very large deal jackets.
    max_tokens: 8192,
    system: [
      {
        type: 'text',
        text: CLASSIFY_SYSTEM,
        // Cache the system prompt (guides + examples) — after the first deal
        // of the day this is served at ~10% of normal input cost.
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content }],
  });

  logCacheUsage(`classify:${files.length}docs`, res.usage);

  const text = res.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');

  const results = parseJsonArray(text);

  // Map results back to input files. Try filename match first, fall back to
  // positional match so a single missing filename doesn't break the whole deal.
  return files.map((f, i) => {
    const match =
      results.find((r) => r.filename === f.filename) || results[i] || {};
    return {
      filename: f.filename,
      doc_type: match.doc_type || 'other',
      signed_by_customer: match.signed_by_customer ?? false,
      signed_by_dealer: match.signed_by_dealer ?? false,
      fields: match.fields || {},
    };
  });
}

// Run the compliance checklist against all classified documents.
// perFile: [{ filename, doc_type, signed_by_customer, signed_by_dealer, fields }]
export async function runComplianceCheck(perFile) {
  const compliancePrompt = readFileSync(
    join(process.cwd(), 'compliance-prompt.md'),
    'utf8'
  );

  const payload = perFile.map((f) => ({
    filename: f.filename,
    doc_type: f.doc_type,
    signed_by_customer: f.signed_by_customer,
    signed_by_dealer: f.signed_by_dealer,
    fields: f.fields,
  }));

  const res = await getClient().messages.create({
    model: HAIKU,
    max_tokens: 4096,
    system: [
      {
        type: 'text',
        text: compliancePrompt,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: `Deal jacket extracted data:\n\n${JSON.stringify(payload, null, 2)}`,
      },
    ],
  });

  logCacheUsage('compliance', res.usage);

  const text = res.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
  return parseJsonObject(text);
}
