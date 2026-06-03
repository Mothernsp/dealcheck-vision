import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

let _client;
function getClient() {
  if (!_client) _client = new Anthropic();
  return _client;
}

const OPUS = 'claude-opus-4-7';

// The model used for both the classification and compliance calls. Exported so
// the processor can record it on cache entries and only reuse a cached result
// when it was produced by the same model (see classification_cache / Phase 1.2).
export const MODEL = OPUS;

const SUPPORTED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/tiff',
]);

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

export function mimeFromFilename(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const map = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    tif: 'image/tiff',
    tiff: 'image/tiff',
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

const CLASSIFY_SYSTEM =
  `You are an F&I document classifier for a BC auto dealership.

You will receive one or more uploaded files. Each file may be a SINGLE document OR a multi-page scan containing SEVERAL different documents stapled together into one PDF.

Your job:
1. Scan every page of every file
2. Identify each distinct document — a new document starts when the page header, title, layout, or paper type changes to a completely different form (e.g. "BILL OF SALE" ends and "VEHICLE HISTORY REPORT" begins)
3. Extract fields from each document
4. Return ONE JSON object per distinct document found — NOT one per file

A single 30-page uploaded PDF might contain 10 separate documents. Return 10 objects.
A single 1-page uploaded PDF contains 1 document. Return 1 object.

Document boundary signals to look for:
- A new bold title or form name at the top of a page (e.g. "MOTOR VEHICLE PURCHASE AGREEMENT", "CARFAX Canada Vehicle History Report", "Deal Recap", "CREDIT APPLICATION")
- A completely different layout or paper format starting on the next page
- ICBC / government form headers
- A new document number, date, or customer name block restarting

Return ONLY a valid JSON array. No markdown, no explanation, no code fences.

Each object must follow this exact shape:
{
  "source_file": "<filename as labeled above the file>",
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
- signed_by_customer / signed_by_dealer: look for actual signature marks, not just printed names.
- Cross-document context: match CARFAX VINs against bill of sale VINs to set vehicle_role in notes.` +
  loadExamples();

function stripCodeFence(s) {
  return s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
}

export function parseJsonArray(text) {
  const cleaned = stripCodeFence(text);
  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    const arrMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrMatch) {
      try {
        const parsed = JSON.parse(arrMatch[0]);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch { /* fall through */ }
    }
    const objMatch = cleaned.match(/\{[\s\S]*\}/);
    if (objMatch) return [JSON.parse(objMatch[0])];
    throw new Error('Model did not return valid JSON');
  }
}

export function parseJsonObject(text) {
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

export function logCacheUsage(label, usage) {
  if (!usage) return;
  const read = usage.cache_read_input_tokens ?? 0;
  const created = usage.cache_creation_input_tokens ?? 0;
  const fresh = usage.input_tokens ?? 0;
  console.log(
    `[${label}] cache_read=${read} cache_created=${created} fresh_input=${fresh} output=${usage.output_tokens ?? 0}`
  );
}

// Build the messages.create params for classification. Shared by the sync call
// and the batch path so the prompt, schema, and cache_control live in one place.
export function buildClassifyParams(files, { model = MODEL } = {}) {
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
  return {
    model,
    max_tokens: 16000,
    system: [{ type: 'text', text: CLASSIFY_SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content }],
  };
}

// Concatenate the text blocks of a message's content array.
export function messageText(content) {
  return content.filter((b) => b.type === 'text').map((b) => b.text).join('');
}

// Normalize raw parsed classification objects into our per-document shape.
export function normalizeClassification(results, files) {
  return results.map((r, i) => {
    const sourceFile = r.source_file || r.filename || (files[0]?.filename ?? 'unknown');
    return {
      filename: `${sourceFile} — doc ${i + 1}`,
      source_file: sourceFile,
      doc_type: r.doc_type || 'other',
      signed_by_customer: r.signed_by_customer ?? false,
      signed_by_dealer: r.signed_by_dealer ?? false,
      fields: r.fields || {},
    };
  });
}

// options.model: override the model (defaults to production MODEL).
// options.onUsage: optional callback receiving res.usage — used by the eval
// harness to capture tokens for cost accounting. Production calls pass neither,
// so behavior is unchanged.
export async function classifyAllDocuments(files, { model = MODEL, onUsage } = {}) {
  if (files.length === 0) return [];
  const res = await getClient().messages.create(buildClassifyParams(files, { model }));
  logCacheUsage(`classify:${files.length}files:${model}`, res.usage);
  if (onUsage) onUsage(res.usage);
  return normalizeClassification(parseJsonArray(messageText(res.content)), files);
}

export function buildComplianceParams(perFile, { model = MODEL } = {}) {
  const compliancePrompt = readFileSync(join(process.cwd(), 'compliance-prompt.md'), 'utf8');
  const payload = perFile.map((f) => ({
    filename: f.filename,
    doc_type: f.doc_type,
    signed_by_customer: f.signed_by_customer,
    signed_by_dealer: f.signed_by_dealer,
    fields: f.fields,
  }));
  return {
    model,
    max_tokens: 4096,
    system: [{ type: 'text', text: compliancePrompt, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: `Deal jacket extracted data:\n\n${JSON.stringify(payload, null, 2)}` }],
  };
}

export async function runComplianceCheck(perFile, { model = MODEL, onUsage } = {}) {
  const res = await getClient().messages.create(buildComplianceParams(perFile, { model }));
  logCacheUsage(`compliance:${model}`, res.usage);
  if (onUsage) onUsage(res.usage);
  return parseJsonObject(messageText(res.content));
}
