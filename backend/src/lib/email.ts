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
