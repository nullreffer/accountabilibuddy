import FormData from 'form-data';
import Mailgun from 'mailgun.js';

const mailgun = new Mailgun(FormData);

const getClient = () => {
  const key = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;
  if (!key || !domain) {
    console.warn('MAILGUN_API_KEY or MAILGUN_DOMAIN not configured – email disabled');
    return null;
  }
  return { mg: mailgun.client({ username: 'api', key }), domain };
};

export const sendVerificationEmail = async ({
  to,
  code,
  name
}: {
  to: string;
  code: string;
  name: string;
}) => {
  const client = getClient();
  if (!client) {
    console.log(`[DEV] Verification code for ${to}: ${code}`);
    return;
  }

  await client.mg.messages.create(client.domain, {
    from: 'Accountabilibuddy <noreply@accountabilibuddy.app>',
    to,
    subject: 'Verify your Accountabilibuddy email',
    text: `Hi ${name},\n\nYour verification code is: ${code}\n\nThis code expires in 15 minutes.`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;max-width:480px;margin:0 auto;padding:1.5rem;">
        <h2 style="color:#4f46e5;">Verify your email</h2>
        <p>Hi <strong>${name}</strong>,</p>
        <p>Enter this code in the app to verify your email address:</p>
        <div style="font-size:2.5rem;font-weight:800;letter-spacing:0.25em;color:#4f46e5;text-align:center;padding:1.5rem;background:#eef2ff;border-radius:12px;margin:1.5rem 0;">
          ${code}
        </div>
        <p style="color:#6b7280;font-size:0.9rem;">This code expires in 15 minutes. If you didn't sign up for Accountabilibuddy, you can ignore this email.</p>
      </div>
    `
  });
};

export const sendInviteEmail = async ({
  to,
  groupName,
  inviteUrl,
  inviterName
}: {
  to: string;
  groupName: string;
  inviteUrl: string;
  inviterName: string;
}) => {
  const client = getClient();
  if (!client) {
    console.warn('Email not sent – Mailgun not configured');
    return;
  }

  await client.mg.messages.create(client.domain, {
    from: 'Accountabilibuddy <noreply@accountabilibuddy.app>',
    to,
    subject: `${inviterName} invited you to join ${groupName}`,
    text: `${inviterName} invited you to join ${groupName}. Join here: ${inviteUrl}`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;">
        <h2>You're invited to Accountabilibuddy</h2>
        <p><strong>${inviterName}</strong> invited you to join <strong>${groupName}</strong>.</p>
        <p>
          <a href="${inviteUrl}"
             style="display:inline-block;padding:12px 18px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:999px;">
            Join the group
          </a>
        </p>
        <p>If the button doesn't work, copy this link: ${inviteUrl}</p>
      </div>
    `
  });
};
