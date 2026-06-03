import { Resend } from 'resend';

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM ?? 'Capta <onboarding@resend.dev>';

if (!apiKey) {
  console.error('RESEND_API_KEY não definida');
  process.exit(1);
}

const resend = new Resend(apiKey);

const result = await resend.emails.send({
  from,
  to: ['rafael@nerdrico.com.br'],
  subject: 'Capta — teste de alerta',
  html: `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #0F4C81; padding: 24px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 20px;">Capta</h1>
      </div>
      <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none;">
        <p>⏰ Este é um e-mail de teste do sistema de alertas.</p>
        <p>Se você recebeu isso, o Resend está configurado corretamente.</p>
        <a href="#" style="display: inline-block; background: #0F4C81; color: white;
           padding: 12px 24px; border-radius: 6px; text-decoration: none;">
          Ver edital
        </a>
      </div>
    </div>
  `,
});

console.log('Resultado:', JSON.stringify(result, null, 2));

if (result.error) {
  console.error('Erro:', result.error);
  process.exit(1);
}

console.log('✓ E-mail enviado com sucesso. messageId:', result.data?.id);
