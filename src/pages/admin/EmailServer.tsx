import { useState, useEffect, useCallback } from "react";
import type { FormEvent } from "react";
import DOMPurify from "dompurify";
import { Mail, Plus, Trash2, Send, Inbox, ArrowLeft, RefreshCw, Settings, CheckCircle, XCircle, Zap } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getApiBase } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const API = getApiBase();

interface EmailAccount {
  id: number;
  email: string;
  display_name: string;
  created_at: string;
}

interface Email {
  id: number;
  sender: string;
  recipient: string;
  subject: string;
  text_body: string;
  html_body: string;
  direction: "inbound" | "outbound";
  is_read: number;
  created_at: string;
}

interface SmtpSettings {
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_pass: string;
  smtp_secure: "none" | "tls" | "starttls";
  from_name: string;
  from_email: string;
  enabled: number;
}

type View = "settings" | "accounts" | "inbox" | "sent" | "compose" | "read";

export default function EmailServer() {
  const { token } = useAuth();
  const [view, setView] = useState<View>("settings");
  const [domain, setDomain] = useState("");
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<EmailAccount | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // SMTP settings
  const [smtp, setSmtp] = useState<SmtpSettings>({ smtp_host: "", smtp_port: 587, smtp_user: "", smtp_pass: "", smtp_secure: "starttls", from_name: "", from_email: "", enabled: 0 });
  const [smtpLoading, setSmtpLoading] = useState(false);
  const [smtpTesting, setSmtpTesting] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testSending, setTestSending] = useState(false);

  // create account form
  const [localPart, setLocalPart] = useState("");
  const [displayName, setDisplayName] = useState("");

  // compose form
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [sending, setSending] = useState(false);

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const flash = (msg: string, type: "error" | "success" = "error") => {
    if (type === "error") { setError(msg); setSuccess(""); }
    else { setSuccess(msg); setError(""); }
    setTimeout(() => { setError(""); setSuccess(""); }, 5000);
  };

  const fetchDomain = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/email/domain`, { headers });
      const d = await r.json();
      setDomain(d.domain || "");
    } catch { /* ignore */ }
  }, [token]);

  const fetchSettings = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/email/settings`, { headers });
      const d = await r.json();
      if (d.settings) setSmtp(d.settings);
    } catch { /* ignore */ }
  }, [token]);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/email/accounts`, { headers });
      const d = await r.json();
      setAccounts(d.accounts || []);
    } catch { flash("Failed to load accounts"); }
    setLoading(false);
  }, [token]);

  const fetchEmails = useCallback(async (accountId: number, direction: "inbound" | "outbound") => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/email/accounts/${accountId}/emails?direction=${direction}`, { headers });
      const d = await r.json();
      setEmails(d.emails || []);
    } catch { flash("Failed to load emails"); }
    setLoading(false);
  }, [token]);

  useEffect(() => { fetchDomain(); fetchSettings(); fetchAccounts(); }, [fetchDomain, fetchSettings, fetchAccounts]);

  async function saveSettings(e: FormEvent) {
    e.preventDefault();
    setSmtpLoading(true);
    try {
      const r = await fetch(`${API}/api/email/settings`, {
        method: "PUT", headers,
        body: JSON.stringify(smtp),
      });
      const d = await r.json();
      if (!r.ok) return flash(d.message || "Failed to save");
      flash("SMTP settings saved!", "success");
    } catch { flash("Network error"); }
    setSmtpLoading(false);
  }

  async function testConnection() {
    setSmtpTesting(true);
    try {
      const r = await fetch(`${API}/api/email/settings/test`, { method: "POST", headers });
      const d = await r.json();
      flash(d.message, d.ok ? "success" : "error");
    } catch { flash("Network error"); }
    setSmtpTesting(false);
  }

  async function sendTestEmail(e: FormEvent) {
    e.preventDefault();
    if (!testEmail.trim()) return flash("Enter recipient email");
    setTestSending(true);
    try {
      const r = await fetch(`${API}/api/email/settings/test-send`, {
        method: "POST", headers,
        body: JSON.stringify({ to: testEmail.trim() }),
      });
      const d = await r.json();
      flash(d.message, d.ok ? "success" : "error");
    } catch { flash("Network error"); }
    setTestSending(false);
  }

  async function createAccount(e: FormEvent) {
    e.preventDefault();
    if (!localPart.trim()) return flash("Enter the email name (part before @)");
    try {
      const r = await fetch(`${API}/api/email/accounts`, {
        method: "POST", headers,
        body: JSON.stringify({ local_part: localPart.trim(), display_name: displayName.trim() }),
      });
      const d = await r.json();
      if (!r.ok) return flash(d.message || "Failed");
      flash(`Created ${d.email}`, "success");
      setLocalPart(""); setDisplayName("");
      fetchAccounts();
    } catch { flash("Network error"); }
  }

  async function deleteAccount(id: number) {
    if (!confirm("Delete this email account and all its emails?")) return;
    try {
      await fetch(`${API}/api/email/accounts/${id}`, { method: "DELETE", headers });
      flash("Account deleted", "success");
      if (selectedAccount?.id === id) { setSelectedAccount(null); setView("accounts"); }
      fetchAccounts();
    } catch { flash("Delete failed"); }
  }

  async function deleteEmail(id: number) {
    try {
      await fetch(`${API}/api/email/emails/${id}`, { method: "DELETE", headers });
      setEmails((prev) => prev.filter((e) => e.id !== id));
      if (selectedEmail?.id === id) { setSelectedEmail(null); setView(view === "read" ? "inbox" : view); }
    } catch { flash("Failed to delete email"); }
  }

  function openInbox(account: EmailAccount) {
    setSelectedAccount(account);
    setView("inbox");
    fetchEmails(account.id, "inbound");
  }

  function openSent(account: EmailAccount) {
    setSelectedAccount(account);
    setView("sent");
    fetchEmails(account.id, "outbound");
  }

  function openCompose(account: EmailAccount) {
    setSelectedAccount(account);
    setComposeTo(""); setComposeSubject(""); setComposeBody("");
    setView("compose");
  }

  async function openEmail(em: Email) {
    setSelectedEmail(em);
    setView("read");
    // mark as read
    if (!em.is_read) {
      try {
        await fetch(`${API}/api/email/emails/${em.id}`, { headers });
        setEmails((prev) => prev.map((e) => e.id === em.id ? { ...e, is_read: 1 } : e));
      } catch { /* ignore */ }
    }
  }

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!composeTo.trim() || !composeSubject.trim()) return flash("Recipient and subject are required");
    setSending(true);
    try {
      const r = await fetch(`${API}/api/email/send`, {
        method: "POST", headers,
        body: JSON.stringify({
          account_id: selectedAccount!.id,
          to: composeTo.trim(),
          subject: composeSubject.trim(),
          text: composeBody,
        }),
      });
      const d = await r.json();
      if (!r.ok) return flash(d.message || "Send failed");
      flash("Email sent!", "success");
      setView("sent");
      fetchEmails(selectedAccount!.id, "outbound");
    } catch { flash("Network error"); }
    setSending(false);
  }

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        {!["settings", "accounts"].includes(view) && (
          <Button variant="outline" size="sm" onClick={() => setView("accounts")}>
            <ArrowLeft size={14} strokeWidth={2} /> Back
          </Button>
        )}
        <span className="grid size-11 shrink-0 place-items-center rounded-md bg-primary/15 text-primary">
          <Mail size={20} strokeWidth={2} />
        </span>
        <h1 className="text-[26px] leading-tight font-bold tracking-tight">Email Server</h1>
        {domain && <Badge variant="muted" className="text-[12px]">@{domain}</Badge>}
      </div>

      {/* Tab buttons */}
      <div className="flex gap-2">
        <Button variant={view === "settings" ? "default" : "outline"} size="sm" onClick={() => setView("settings")}>
          <Settings size={14} strokeWidth={2} /> SMTP Settings
        </Button>
        <Button variant={view === "accounts" ? "default" : "outline"} size="sm" onClick={() => setView("accounts")}>
          <Mail size={14} strokeWidth={2} /> Accounts
        </Button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/12 px-4 py-2.5 text-[13px] font-semibold text-destructive">
          <XCircle size={15} strokeWidth={2} /> {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-md bg-[color-mix(in_srgb,var(--green)_14%,transparent)] px-4 py-2.5 text-[13px] font-semibold text-[var(--green)]">
          <CheckCircle size={15} strokeWidth={2} /> {success}
        </div>
      )}

      {/* ─── SMTP SETTINGS VIEW ─── */}
      {view === "settings" && (
        <div className="space-y-6">
          <Card className="gap-0 p-5">
            <h3 className="flex items-center gap-2 text-[15px] font-semibold">
              <Settings size={15} strokeWidth={2} className="text-muted-foreground" /> SMTP Relay Configuration
            </h3>
            <p className="mt-1.5 mb-4 text-[13px] text-muted-foreground">
              Configure an external SMTP service (Gmail, SendGrid, Mailgun, etc.) to send real emails.
            </p>
            <form onSubmit={saveSettings} className="flex flex-col gap-3.5">
              <div className="flex flex-wrap gap-3">
                <div className="grid flex-[2_1_200px] gap-1.5">
                  <Label htmlFor="smtp-host" className="text-[12px]">SMTP Host *</Label>
                  <Input id="smtp-host" value={smtp.smtp_host} onChange={(e) => setSmtp({ ...smtp, smtp_host: e.target.value })} placeholder="smtp.gmail.com" />
                </div>
                <div className="grid flex-[1_1_100px] gap-1.5">
                  <Label htmlFor="smtp-port" className="text-[12px]">Port *</Label>
                  <Input id="smtp-port" type="number" value={smtp.smtp_port} onChange={(e) => setSmtp({ ...smtp, smtp_port: Number(e.target.value) })} placeholder="587" />
                </div>
                <div className="grid flex-[1_1_120px] gap-1.5">
                  <Label htmlFor="smtp-secure" className="text-[12px]">Security</Label>
                  <Select value={smtp.smtp_secure} onValueChange={(v) => setSmtp({ ...smtp, smtp_secure: v as any })}>
                    <SelectTrigger id="smtp-secure" className="h-11 w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="starttls">STARTTLS (587)</SelectItem>
                      <SelectItem value="tls">TLS/SSL (465)</SelectItem>
                      <SelectItem value="none">None (25)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <div className="grid flex-[1_1_200px] gap-1.5">
                  <Label htmlFor="smtp-user" className="text-[12px]">Username / Email *</Label>
                  <Input id="smtp-user" value={smtp.smtp_user} onChange={(e) => setSmtp({ ...smtp, smtp_user: e.target.value })} placeholder="your-email@gmail.com" />
                </div>
                <div className="grid flex-[1_1_200px] gap-1.5">
                  <Label htmlFor="smtp-pass" className="text-[12px]">Password / App Password *</Label>
                  <Input id="smtp-pass" type="password" value={smtp.smtp_pass} onChange={(e) => setSmtp({ ...smtp, smtp_pass: e.target.value })} placeholder="••••••••" />
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <div className="grid flex-[1_1_200px] gap-1.5">
                  <Label htmlFor="from-name" className="text-[12px]">From Name</Label>
                  <Input id="from-name" value={smtp.from_name} onChange={(e) => setSmtp({ ...smtp, from_name: e.target.value })} placeholder="FitWay Hub" />
                </div>
                <div className="grid flex-[1_1_200px] gap-1.5">
                  <Label htmlFor="from-email" className="text-[12px]">From Email</Label>
                  <Input id="from-email" value={smtp.from_email} onChange={(e) => setSmtp({ ...smtp, from_email: e.target.value })} placeholder="noreply@fitwayhub.com" />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Switch id="smtp-enabled" checked={!!smtp.enabled} onCheckedChange={(c) => setSmtp({ ...smtp, enabled: c ? 1 : 0 })} />
                <Label htmlFor="smtp-enabled" className="cursor-pointer text-[13px] font-semibold">Enable email sending</Label>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={smtpLoading}>
                  {smtpLoading ? "Saving..." : "Save Settings"}
                </Button>
                <Button type="button" variant="outline" onClick={testConnection} disabled={smtpTesting}
                  className="text-[var(--secondary)] ring-[color-mix(in_srgb,var(--secondary)_40%,transparent)] hover:bg-[color-mix(in_srgb,var(--secondary)_10%,transparent)] hover:text-[var(--secondary)]">
                  <Zap size={14} strokeWidth={2} /> {smtpTesting ? "Testing..." : "Test Connection"}
                </Button>
              </div>
            </form>
          </Card>

          {/* Test send */}
          <Card className="gap-0 p-5">
            <h3 className="flex items-center gap-2 text-[15px] font-semibold">
              <Send size={15} strokeWidth={2} className="text-muted-foreground" /> Send Test Email
            </h3>
            <p className="mt-1.5 mb-3 text-[13px] text-muted-foreground">
              Send a test email to verify your SMTP settings are working correctly.
            </p>
            <form onSubmit={sendTestEmail} className="flex flex-wrap items-end gap-2.5">
              <div className="grid flex-[1_1_250px] gap-1.5">
                <Label htmlFor="test-email" className="text-[12px]">Recipient Email</Label>
                <Input id="test-email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="your-email@gmail.com" />
              </div>
              <Button type="submit" disabled={testSending}
                className="bg-[var(--secondary)] text-white hover:bg-[var(--secondary)]/90">
                <Send size={14} strokeWidth={2} /> {testSending ? "Sending..." : "Send Test"}
              </Button>
            </form>
          </Card>

          {/* Quick setup guides */}
          <Card className="gap-0 p-5">
            <h3 className="mb-2.5 text-[15px] font-semibold">Quick Setup Guides</h3>
            <div className="flex flex-wrap gap-3">
              {[
                { name: "Gmail", host: "smtp.gmail.com", port: 587, secure: "starttls", note: "Use App Password (enable 2FA first)" },
                { name: "SendGrid", host: "smtp.sendgrid.net", port: 587, secure: "starttls", note: "Username: apikey, Password: your API key" },
                { name: "Mailgun", host: "smtp.mailgun.org", port: 587, secure: "starttls", note: "Use domain credentials from Mailgun dashboard" },
                { name: "Outlook", host: "smtp-mail.outlook.com", port: 587, secure: "starttls", note: "Use your Outlook email and password" },
              ].map((p) => (
                <div key={p.name} className="flex-[1_1_180px] rounded-md bg-muted p-3.5 text-[12px] shadow-soft-xs transition-shadow hover:shadow-soft-sm">
                  <strong className="text-[13px] text-foreground">{p.name}</strong>
                  <p className="mt-1 leading-relaxed text-muted-foreground">
                    Host: <code>{p.host}</code><br />
                    Port: {p.port} ({p.secure})<br />
                    <em>{p.note}</em>
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSmtp({ ...smtp, smtp_host: p.host, smtp_port: p.port, smtp_secure: p.secure as any })}
                    className="mt-2 h-7 bg-card px-2.5 text-[11px] text-primary"
                  >
                    Use {p.name}
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ─── ACCOUNTS VIEW ─── */}
      {view === "accounts" && (
        <div className="space-y-6">
          {/* Create account form */}
          <Card className="gap-0 p-5">
            <h3 className="mb-3.5 flex items-center gap-2 text-[15px] font-semibold">
              <Plus size={15} strokeWidth={2} className="text-muted-foreground" /> Create Email Account
            </h3>
            <form onSubmit={createAccount} className="flex flex-wrap items-end gap-2.5">
              <div className="grid flex-[1_1_180px] gap-1.5">
                <Label htmlFor="acct-localpart" className="text-[12px]">Username</Label>
                <div className="flex items-stretch">
                  <Input
                    id="acct-localpart"
                    value={localPart}
                    onChange={(e) => setLocalPart(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""))}
                    placeholder="support"
                    className="rounded-e-none"
                  />
                  <span className="flex items-center whitespace-nowrap rounded-e-md bg-muted px-3 text-[13px] text-muted-foreground ring-1 ring-inset ring-border">
                    @{domain}
                  </span>
                </div>
              </div>
              <div className="grid flex-[1_1_150px] gap-1.5">
                <Label htmlFor="acct-displayname" className="text-[12px]">Display Name</Label>
                <Input id="acct-displayname" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="FitWay Support" />
              </div>
              <Button type="submit">
                <Plus size={14} strokeWidth={2} /> Create
              </Button>
            </form>
          </Card>

          {/* Accounts list */}
          <Card className="gap-0 p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-[15px] font-semibold">Email Accounts ({accounts.length})</h3>
              <Button variant="outline" size="sm" onClick={fetchAccounts}>
                <RefreshCw size={14} strokeWidth={2} /> Refresh
              </Button>
            </div>

            {loading && <p className="text-[13px] text-muted-foreground">Loading...</p>}
            {!loading && accounts.length === 0 && (
              <p className="py-6 text-center text-[13px] text-muted-foreground">
                No email accounts yet. Create one above.
              </p>
            )}

            <div className="flex flex-col gap-2">
              {accounts.map((a) => (
                <div key={a.id} className="flex flex-wrap items-center gap-3 rounded-md bg-muted px-3.5 py-3 shadow-soft-xs transition-shadow hover:shadow-soft-sm">
                  <div className="min-w-[160px] flex-1">
                    <p className="text-[14px] font-bold text-foreground">{a.email}</p>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">{a.display_name}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => openInbox(a)}
                      className="bg-card text-[var(--secondary)] ring-[color-mix(in_srgb,var(--secondary)_40%,transparent)] hover:bg-[color-mix(in_srgb,var(--secondary)_10%,transparent)] hover:text-[var(--secondary)]">
                      <Inbox size={13} strokeWidth={2} /> Inbox
                    </Button>
                    <Button size="sm" onClick={() => openSent(a)}
                      className="bg-[var(--secondary)] text-white hover:bg-[var(--secondary)]/90">
                      <Send size={13} strokeWidth={2} /> Sent
                    </Button>
                    <Button size="sm" onClick={() => openCompose(a)}>
                      <Send size={13} strokeWidth={2} /> Compose
                    </Button>
                    <Button size="icon-sm" variant="destructive" onClick={() => deleteAccount(a.id)} aria-label={`Delete ${a.email}`}>
                      <Trash2 size={13} strokeWidth={2} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* DNS info */}
          <Card className="gap-0 p-5">
            <h3 className="mb-2.5 text-[15px] font-semibold">DNS Setup Guide</h3>
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              To receive emails on <strong className="text-foreground">{domain}</strong>, add these DNS records at your domain registrar:
            </p>
            <div className="mt-2.5 overflow-x-auto rounded-md bg-muted">
              <table className="w-full border-collapse text-[12px]">
                <thead>
                  <tr>
                    {["Type", "Host", "Value", "Priority"].map((h) => (
                      <th key={h} className="px-3 py-2 text-start text-[11px] font-bold tracking-wide text-muted-foreground uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-3 py-2.5 align-middle text-foreground"><strong>MX</strong></td>
                    <td className="px-3 py-2.5 align-middle text-foreground">@</td>
                    <td className="px-3 py-2.5 align-middle font-mono text-[11px] text-foreground">{domain}</td>
                    <td className="px-3 py-2.5 align-middle text-foreground">10</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2.5 align-middle text-foreground"><strong>TXT</strong></td>
                    <td className="px-3 py-2.5 align-middle text-foreground">@</td>
                    <td className="px-3 py-2.5 align-middle font-mono text-[11px] break-all text-foreground">v=spf1 a mx ip4:YOUR_SERVER_IP ~all</td>
                    <td className="px-3 py-2.5 align-middle text-foreground">—</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              SMTP port: <strong>{2525}</strong> (configurable via <code>SMTP_PORT</code> env var).
              For production, set up a reverse proxy or use port 25.
            </p>
          </Card>
        </div>
      )}

      {/* ─── INBOX / SENT VIEW ─── */}
      {(view === "inbox" || view === "sent") && selectedAccount && (
        <Card className="gap-0 p-5">
          <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-[15px] font-semibold">
              {view === "inbox" ? <><Inbox size={15} strokeWidth={2} className="text-muted-foreground" />Inbox</> : <><Send size={15} strokeWidth={2} className="text-muted-foreground" />Sent</>}
              <span className="text-[12px] font-normal text-muted-foreground">{selectedAccount.email}</span>
            </h3>
            <div className="flex gap-1.5">
              <Button variant="outline" size="sm" onClick={() => view === "inbox" ? openSent(selectedAccount) : openInbox(selectedAccount)}>
                {view === "inbox" ? <><Send size={13} strokeWidth={2} /> Sent</> : <><Inbox size={13} strokeWidth={2} /> Inbox</>}
              </Button>
              <Button size="sm" onClick={() => openCompose(selectedAccount)}>
                <Send size={13} strokeWidth={2} /> Compose
              </Button>
              <Button variant="outline" size="icon-sm" onClick={() => fetchEmails(selectedAccount.id, view === "inbox" ? "inbound" : "outbound")} aria-label="Refresh emails">
                <RefreshCw size={13} strokeWidth={2} />
              </Button>
            </div>
          </div>

          {loading && <p className="text-[13px] text-muted-foreground">Loading...</p>}
          {!loading && emails.length === 0 && (
            <p className="py-6 text-center text-[13px] text-muted-foreground">
              No emails yet.
            </p>
          )}

          <div className="flex flex-col gap-1">
            {emails.map((em) => (
              <div
                key={em.id}
                onClick={() => openEmail(em)}
                className={`flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2.5 transition-all hover:bg-muted hover:shadow-soft-sm ${em.is_read ? "" : "bg-primary/10"}`}
              >
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-[13px] ${em.is_read ? "font-normal" : "font-bold"} text-foreground`}>
                    {em.subject || "(no subject)"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {view === "inbox" ? `From: ${em.sender}` : `To: ${em.recipient}`}
                  </p>
                </div>
                <span className="whitespace-nowrap text-[11px] text-muted-foreground">
                  {new Date(em.created_at).toLocaleString()}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={(e) => { e.stopPropagation(); deleteEmail(em.id); }}
                  aria-label="Delete email"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 size={13} strokeWidth={2} />
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ─── READ VIEW ─── */}
      {view === "read" && selectedEmail && (
        <Card className="gap-0 p-5">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="mb-1 text-[16px] font-semibold">
                {selectedEmail.subject || "(no subject)"}
              </h3>
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                <strong>From:</strong> {selectedEmail.sender}<br />
                <strong>To:</strong> {selectedEmail.recipient}<br />
                <strong>Date:</strong> {new Date(selectedEmail.created_at).toLocaleString()}
              </p>
            </div>
            <Button variant="destructive" size="sm" onClick={() => deleteEmail(selectedEmail.id)}>
              <Trash2 size={13} strokeWidth={2} /> Delete
            </Button>
          </div>
          <Separator className="my-3" />
          {selectedEmail.html_body ? (
            <div
              className="overflow-x-auto text-[14px] leading-relaxed text-foreground"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedEmail.html_body) }}
            />
          ) : (
            <pre className="m-0 font-sans text-[13px] leading-relaxed break-words whitespace-pre-wrap text-foreground">
              {selectedEmail.text_body || "(empty)"}
            </pre>
          )}
        </Card>
      )}

      {/* ─── COMPOSE VIEW ─── */}
      {view === "compose" && selectedAccount && (
        <Card className="gap-0 p-5">
          <h3 className="mb-3.5 flex items-center gap-2 text-[15px] font-semibold">
            <Send size={15} strokeWidth={2} className="text-muted-foreground" /> Compose — from {selectedAccount.email}
          </h3>
          <form onSubmit={handleSend} className="flex flex-col gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="compose-to" className="text-[12px]">To</Label>
              <Input id="compose-to" value={composeTo} onChange={(e) => setComposeTo(e.target.value)} placeholder="recipient@example.com" required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="compose-subject" className="text-[12px]">Subject</Label>
              <Input id="compose-subject" value={composeSubject} onChange={(e) => setComposeSubject(e.target.value)} placeholder="Subject" required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="compose-body" className="text-[12px]">Message</Label>
              <Textarea
                id="compose-body"
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
                placeholder="Type your message..."
                rows={8}
                className="min-h-[120px] resize-y"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={sending}>
                <Send size={14} strokeWidth={2} /> {sending ? "Sending..." : "Send Email"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setView("inbox")}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
