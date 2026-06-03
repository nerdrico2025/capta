import { formatValue, formatDate } from '../../lib/format.js';

export interface AlertTemplateData {
  recipientName: string;
  daysLeft: number;
  opportunity: {
    title: string;
    source: string;
    value: number | null;
    deadline: string;
    portalUrl: string;
    areas: string[];
  };
  unsubscribeUrl: string;
  webUrl: string;
}

export function renderAlertTemplate(data: AlertTemplateData): { subject: string; html: string } {
  const { recipientName, daysLeft, opportunity: opp, unsubscribeUrl, webUrl } = data;

  const dayLabel = daysLeft === 1 ? '1 dia' : `${daysLeft} dias`;
  const urgencyColor = daysLeft <= 1 ? '#DC2626' : daysLeft <= 7 ? '#D97706' : '#059669';
  const areaChips = opp.areas
    .slice(0, 4)
    .map(
      (a) =>
        `<span style="display:inline-block;background:#EBF4FF;color:#0F4C81;border-radius:100px;padding:2px 10px;font-size:12px;margin:2px 2px 0 0;text-transform:capitalize;">${a}</span>`,
    )
    .join('');

  const subject = `⏰ Prazo em ${dayLabel}: ${opp.title.slice(0, 60)}${opp.title.length > 60 ? '...' : ''}`;

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#F5F5F0;font-family:Arial,Helvetica,sans-serif;">

  <!-- Preheader (hidden preview text) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
    O edital "${opp.title}" encerra em ${dayLabel}. Não perca o prazo!
    &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table width="100%" style="max-width:600px;" cellpadding="0" cellspacing="0" role="presentation">

          <!-- Header -->
          <tr>
            <td style="background:#0F4C81;border-radius:16px 16px 0 0;padding:28px 32px;text-align:center;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td>
                    <div style="display:inline-flex;align-items:center;gap:8px;">
                      <div style="background:rgba(255,255,255,0.15);border-radius:8px;width:32px;height:32px;display:inline-block;text-align:center;line-height:32px;font-size:16px;">✓</div>
                      <span style="color:#FFFFFF;font-size:22px;font-weight:700;letter-spacing:-0.5px;">Capta</span>
                    </div>
                    <p style="margin:12px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">
                      Recursos Públicos para Organizações
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Urgency banner -->
          <tr>
            <td style="background:${urgencyColor};padding:14px 32px;text-align:center;">
              <span style="color:#FFFFFF;font-size:18px;font-weight:700;">
                ⏰ Prazo em ${dayLabel}
              </span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#FFFFFF;padding:32px;">

              <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6;">
                Olá${recipientName ? `, <strong>${recipientName}</strong>` : ''}!<br>
                Uma oportunidade compatível com o perfil da sua organização está prestes a encerrar.
              </p>

              <!-- Opportunity card -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px;overflow:hidden;">
                <tr>
                  <td style="padding:20px 24px;">

                    <!-- Source badge -->
                    <p style="margin:0 0 8px;">
                      <span style="background:#EBF4FF;color:#0F4C81;border-radius:100px;padding:3px 10px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">
                        ${opp.source}
                      </span>
                    </p>

                    <!-- Title -->
                    <h2 style="margin:0 0 12px;color:#111827;font-size:17px;font-weight:700;line-height:1.4;">
                      ${escapeHtml(opp.title)}
                    </h2>

                    <!-- Meta row -->
                    <table cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:12px;">
                      <tr>
                        <td style="padding-right:24px;">
                          <p style="margin:0;color:#6B7280;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Prazo</p>
                          <p style="margin:2px 0 0;color:${urgencyColor};font-size:14px;font-weight:700;">${formatDate(opp.deadline)}</p>
                        </td>
                        <td>
                          <p style="margin:0;color:#6B7280;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Valor estimado</p>
                          <p style="margin:2px 0 0;color:#0F4C81;font-size:14px;font-weight:700;">${formatValue(opp.value)}</p>
                        </td>
                      </tr>
                    </table>

                    <!-- Areas -->
                    ${areaChips ? `<div style="margin-bottom:16px;">${areaChips}</div>` : ''}

                    <!-- CTA -->
                    <a href="${opp.portalUrl}"
                      style="display:inline-block;background:#0F4C81;color:#FFFFFF;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;">
                      Acessar o edital →
                    </a>

                  </td>
                </tr>
              </table>

              <!-- Additional CTA -->
              <p style="margin:24px 0 0;text-align:center;">
                <a href="${webUrl}"
                  style="color:#0F4C81;font-size:13px;text-decoration:none;">
                  Ver todas as oportunidades no Capta
                </a>
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#F9FAFB;border-radius:0 0 16px 16px;padding:20px 32px;text-align:center;border-top:1px solid #E5E7EB;">
              <p style="margin:0 0 8px;color:#9CA3AF;font-size:12px;line-height:1.5;">
                Você está recebendo este e-mail porque se inscreveu para alertas de prazo no Capta.<br>
                Para cancelar as notificações:
              </p>
              <a href="${unsubscribeUrl}"
                style="color:#6B7280;font-size:12px;text-decoration:underline;">
                Cancelar alertas
              </a>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;

  return { subject, html };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
