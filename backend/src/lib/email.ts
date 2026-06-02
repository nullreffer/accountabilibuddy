import sendgrid from '@sendgrid/mail';

let initialized = false;

const init = () => {
  if (initialized) return;
  const key = process.env.SENDGRID_API_KEY;
  if (!key) {
    console.warn('SENDGRID_API_KEY not configured – email disabled');
    return;
  }
  sendgrid.setApiKey(key);
  initialized = true;
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
  init();
  if (!initialized) {
    console.warn('Email not sent – SendGrid not configured');
    return;
  }

  await sendgrid.send({
    to,
    from: { email: 'noreply@accountabilibuddy.app', name: 'Accountabilibuddy' },
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
