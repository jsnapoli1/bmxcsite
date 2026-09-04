/**
 * The double opt-in confirmation email.
 *
 * This is the only message this application sends, and it is
 * transactional: the recipient asked for it seconds earlier, on a form
 * they filled in themselves. That is what makes Cloudflare Email Service
 * the right tool for it — announcements to the confirmed list are not
 * sendable from here at all. See worker/email/subscribers.js.
 *
 * Sending is enabled on the apex bmxc.camp (not a subdomain), so `from`
 * must be on that domain or the send is refused as E_SENDER_NOT_VERIFIED.
 */

/** The mailbox confirmations come from. Must be on the onboarded domain. */
const FROM = { email: 'camp@bmxc.camp', name: 'Blue Mountain XC Camp' };

/**
 * Escapes text for inclusion in HTML.
 *
 * The address reaches this from an unauthenticated public endpoint, so it
 * is attacker-controlled up to the point our own validation allows. It is
 * never interpolated raw, even though it also appears in an email client
 * rather than a browser — several clients render HTML, and the cost of
 * escaping is nothing.
 */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Builds the confirmation message for `to`, carrying `token`.
 *
 * Returns the object `env.EMAIL.send()` takes, rather than sending it, so
 * the shape can be asserted in a test without a binding.
 */
export function confirmationEmail({ to, token, origin }) {
  const confirmUrl = `${origin}/api/subscribe/confirm?token=${encodeURIComponent(token)}`;
  const unsubscribeUrl = `${origin}/api/unsubscribe?token=${encodeURIComponent(token)}`;

  const text = [
    'Confirm your email',
    '',
    'Someone — we hope you — asked for news from Blue Mountain Cross',
    'Country Camp. Open this link and you are on the list:',
    '',
    confirmUrl,
    '',
    'If that was not you, ignore this email. You will not hear from us',
    'again unless you confirm.',
    '',
    `To stop hearing from us at any time: ${unsubscribeUrl}`,
  ].join('\n');

  // Deliberately plain: a table-based, image-heavy template is what spam
  // filters weight against, and this message has one job.
  const html = `<!doctype html>
<html lang="en">
  <body style="font-family: Georgia, 'Times New Roman', serif; color: #1c1a17; line-height: 1.5;">
    <h1 style="font-size: 20px; margin: 0 0 16px;">Confirm your email</h1>
    <p>
      Someone &mdash; we hope you &mdash; asked for news from Blue Mountain
      Cross Country Camp. Open this link and you are on the list:
    </p>
    <p><a href="${escapeHtml(confirmUrl)}">${escapeHtml(confirmUrl)}</a></p>
    <p>
      If that was not you, ignore this email. You will not hear from us
      again unless you confirm.
    </p>
    <hr style="border: none; border-top: 1px solid #ddd6c9; margin: 24px 0;" />
    <p style="font-size: 13px; color: #7d766a;">
      Sent to ${escapeHtml(to)}.
      <a href="${escapeHtml(unsubscribeUrl)}">Stop hearing from us</a>.
    </p>
  </body>
</html>`;

  return {
    to,
    from: FROM,
    subject: 'Confirm your email — Blue Mountain XC Camp',
    text,
    html,
    headers: {
      // One-click unsubscribe. Gmail and Yahoo expect this on list mail,
      // and it is the difference between someone unsubscribing and
      // someone reporting spam — which costs the whole domain.
      'List-Unsubscribe': `<${unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  };
}
