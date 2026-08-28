# Trinity Cashflow Modeller — Netlify deployment

One-click send: the paraplanner runs a projection, clicks **Send to Onboarding**, and the
branded PDF is emailed to the onboarding inbox with the file attached. No download, no
drag-and-drop, no credentials in the browser.

## Structure

```
public/index.html                    the modeller (deployed as the site)
netlify/functions/send-report.js     server-side email sender
netlify.toml                         build config
package.json                         nodemailer dependency
```

## Deploy

1. Push this folder to a Git repo (GitHub/GitLab/Bitbucket).
2. In Netlify: **Add new site → Import an existing project**, pick the repo.
3. Build command: leave blank. Publish directory: `public`. Functions directory is picked
   up from `netlify.toml`.
4. Set the environment variables below, then **Deploy**.

## Environment variables

Netlify → Site configuration → Environment variables. These live on the server and are
never sent to the browser.

| Variable | Value | Notes |
|---|---|---|
| `SMTP_HOST` | `smtp.gmail.com` | Microsoft 365: `smtp.office365.com` |
| `SMTP_PORT` | `587` | |
| `SMTP_USER` | the sending account's address | |
| `SMTP_PASS` | the app password | **Not** the normal account password |
| `MAIL_FROM` | display sender, e.g. `Trinity Modeller <noreply@…>` | optional; defaults to `SMTP_USER` |
| `MAIL_TO` | `clientonboarding@trinitycapitalpartners.co.uk` | recipient |

### Gmail app password
Google Account → Security → 2-Step Verification (must be on) → App passwords → generate.
Paste the 16-character value into `SMTP_PASS`.

### Preferred: Microsoft 365 instead
Mail sent from a Gmail address on behalf of the firm may be filtered as spam and looks
wrong to onboarding. If IT can provide a Trinity mailbox, use `smtp.office365.com` with
that account — same setup, better deliverability and a sender address that matches the
firm.

## Access control — do this before real client data goes through it

The site must not be publicly reachable. Either:

- **Netlify password protection** (Site configuration → Access control), or
- **Netlify Identity** with invite-only accounts, or
- restrict to office IPs at the DNS/proxy layer.

Suggested URL once live: `tools.trinitycapitalpartners.co.uk` (subdomain, so access rules
stay separate from the main website).

## Behaviour and failure handling

- No projection run yet → the button explains rather than sending an empty report.
- PDF generation fails → falls back to the Print / PDF route.
- Send fails (SMTP down, bad credentials, network) → the PDF downloads locally and the
  modal offers a pre-addressed draft, so the work is never lost.
- PDFs over 8 MB are rejected by the function rather than bouncing at the mail server.

## Compliance notes

Two points to raise with Ellis before this goes into use:

1. The methodology note currently states the tool has **no external data feeds**. This
   deployment sends client financial data from the browser, through Netlify's
   infrastructure, to the mail provider. That is a new data flow and a third-party
   processor in the chain — a GDPR consideration that should be documented.
2. Automatic sending removes the natural checkpoint where a paraplanner reviews the
   output before it leaves. For a tool scoped as *illustration only*, consider whether a
   confirmation step should remain.
