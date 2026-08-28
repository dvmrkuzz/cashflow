// Trinity Cashflow Modeller — server-side email hand-off
// Receives a base64 PDF from the browser and emails it to the onboarding inbox.
// Credentials come from Netlify environment variables and are never sent to the browser.

const nodemailer = require('nodemailer');

const MAX_PDF_BYTES = 8 * 1024 * 1024; // 8 MB ceiling

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  // ── Required config ──
  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
    MAIL_FROM,
    MAIL_TO
  } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !MAIL_TO) {
    console.error('Missing SMTP environment variables');
    return json(500, { error: 'Email is not configured on the server.' });
  }

  // ── Parse and validate the payload ──
  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Malformed request body.' });
  }

  const { filename, pdfBase64, clientName, reportDate, preparedBy } = payload;

  if (!pdfBase64 || typeof pdfBase64 !== 'string') {
    return json(400, { error: 'No PDF supplied.' });
  }

  const pdfBuffer = Buffer.from(pdfBase64, 'base64');
  if (pdfBuffer.length === 0) {
    return json(400, { error: 'PDF was empty.' });
  }
  if (pdfBuffer.length > MAX_PDF_BYTES) {
    return json(413, { error: 'PDF is too large to email (over 8 MB).' });
  }
  // Sanity check: real PDFs start with %PDF
  if (pdfBuffer.slice(0, 4).toString() !== '%PDF') {
    return json(400, { error: 'File does not appear to be a PDF.' });
  }

  // Never trust a client-supplied filename directly
  const safeFilename = String(filename || 'Trinity-Cashflow.pdf')
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'Trinity-Cashflow.pdf';

  const safeClient = String(clientName || 'Unnamed client').slice(0, 120);
  const safeDate = String(reportDate || new Date().toLocaleDateString('en-GB')).slice(0, 40);
  const safePreparer = String(preparedBy || '').slice(0, 120);

  // ── Send ──
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });

  const subject = `Cashflow projection — ${safeClient} — ${safeDate}`;

  const text =
    `Illustrative cashflow projection attached for ${safeClient}, prepared ${safeDate}.\n` +
    (safePreparer ? `Prepared by: ${safePreparer}\n` : '') +
    `\n` +
    `This projection is illustrative only and does not constitute regulated financial advice. ` +
    `Growth is shown net of the charges stated in the assumptions bar. Tax on withdrawals, ` +
    `sequencing risk and legislative changes are not modelled.\n\n` +
    `Sent automatically by the Trinity Cashflow Modeller.\n`;

  const html =
    `<p>Illustrative cashflow projection attached for <strong>${escapeHtml(safeClient)}</strong>, prepared ${escapeHtml(safeDate)}.</p>` +
    (safePreparer ? `<p>Prepared by: ${escapeHtml(safePreparer)}</p>` : '') +
    `<p style="color:#6b7a8f;font-size:12px;line-height:1.6">This projection is illustrative only and does not constitute regulated financial advice. ` +
    `Growth is shown net of the charges stated in the assumptions bar. Tax on withdrawals, sequencing risk and legislative changes are not modelled.</p>` +
    `<p style="color:#9aa5b1;font-size:11px">Sent automatically by the Trinity Cashflow Modeller.</p>`;

  try {
    await transporter.sendMail({
      from: MAIL_FROM || SMTP_USER,
      to: MAIL_TO,
      subject,
      text,
      html,
      attachments: [{ filename: safeFilename, content: pdfBuffer, contentType: 'application/pdf' }]
    });
  } catch (err) {
    console.error('SMTP send failed:', err.message);
    return json(502, { error: 'The email could not be sent. Please download the PDF and send it manually.' });
  }

  return json(200, { ok: true, to: MAIL_TO, filename: safeFilename });
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
