import { Resend } from "resend";
import { giftEmailSubject, renderGiftEmail } from "@/emails/GiftEmail";
import type { Claim, Config } from "./types";

export interface SendResult {
  status: "sent" | "failed" | "logged";
  error?: string;
}

/**
 * The single place emails are sent. Uses Resend when RESEND_API_KEY is set;
 * otherwise prints the rendered email to the server console.
 */
export async function sendGiftEmail(claim: Claim, config: Config, siteUrl: string): Promise<SendResult> {
  const unsubscribeUrl = `${siteUrl}/unsubscribe?code=${encodeURIComponent(claim.code)}`;
  const { html, text } = renderGiftEmail({
    name: claim.name,
    prizeLabel: claim.prizeLabel,
    offerSubject: config.offerSubject,
    code: claim.code,
    bookingUrl: config.bookingUrl,
    contactEmail: config.contactEmail,
    hostName: config.hostName,
    siteUrl,
    unsubscribeUrl,
  });
  const subject = giftEmailSubject(config.hostName);
  const from = process.env.EMAIL_FROM || "Morus AI <info@morusai.com>";

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(
      `\n===== [gift-drop] EMAIL (not sent: RESEND_API_KEY missing) =====\nFrom: ${from}\nTo: ${claim.email}\nSubject: ${subject}\n\n${text}\n===== end email =====\n`,
    );
    return { status: "logged" };
  }
  try {
    const resend = new Resend(key);
    const { error } = await resend.emails.send({
      from,
      to: claim.email,
      replyTo: config.contactEmail,
      subject,
      html,
      text,
      headers: {
        "List-Unsubscribe": `<${siteUrl}/api/unsubscribe?code=${encodeURIComponent(claim.code)}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });
    if (error) return { status: "failed", error: error.message };
    return { status: "sent" };
  } catch (e) {
    return { status: "failed", error: e instanceof Error ? e.message : String(e) };
  }
}
