/**
 * Recebe POST do form de briefing e dispara email via Resend.
 *
 * Env vars necessarias (configurar no dashboard da Vercel):
 *   RESEND_API_KEY  — chave da API do Resend (resend.com/api-keys)
 *   TO_EMAIL        — destinatario do briefing (ex: joelsoares807@gmail.com)
 *   FROM_EMAIL      — (opcional) remetente; default = "Briefing <onboarding@resend.dev>"
 */

const FIELD_LABELS = {
  '01_Nome':                 'Nome',
  '02_Email':                'E-mail',
  '03_WhatsApp':             'WhatsApp',
  '04_Nome_do_Negocio':      'Nome do negócio',
  '05_Setor':                'Setor',
  '06_Site_Atual':           'Site atual',
  '07_Objetivo_Principal':   'Objetivo principal',
  '08_Objetivo_Detalhado':   'Objetivo detalhado',
  '09_Publico_Alvo':         'Público-alvo',
  '10_Mensagem_Principal':   'Mensagem principal',
  '11_Sensacoes':            'Sensações',
  '12_Sensacao_Detalhada':   'Sensação detalhada',
  '13_Paleta_Status':        'Paleta de cores (status)',
  '14_Cores':                'Cores',
  '15_Cores_Detalhe':        'Cores (detalhe)',
  '16_Logo':                 'Logo',
  '17_O_Que_Mostrar':        'O que mostrar / vender',
  '18_Fotos':                'Fotos / material visual',
  '19_Depoimentos':          'Depoimentos',
  '20_CTA':                  'CTA principal',
  '21_CTA_Texto':            'Texto do CTA',
  '22_Referencias_Gosto':    'Referências (gosta)',
  '23_Referencias_Motivo':   'Referências (motivo)',
  '24_Referencias_Evitar':   'Referências a evitar',
  '25_Observacoes':          'Observações',
  '26_Aceite_Termos':        'Aceite dos termos',
};

const REQUIRED_FIELDS = [
  '01_Nome', '02_Email', '03_WhatsApp', '04_Nome_do_Negocio',
  '07_Objetivo_Principal', '09_Publico_Alvo', '10_Mensagem_Principal',
  '13_Paleta_Status', '16_Logo', '17_O_Que_Mostrar', '20_CTA',
  '26_Aceite_Termos',
];

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatValue(v) {
  if (v == null || v === '') return '<em style="color:#94a3b8">(não preenchido)</em>';
  if (Array.isArray(v)) return v.map(escapeHtml).join(', ');
  return escapeHtml(v).replace(/\n/g, '<br>');
}

function buildEmailHtml(data) {
  const rows = Object.entries(FIELD_LABELS)
    .map(([key, label]) => `
      <tr>
        <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;background:#f8fafc;font-weight:600;width:35%;vertical-align:top;color:#0f172a">${label}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;color:#1e293b;vertical-align:top">${formatValue(data[key])}</td>
      </tr>`)
    .join('');

  const businessName = escapeHtml(data['04_Nome_do_Negocio'] || 'sem nome');

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a">
  <div style="max-width:640px;margin:0 auto;padding:24px 16px">
    <div style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
      <div style="background:linear-gradient(135deg,#6366f1,#4f46e5);padding:24px 28px;color:#fff">
        <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;opacity:.85;font-weight:600">Novo briefing recebido</div>
        <div style="font-size:22px;font-weight:700;margin-top:6px">${businessName}</div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:14px;line-height:1.5">
        ${rows}
      </table>
      <div style="padding:16px 24px;background:#f8fafc;color:#64748b;font-size:12px;text-align:center">
        Enviado em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} (BRT) · Rocket Lab Hub
      </div>
    </div>
  </div>
</body></html>`;
}

function buildEmailText(data) {
  return Object.entries(FIELD_LABELS)
    .map(([key, label]) => {
      const v = data[key];
      const value = Array.isArray(v) ? v.join(', ') : (v ?? '(não preenchido)');
      return `${label}:\n  ${value}\n`;
    })
    .join('\n');
}

export default async function handler(req, res) {
  // CORS / método
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  let data = req.body;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch { data = {}; }
  }
  if (!data || typeof data !== 'object') {
    return res.status(400).json({ error: 'Payload inválido' });
  }

  // Honeypot anti-spam: campo invisivel preenchido = bot
  if (data._honey) {
    return res.status(200).json({ ok: true }); // finge sucesso, ignora
  }

  // Validacao basica
  for (const field of REQUIRED_FIELDS) {
    const v = data[field];
    if (!v || (typeof v === 'string' && !v.trim())) {
      return res.status(400).json({ error: `Campo obrigatório ausente: ${FIELD_LABELS[field] || field}` });
    }
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data['02_Email']).trim())) {
    return res.status(400).json({ error: 'E-mail inválido' });
  }

  // Limita tamanho de strings (anti-abuso)
  const MAX_LEN = 4000;
  for (const key of Object.keys(data)) {
    if (typeof data[key] === 'string' && data[key].length > MAX_LEN) {
      data[key] = data[key].slice(0, MAX_LEN);
    }
  }

  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.TO_EMAIL;
  const fromEmail = process.env.FROM_EMAIL || 'Briefing <onboarding@resend.dev>';

  if (!apiKey || !toEmail) {
    console.error('[submit] env vars ausentes:', { hasKey: !!apiKey, hasTo: !!toEmail });
    return res.status(500).json({ error: 'Servidor não configurado' });
  }

  try {
    const resendResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        reply_to: data['02_Email'],
        subject: `Novo briefing: ${data['04_Nome_do_Negocio']}`,
        html: buildEmailHtml(data),
        text: buildEmailText(data),
      }),
    });

    if (!resendResp.ok) {
      const errBody = await resendResp.text();
      console.error('[submit] Resend error:', resendResp.status, errBody);
      return res.status(502).json({ error: 'Falha ao enviar e-mail' });
    }

    const { id } = await resendResp.json();
    return res.status(200).json({ ok: true, id });
  } catch (err) {
    console.error('[submit] exception:', err);
    return res.status(500).json({ error: 'Erro interno' });
  }
}
