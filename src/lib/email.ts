import nodemailer from 'nodemailer';

const ADMIN_EMAIL = 'billionaireomenda@gmail.com';

function createTransport() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) return null;

  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
}

export interface TicketEmailPayload {
  ticketId: string;
  subject: string;
  message: string;
  priority: 'low' | 'medium' | 'high';
  tag: string;
  senderName: string;
  senderEmail: string;
  slaDeadline: string;
}

const PRIORITY_COLOR: Record<string, string> = {
  high: '#EF4444',
  medium: '#F59E0B',
  low: '#10B981',
};

const PRIORITY_LABEL: Record<string, string> = {
  high: '🔴 HIGH — 1 h SLA',
  medium: '🟡 MEDIUM — 4 h SLA',
  low: '🟢 LOW — 24 h SLA',
};

export async function sendNewTicketNotification(payload: TicketEmailPayload): Promise<void> {
  const transport = createTransport();
  if (!transport) {
    console.warn('[email] SMTP_USER / SMTP_PASS not set — skipping email notification');
    return;
  }

  const priorityColor = PRIORITY_COLOR[payload.priority] ?? '#6B7280';
  const priorityLabel = PRIORITY_LABEL[payload.priority] ?? payload.priority;
  const deadline = new Date(payload.slaDeadline).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' });

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#0F172A;font-family:system-ui,sans-serif;color:#E2E8F0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0F172A;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#1E293B;border-radius:16px;overflow:hidden;max-width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:${priorityColor};padding:4px 24px;">
            <p style="margin:0;font-size:12px;font-weight:800;color:#fff;letter-spacing:2px;text-transform:uppercase;">
              ${priorityLabel}
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding:28px 32px 0;">
            <p style="margin:0 0 4px;font-size:20px;font-weight:900;color:#F8FAFC;">New Support Ticket</p>
            <p style="margin:0;font-size:13px;color:#94A3B8;">Talent Graph Kenya · Client Support</p>
          </td>
        </tr>

        <!-- Ticket details -->
        <tr>
          <td style="padding:24px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#0F172A;border-radius:12px;padding:20px;border:1px solid #334155;">
              <tr>
                <td style="padding-bottom:14px;">
                  <p style="margin:0 0 2px;font-size:10px;font-weight:700;color:#64748B;letter-spacing:1.5px;text-transform:uppercase;">Subject</p>
                  <p style="margin:0;font-size:16px;font-weight:800;color:#F8FAFC;">${escHtml(payload.subject)}</p>
                </td>
              </tr>
              <tr>
                <td style="padding-bottom:14px;border-top:1px solid #1E293B;padding-top:14px;">
                  <p style="margin:0 0 2px;font-size:10px;font-weight:700;color:#64748B;letter-spacing:1.5px;text-transform:uppercase;">Message</p>
                  <p style="margin:0;font-size:14px;line-height:1.6;color:#CBD5E1;">${escHtml(payload.message).replace(/\n/g, '<br/>')}</p>
                </td>
              </tr>
              <tr>
                <td style="border-top:1px solid #1E293B;padding-top:14px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td width="50%" style="padding-right:8px;">
                        <p style="margin:0 0 2px;font-size:10px;font-weight:700;color:#64748B;letter-spacing:1.5px;text-transform:uppercase;">From</p>
                        <p style="margin:0;font-size:13px;font-weight:700;color:#E2E8F0;">${escHtml(payload.senderName)}</p>
                        <p style="margin:2px 0 0;font-size:12px;color:#64748B;">${escHtml(payload.senderEmail)}</p>
                      </td>
                      <td width="50%" style="padding-left:8px;">
                        <p style="margin:0 0 2px;font-size:10px;font-weight:700;color:#64748B;letter-spacing:1.5px;text-transform:uppercase;">Category</p>
                        <p style="margin:0;font-size:13px;font-weight:700;color:#E2E8F0;text-transform:capitalize;">${escHtml(payload.tag)}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- SLA callout -->
        <tr>
          <td style="padding:0 32px 12px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:${priorityColor}18;border:1px solid ${priorityColor}44;border-radius:10px;padding:14px 18px;">
              <tr>
                <td>
                  <p style="margin:0 0 2px;font-size:10px;font-weight:800;color:${priorityColor};letter-spacing:1.5px;text-transform:uppercase;">SLA Deadline</p>
                  <p style="margin:0;font-size:14px;font-weight:700;color:#F8FAFC;">${deadline} (EAT)</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="padding:4px 32px 32px;">
            <a href="https://talent-graph.vercel.app/jobs/admin/dashboard" style="display:inline-block;background:#4F46E5;color:#fff;font-size:13px;font-weight:800;text-decoration:none;padding:12px 28px;border-radius:10px;letter-spacing:0.5px;">
              Open Admin Dashboard →
            </a>
            <p style="margin:14px 0 0;font-size:11px;color:#475569;">Ticket ID: ${payload.ticketId}</p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#0F172A;padding:16px 32px;border-top:1px solid #1E293B;">
            <p style="margin:0;font-size:11px;color:#475569;">Talent Graph Kenya · Automated notification · Do not reply to this email</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const subject = payload.priority === 'high'
    ? `🔴 URGENT support ticket: ${payload.subject}`
    : `New support ticket: ${payload.subject}`;

  await transport.sendMail({
    from: `"Talent Graph Support" <${process.env.SMTP_USER}>`,
    to: ADMIN_EMAIL,
    subject,
    html,
  });
}

