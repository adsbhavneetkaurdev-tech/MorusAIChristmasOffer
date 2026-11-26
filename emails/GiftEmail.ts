/**
 * Gift email: table-based HTML with inline CSS (Gmail / Outlook safe) + plain text.
 */
export interface GiftEmailProps {
  name: string;
  prizeLabel: string; // "3 Months FREE"
  offerSubject: string; // "Website + AI Agent"
  code: string;
  bookingUrl: string;
  contactEmail: string;
  hostName: string;
  siteUrl: string;
  unsubscribeUrl: string;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** "Website + AI Agent" -> "Website + Morus AI Agent" for the coupon line. */
function couponSubject(subject: string) {
  return subject.replace(/(^|\s)AI Agent/, "$1Morus AI Agent");
}

export function giftEmailSubject(hostName: string) {
  return `🎁 Your Christmas gift from ${hostName} & Morus AI`;
}

export function renderGiftEmail(p: GiftEmailProps): { html: string; text: string } {
  const first = p.name.trim().split(/\s+/)[0] || "there";
  const logo = `${p.siteUrl}/morus-logo.png`;
  const gift = `${p.siteUrl}/email-gift.png`;
  const F = "font-family:Georgia,'Times New Roman',serif;";
  const S = "font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;";

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><title>Your Christmas gift</title></head>
<body style="margin:0;padding:0;background:#F4EFE3;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your gift code ${esc(p.code)} is inside: ${esc(p.prizeLabel)} of ${esc(p.offerSubject)}.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4EFE3;">
<tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#FBF6EC;border-radius:16px;overflow:hidden;">
    <tr><td align="center" bgcolor="#0F3D2E" style="background:#0F3D2E;padding:28px 24px 32px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#FBF6EC" style="background:#FBF6EC;border-radius:10px;padding:8px 14px;">
        <img src="${logo}" alt="Morus AI by Le Techie" height="32" style="display:block;height:32px;width:auto;border:0;">
      </td></tr></table>
      <img src="${gift}" alt="" width="88" height="88" style="display:block;margin:22px auto 10px;width:88px;height:88px;border:0;">
      <h1 style="${F}margin:0;color:#FBF6EC;font-size:30px;line-height:1.2;font-weight:700;">Merry Christmas, ${esc(first)}!</h1>
    </td></tr>
    <tr><td style="${S}padding:28px 32px 8px;color:#1B1A12;font-size:16px;line-height:1.6;">
      Thanks for celebrating with ${esc(p.hostName)} tonight. Here's the gift you unwrapped:
    </td></tr>
    <tr><td style="padding:12px 32px 8px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:2px dashed #D4A84B;border-radius:14px;background:#FFFDF7;">
        <tr><td align="center" style="padding:22px 16px;">
          <div style="${F}font-size:30px;line-height:1.15;font-weight:700;color:#0F3D2E;">${esc(p.prizeLabel)}</div>
          <div style="${S}font-size:15px;color:#3F6E5C;margin-top:6px;">${esc(couponSubject(p.offerSubject))}</div>
          <div style="${S}font-size:11px;letter-spacing:2px;color:#8A6A22;margin-top:18px;font-weight:700;">YOUR GIFT CODE</div>
          <div style="font-family:'Courier New',Courier,monospace;font-size:26px;letter-spacing:2px;font-weight:700;color:#1B1A12;margin-top:4px;">${esc(p.code)}</div>
        </td></tr>
      </table>
    </td></tr>
    <tr><td style="${S}padding:20px 32px 8px;color:#1B1A12;font-size:16px;line-height:1.6;">
      To activate your gift, book a quick setup call with our team. We'll build your website and set up your AI Agent to answer and follow up with your leads 24/7.
    </td></tr>
    <tr><td align="center" style="padding:16px 32px 8px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td align="center" bgcolor="#B3202E" style="border-radius:14px;background:#B3202E;">
          <a href="${esc(p.bookingUrl)}" target="_blank" style="${S}display:inline-block;padding:16px 32px;font-size:17px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:14px;">Book my setup call</a>
        </td></tr></table>
    </td></tr>
    <tr><td style="${S}padding:16px 32px 4px;color:#1B1A12;font-size:15px;line-height:1.6;">
      Prefer email? Reply to this message or write to <a href="mailto:${esc(p.contactEmail)}" style="color:#B3202E;">${esc(p.contactEmail)}</a> with your code.
    </td></tr>
    <tr><td style="${S}padding:12px 32px 28px;color:#1B1A12;font-size:15px;line-height:1.6;">
      Warm wishes,<br><strong>The Morus AI team</strong>
    </td></tr>
    <tr><td style="${S}padding:18px 32px 24px;background:#F4EFE3;color:#5B5A4E;font-size:12px;line-height:1.6;" bgcolor="#F4EFE3">
      You're receiving this because you claimed a gift at the ${esc(p.hostName)} Christmas party and agreed to hear from us.
      <a href="${esc(p.unsubscribeUrl)}" style="color:#5B5A4E;text-decoration:underline;">Unsubscribe</a>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;

  const text = `Merry Christmas, ${first}!

Thanks for celebrating with ${p.hostName} tonight. Here's the gift you unwrapped:

  ${p.prizeLabel}
  ${couponSubject(p.offerSubject)}
  YOUR GIFT CODE: ${p.code}

To activate your gift, book a quick setup call with our team. We'll build your website and set up your AI Agent to answer and follow up with your leads 24/7.

Book my setup call: ${p.bookingUrl}

Prefer email? Reply to this message or write to ${p.contactEmail} with your code.

Warm wishes,
The Morus AI team

--
You're receiving this because you claimed a gift at the ${p.hostName} Christmas party and agreed to hear from us.
Unsubscribe: ${p.unsubscribeUrl}
`;
  return { html, text };
}
