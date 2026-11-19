/**
 * Transactional email (password reset and similar account mail).
 *
 * - Providers: "resend" (HTTPS API, no SDK needed), "log" (prints the message to the server
 *   log; local development only) and "none" (sending disabled, reported honestly).
 * - Emails never contain health information: no exercise names, pain scores or messages.
 * - Messages are bilingual (Hebrew + English) because the server does not store a locale.
 * - Sending failures are logged and reported to the caller; callers decide what the user sees.
 */
import { config } from '../config.js';

export type EmailMessage = { to: string; subject: string; text: string; html?: string };
export type EmailResult = { ok: true; id?: string } | { ok: false; error: string };

export interface EmailAdapter {
  readonly provider: string;
  readonly configured: boolean;
  send(message: EmailMessage): Promise<EmailResult>;
}

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export function createEmailAdapter(settings = config.email): EmailAdapter {
  if (settings.provider === 'resend') {
    const apiKey = settings.resendApiKey;
    if (!apiKey) return disabled('resend', 'RESEND_API_KEY is not set');
    return {
      provider: 'resend',
      configured: true,
      async send(message) {
        try {
          const response = await fetch(RESEND_ENDPOINT, {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: settings.from,
              to: [message.to],
              subject: message.subject,
              text: message.text,
              ...(message.html ? { html: message.html } : {}),
              ...(settings.replyTo ? { reply_to: settings.replyTo } : {}),
            }),
            signal: AbortSignal.timeout(15_000),
          });
          if (!response.ok) {
            const body = await response.text().catch(() => '');
            return { ok: false, error: `Resend responded ${response.status}: ${body.slice(0, 300)}` };
          }
          const data = (await response.json().catch(() => ({}))) as { id?: string };
          return { ok: true, id: data.id };
        } catch (error) {
          return { ok: false, error: error instanceof Error ? error.message : String(error) };
        }
      },
    };
  }

  if (settings.provider === 'log') {
    return {
      provider: 'log',
      configured: true,
      async send(message) {
        console.log(`[email:log] to=${message.to} subject=${JSON.stringify(message.subject)}\n${message.text}`);
        return { ok: true };
      },
    };
  }

  return disabled(settings.provider, 'EMAIL_PROVIDER is not configured');
}

function disabled(provider: string, reason: string): EmailAdapter {
  return { provider, configured: false, send: async () => ({ ok: false, error: reason }) };
}

let adapter: EmailAdapter | null = null;

export function emailAdapter() {
  adapter ??= createEmailAdapter();
  return adapter;
}

/** Tests inject a fake adapter; pass null to go back to the configured one. */
export function setEmailAdapter(next: EmailAdapter | null) {
  adapter = next;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);
}

/** Password reset: the link is the only secret. Valid for one hour, single use. */
export function passwordResetEmail(input: { to: string; name: string; link: string }): EmailMessage {
  const name = input.name.trim() || input.to;
  const text = [
    `שלום ${name},`,
    '',
    'התקבלה בקשה לאיפוס הסיסמה בחשבון RehabQuest שלך. כדי לבחור סיסמה חדשה, פתחו את הקישור הבא בתוך שעה:',
    input.link,
    '',
    'אם לא ביקשתם לאפס את הסיסמה, אפשר להתעלם מהודעה זו. הסיסמה הנוכחית נשארת בתוקף.',
    '',
    '---',
    '',
    `Hi ${name},`,
    '',
    'Someone asked to reset the password for your RehabQuest account. To choose a new password, open this link within one hour:',
    input.link,
    '',
    'If you did not ask for this, you can ignore this email. Your current password stays valid.',
  ].join('\n');

  const safeName = escapeHtml(name);
  const safeLink = escapeHtml(input.link);
  const html = `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#1f2933">
<div dir="rtl" lang="he">
<p>שלום ${safeName},</p>
<p>התקבלה בקשה לאיפוס הסיסמה בחשבון RehabQuest שלך. כדי לבחור סיסמה חדשה, לחצו על הקישור בתוך שעה:</p>
<p><a href="${safeLink}" style="display:inline-block;padding:12px 20px;background:#0A8274;color:#fff;text-decoration:none;border-radius:12px;font-weight:bold">איפוס סיסמה</a></p>
<p>אם לא ביקשתם לאפס את הסיסמה, אפשר להתעלם מהודעה זו. הסיסמה הנוכחית נשארת בתוקף.</p>
</div>
<hr style="border:none;border-top:1px solid #d9e2ec;margin:24px 0">
<div dir="ltr" lang="en">
<p>Hi ${safeName},</p>
<p>Someone asked to reset the password for your RehabQuest account. To choose a new password, open this link within one hour:</p>
<p><a href="${safeLink}" style="display:inline-block;padding:12px 20px;background:#0A8274;color:#fff;text-decoration:none;border-radius:12px;font-weight:bold">Reset password</a></p>
<p>If you did not ask for this, you can ignore this email. Your current password stays valid.</p>
<p style="font-size:13px;color:#52606d">If the button does not work, copy this address into your browser:<br>${safeLink}</p>
</div>
</body></html>`;

  return { to: input.to, subject: 'איפוס סיסמה ל-RehabQuest / Reset your RehabQuest password', text, html };
}