export interface TicketResolvedEmailPayload {
  ticketId: string;
  subject: string;
  senderName: string;
  senderEmail: string;
  csatBaseUrl: string;
}

export async function sendTicketResolvedNotification(payload: TicketResolvedEmailPayload): Promise<void> {
  const transport = createTransport();
  if (!transport) {
    console.warn('[email] SMTP_USER / SMTP_PASS not set — skipping resolved notification');
    return;
  }

  const stars = [1, 2, 3, 4, 5];
  const starColors = ['#EF4444', '#F97316', '#EAB308', '#84CC16', '#22C55E'];
  const starLabels = ['Very bad', 'Bad', 'OK', 'Good', 'Excellent'];

  const starButtons = stars.map(n =>
    `<a href="${payload.csatBaseUrl}/api/support/csat?ticketId=${payload.ticketId}&rating=${n}"
        style="display:inline-block;width:44px;height:44px;line-height:44px;text-align:center;font-size:22px;text-decoration:none;border-radius:10px;background:${starColors[n - 1]}18;border:1.5px solid ${starColors[n - 1]}44;margin:0 4px;"
        title="${starLabels[n - 1]}">
      ${'⭐'.repeat(1)}${n}
    </a>`
  ).join('');

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#0F172A;font-family:system-ui,sans-serif;color:#E2E8F0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0F172A;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#1E293B;border-radius:16px;overflow:hidden;max-width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:#22C55E;padding:4px 24px;">
            <p style="margin:0;font-size:12px;font-weight:800;color:#fff;letter-spacing:2px;text-transform:uppercase;">✅ Ticket Resolved</p>
          </td>
        </tr>

        <tr>
          <td style="padding:28px 32px 0;">
            <p style="margin:0 0 4px;font-size:20px;font-weight:900;color:#F8FAFC;">Your issue has been resolved</p>
            <p style="margin:0;font-size:13px;color:#94A3B8;">Talent Graph Kenya · Client Support</p>
          </td>
        </tr>

        <!-- Ticket info -->
        <tr>
          <td style="padding:24px 32px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#0F172A;border-radius:12px;padding:20px;border:1px solid #334155;">
              <tr>
                <td>
                  <p style="margin:0 0 2px;font-size:10px;font-weight:700;color:#64748B;letter-spacing:1.5px;text-transform:uppercase;">Ticket</p>
                  <p style="margin:0;font-size:15px;font-weight:800;color:#F8FAFC;">${escHtml(payload.subject)}</p>
                  <p style="margin:6px 0 0;font-size:12px;color:#64748B;">Hi ${escHtml(payload.senderName)}, your support request has been marked as resolved by our team. If you still need help, you can open a new ticket from your dashboard.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- CSAT -->
        <tr>
          <td style="padding:24px 32px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#1E3A5F;border-radius:12px;padding:24px;border:1px solid #2563EB44;text-align:center;">
              <tr>
                <td>
                  <p style="margin:0 0 4px;font-size:13px;font-weight:800;color:#93C5FD;letter-spacing:1px;text-transform:uppercase;">How did we do?</p>
                  <p style="margin:0 0 16px;font-size:12px;color:#64748B;">Tap a number to rate your support experience</p>
                  <div style="white-space:nowrap;">
                    ${stars.map(n =>
                      `<a href="${payload.csatBaseUrl}/api/support/csat?ticketId=${payload.ticketId}&rating=${n}"
                          style="display:inline-block;width:46px;height:46px;line-height:46px;text-align:center;font-size:18px;font-weight:900;color:#fff;text-decoration:none;border-radius:10px;background:${starColors[n - 1]};margin:0 3px;"
                          title="${starLabels[n - 1]}">${n}</a>`
                    ).join('')}
                  </div>
                  <p style="margin:12px 0 0;font-size:10px;color:#475569;">1 = Very bad &nbsp;·&nbsp; 5 = Excellent</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:24px 32px;">
            <p style="margin:0;font-size:11px;color:#475569;">Ticket ID: ${payload.ticketId}</p>
          </td>
        </tr>
        <tr>
          <td style="background:#0F172A;padding:16px 32px;border-top:1px solid #1E293B;">
            <p style="margin:0;font-size:11px;color:#475569;">Talent Graph Kenya · Automated notification · Do not reply to this email</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await transport.sendMail({
    from: `"Talent Graph Support" <${process.env.SMTP_USER}>`,
    to: payload.senderEmail,
    subject: `✅ Resolved: ${payload.subject}`,
    html,
  });
}

