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
  'tax_exemption_form',
  'deal_recap',
  'other',
];

// Load text-based doc-type descriptions from lib/examples/*.md.
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

const CLASSIFY_SYSTEM = `You are an F&I document classifier for a BC auto dealership.

Look at the document image/PDF provided and:
1. Identify the document type
2. Extract every visible field relevant to a vehicle sale

Return ONLY valid JSON — no markdown, no explanation:
{
  "doc_type": one of ${JSON.stringify(DOC_TYPES)},
  "signed_by_customer": true/false,
  "signed_by_dealer": true/false,
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

Use null when a field is not visible. Numbers must be numbers not strings. Do not invent values.` + loadExamples();

function stripCodeFence(s) {
  return s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
}

function parseJson(text) {
  const cleaned = stripCodeFence(text);
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Model did not return valid JSON');
  }
}

// Classify a single document using Claude Vision.
// Returns { doc_type, signed_by_customer, signed_by_dealer, fields }
export async function classifyDocument(bytes, filename) {
  const mimeType = mimeFromFilename(filename);
  const visionBlock = toVisionBlock(bytes, mimeType);

  const res = await getClient().messages.create({
    model: HAIKU,
    max_tokens: 2048,
    system: CLASSIFY_SYSTEM,
    messages: [
      {
        role: 'user',
        content: [
          visionBlock,
          { type: 'text', text: `Filename: ${filename}\n\nClassify this document and extract all visible fields.` },
        ],
      },
    ],
  });

  const text = res.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
  return parseJson(text);
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
    system: compliancePrompt,
    messages: [
      {
        role: 'user',
        content: `Deal jacket extracted data:\n\n${JSON.stringify(payload, null, 2)}`,
      },
    ],
  });

  const text = res.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
  return parseJson(text);
}
