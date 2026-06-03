import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { get, run } from '../config/database.js';
import { sendSystemEmail } from '../emailServer.js';
const OTP_TTL_SECONDS = 120; // 2 minutes
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_SECONDS = 30;
function generateCode() {
    // 6-digit numeric (zero-padded). Use crypto for unbiased numeric digits.
    const buf = randomBytes(4).readUInt32BE(0);
    return String(buf % 1_000_000).padStart(6, '0');
}
export async function requestOtp(email, purpose) {
    const normalized = String(email || '').trim().toLowerCase();
    if (!normalized)
        return { ok: false, message: 'Email is required' };
    // Rate-limit: reject if we issued an OTP for this email+purpose in the last RESEND_COOLDOWN seconds.
    const recent = await get(`SELECT id, created_at FROM email_otps
     WHERE email = ? AND purpose = ?
       AND created_at > DATE_SUB(NOW(), INTERVAL ? SECOND)
     ORDER BY id DESC LIMIT 1`, [normalized, purpose, OTP_RESEND_COOLDOWN_SECONDS]);
    if (recent) {
        return { ok: false, message: `Please wait ${OTP_RESEND_COOLDOWN_SECONDS}s before requesting another code.`, cooldown: OTP_RESEND_COOLDOWN_SECONDS };
    }
    // Invalidate any previous unused codes for this email+purpose so only the newest is valid.
    await run('UPDATE email_otps SET used = 1 WHERE email = ? AND purpose = ? AND used = 0', [normalized, purpose]);
    const code = generateCode();
    const codeHash = await bcrypt.hash(code, 8);
    await run(`INSERT INTO email_otps (email, code_hash, purpose, attempts, used, expires_at)
     VALUES (?, ?, ?, 0, 0, DATE_ADD(NOW(), INTERVAL ? SECOND))`, [normalized, codeHash, purpose, OTP_TTL_SECONDS]);
    const { subject, html, text } = buildEmail(code, purpose);
    const sent = await sendSystemEmail({ to: normalized, subject, text, html });
    if (!sent) {
        return { ok: false, message: 'Email delivery is not configured. Ask an admin to set up SMTP in Admin → Email Server.' };
    }
    return { ok: true, message: `A 6-digit code was sent to ${normalized}. It expires in 2 minutes.` };
}
export async function verifyOtp(email, code, purpose) {
    const normalized = String(email || '').trim().toLowerCase();
    const cleanCode = String(code || '').trim();
    if (!normalized || !cleanCode)
        return { ok: false, message: 'Email and code are required' };
    const row = await get(`SELECT id, code_hash, attempts, used, expires_at
     FROM email_otps
     WHERE email = ? AND purpose = ?
     ORDER BY id DESC LIMIT 1`, [normalized, purpose]);
    if (!row)
        return { ok: false, message: 'No code requested. Please request a new code.' };
    if (row.used)
        return { ok: false, message: 'This code has already been used. Please request a new code.' };
    if (new Date(row.expires_at).getTime() < Date.now()) {
        return { ok: false, message: 'This code has expired. Please request a new code.' };
    }
    if (row.attempts >= OTP_MAX_ATTEMPTS) {
        await run('UPDATE email_otps SET used = 1 WHERE id = ?', [row.id]);
        return { ok: false, message: 'Too many incorrect attempts. Please request a new code.' };
    }
    const match = await bcrypt.compare(cleanCode, row.code_hash);
    if (!match) {
        await run('UPDATE email_otps SET attempts = attempts + 1 WHERE id = ?', [row.id]);
        const remaining = OTP_MAX_ATTEMPTS - (row.attempts + 1);
        return { ok: false, message: remaining > 0 ? `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} left.` : 'Too many incorrect attempts. Please request a new code.' };
    }
    await run('UPDATE email_otps SET used = 1 WHERE id = ?', [row.id]);
    return { ok: true, message: 'Code verified.' };
}
function buildEmail(code, purpose) {
    const purposeLabel = purpose === 'register' ? 'complete your registration' :
        purpose === 'forgot_password' ? 'reset your password' :
            'change your password';
    const subject = purpose === 'register' ? 'Verify your email — FitWay Hub' :
        purpose === 'forgot_password' ? 'Password reset code — FitWay Hub' :
            'Password change code — FitWay Hub';
    const text = `Your FitWay Hub verification code is: ${code}\n\n` +
        `Use it to ${purposeLabel}. The code expires in 2 minutes.\n\n` +
        `If you didn't request this, you can ignore this email.`;
    const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f6f7f9;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:480px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
        <tr><td style="padding:28px 32px 8px;">
          <h1 style="margin:0 0 4px;font-size:18px;font-weight:700;color:#111827;">FitWay Hub</h1>
          <p style="margin:0;color:#6b7280;font-size:13px;">Verification code</p>
        </td></tr>
        <tr><td style="padding:16px 32px 8px;">
          <p style="margin:0 0 16px;color:#111827;font-size:15px;line-height:1.55;">
            Use the code below to ${purposeLabel}.
          </p>
          <div style="font-size:32px;font-weight:700;letter-spacing:8px;color:#111827;background:#f3f4f6;border-radius:8px;padding:18px 0;text-align:center;font-family:'SF Mono',Menlo,Consolas,monospace;">
            ${code}
          </div>
          <p style="margin:18px 0 0;color:#6b7280;font-size:13px;line-height:1.55;">
            This code expires in <strong>2 minutes</strong>. If you didn't request it, you can safely ignore this email.
          </p>
        </td></tr>
        <tr><td style="padding:24px 32px 28px;border-top:1px solid #e5e7eb;margin-top:16px;">
          <p style="margin:0;color:#9ca3af;font-size:12px;">FitWay Hub — never share this code with anyone.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
    return { subject, text, html };
}
//# sourceMappingURL=otpService.js.map