export interface AgentReplyEmailPayload {
  ticketId: string;
  subject: string;
  replyBody: string;
  agentName: string;
  senderName: string;
  senderEmail: string;
}

export async function sendAgentReplyNotification(payload: AgentReplyEmailPayload): Promise<void> {
  const transport = createTransport();
  if (!transport) {
    console.warn('[email] SMTP_USER / SMTP_PASS not set — skipping reply notification');
    return;
  }

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#0F172A;font-family:system-ui,sans-serif;color:#E2E8F0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0F172A;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#1E293B;border-radius:16px;overflow:hidden;max-width:100%;">
        <tr>
          <td style="background:#4F46E5;padding:4px 24px;">
            <p style="margin:0;font-size:12px;font-weight:800;color:#fff;letter-spacing:2px;text-transform:uppercase;">Agent Reply</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px 0;">
            <p style="margin:0 0 4px;font-size:20px;font-weight:900;color:#F8FAFC;">Support Update</p>
            <p style="margin:0;font-size:13px;color:#94A3B8;">Talent Graph Kenya · Client Support</p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#0F172A;border-radius:12px;padding:20px;border:1px solid #334155;">
              <tr>
                <td style="padding-bottom:14px;">
                  <p style="margin:0 0 2px;font-size:10px;font-weight:700;color:#64748B;letter-spacing:1.5px;text-transform:uppercase;">Ticket</p>
                  <p style="margin:0;font-size:15px;font-weight:800;color:#F8FAFC;">${escHtml(payload.subject)}</p>
                </td>
              </tr>
              <tr>
                <td style="border-top:1px solid #1E293B;padding-top:14px;padding-bottom:14px;">
                  <p style="margin:0 0 2px;font-size:10px;font-weight:700;color:#64748B;letter-spacing:1.5px;text-transform:uppercase;">Reply from ${escHtml(payload.agentName)}</p>
                  <p style="margin:0;font-size:14px;line-height:1.6;color:#CBD5E1;">${escHtml(payload.replyBody).replace(/\n/g, '<br/>')}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 32px;">
            <p style="margin:0 0 4px;font-size:12px;color:#64748B;">Hi ${escHtml(payload.senderName)}, the support team has responded to your ticket.</p>
            <p style="margin:14px 0 0;font-size:11px;color:#475569;">Ticket ID: ${payload.ticketId}</p>
          </td>
        </tr>
        <tr>
          <td style="background:#0F172A;padding:16px 32px;border-top:1px solid #1E293B;">
            <p style="margin:0;font-size:11px;color:#475569;">Talent Graph Kenya · Automated notification · Do not reply to this email</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await transport.sendMail({
    from: `"Talent Graph Support" <${process.env.SMTP_USER}>`,
    to: payload.senderEmail,
    subject: `Re: ${payload.subject}`,
    html,
  });
}

export async function sendCampaignEmail(params: {
  to: string;
  firstName: string;
  role: string;
  subject: string;
  rawBody: string;
  campaignId: string;
  unsubscribeBaseUrl: string;
}): Promise<boolean> {
  const transport = createTransport();
  if (!transport) return false;

  try {
    const personalizedBody = params.rawBody
      .replace(/\{\{first_name\}\}/gi, escHtml(params.firstName))
      .replace(/\{\{role\}\}/gi, escHtml(params.role));

    const unsubscribeUrl = `${params.unsubscribeBaseUrl}/api/marketing/unsubscribe?email=${encodeURIComponent(params.to)}&campaign=${params.campaignId}`;
    const personalizedSubject = params.subject
      .replace(/\{\{first_name\}\}/gi, params.firstName)
      .replace(/\{\{role\}\}/gi, params.role);

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#0F172A;font-family:system-ui,-apple-system,sans-serif;color:#E2E8F0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0F172A;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#1E293B;border-radius:16px;overflow:hidden;max-width:100%;">

        <tr>
          <td style="background:#4F46E5;padding:12px 32px;">
            <p style="margin:0;font-size:13px;font-weight:900;color:#fff;letter-spacing:1px;">TALENT GRAPH KENYA</p>
          </td>
        </tr>

        <tr>
          <td style="padding:32px;">
            <div style="font-size:14px;line-height:1.7;color:#CBD5E1;white-space:pre-line;">${personalizedBody}</div>
          </td>
        </tr>

        <tr>
          <td style="background:#0F172A;padding:16px 32px;border-top:1px solid #1E293B;">
            <p style="margin:0;font-size:11px;color:#475569;">
              Talent Graph Kenya &nbsp;·&nbsp;
              <a href="${unsubscribeUrl}" style="color:#6366F1;text-decoration:underline;">Unsubscribe</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    await transport.sendMail({
      from: `"Talent Graph Kenya" <${process.env.SMTP_USER}>`,
      to: params.to,
      subject: personalizedSubject,
      html,
    });
    return true;
  } catch (err) {
    console.error('[email] Campaign send error:', err);
    return false;
  }
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
