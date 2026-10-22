export type Lang = 'en' | 'de'

export interface Email {
  to: string
  subject: string
  html: string
  text: string
}

export type SendEmail = (email: Email) => Promise<void>

/** Sends through Resend. Without an API key there's no sender, and email sign-in stays off. */
export function resendSender(apiKey: string | undefined, from: string): SendEmail | null {
  if (!apiKey) return null
  return async ({ to, subject, html, text }) => {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from, to, subject, html, text }),
    })
    if (!res.ok)
      throw new Error(`Resend answered ${res.status}: ${await res.text().catch(() => '')}`)
  }
}

const COPY = {
  en: {
    subject: (code: string) => `${code} is your meandu code`,
    'sign-in': { title: 'Your code', lead: 'Type it into meandu to sign in.' },
    'add-email': {
      title: 'Confirm your email',
      lead: 'Type it into meandu to keep your account safe.',
    },
    expiry: 'It works for 10 minutes.',
    ignore: "Didn't ask for this? Just ignore it.",
  },
  de: {
    subject: (code: string) => `${code} ist dein meandu-Code`,
    'sign-in': { title: 'Dein Code', lead: 'Gib ihn in meandu ein, um dich anzumelden.' },
    'add-email': {
      title: 'Bestätige deine E-Mail',
      lead: 'Gib ihn in meandu ein, damit dein Konto sicher ist.',
    },
    expiry: 'Er gilt 10 Minuten.',
    ignore: 'Nicht angefordert? Dann einfach ignorieren.',
  },
}

const FONT = `-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`

/** The one email meandu sends: a code, big and friendly, in light and dark. */
export function codeEmail({
  code,
  lang,
  purpose,
  site,
}: {
  code: string
  lang: Lang
  purpose: 'sign-in' | 'add-email'
  site: string
}): Omit<Email, 'to'> {
  const t = COPY[lang]
  const { title, lead } = t[purpose]
  const subject = t.subject(code)
  const html = `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${subject}</title>
<style>
@media (prefers-color-scheme: dark) {
  .page { background: #1c1418 !important; }
  .card { background: #271d22 !important; }
  .ink { color: #f8ecef !important; }
  .muted { color: #b9a6ac !important; }
  .code { background: #31262b !important; color: #f8ecef !important; }
}
</style>
</head>
<body class="page" style="margin:0;padding:0;background:#fff7f2;">
<div style="display:none;max-height:0;overflow:hidden;">${code} · ${t.expiry}</div>
<table role="presentation" class="page" width="100%" cellpadding="0" cellspacing="0" style="background:#fff7f2;">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;">
<tr><td align="center" style="padding-bottom:24px;">
<img src="${site}/pwa-192x192.png" width="56" height="56" alt="meandu" style="display:block;border:0;border-radius:16px;">
</td></tr>
<tr><td class="card" style="background:#ffffff;border-radius:24px;padding:36px 28px;text-align:center;font-family:${FONT};">
<p class="ink" style="margin:0;font-size:22px;line-height:1.3;font-weight:800;color:#2b1d22;">${title}</p>
<p class="muted" style="margin:8px 0 28px;font-size:16px;line-height:1.4;color:#7a666c;">${lead}</p>
<div class="code" style="display:inline-block;padding:16px 22px;border-radius:16px;background:#fbede6;color:#2b1d22;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:34px;line-height:1;font-weight:700;letter-spacing:8px;">${code}</div>
<p class="muted" style="margin:28px 0 0;font-size:14px;line-height:1.4;color:#7a666c;">${t.expiry}</p>
</td></tr>
<tr><td align="center" style="padding-top:20px;font-family:${FONT};font-size:13px;line-height:1.5;color:#b2a0a6;">
${t.ignore}<br>meandu · ${new URL(site).host}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
  const text = `${title}\n\n${lead}\n\n${code}\n\n${t.expiry}\n${t.ignore}\n\nmeandu · ${new URL(site).host}`
  return { subject, html, text }
}
