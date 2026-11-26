import type { Metadata } from "next";
import { LogoLabel } from "@/components/LogoLabel";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Unsubscribe · Morus AI", robots: { index: false } };

function mask(email: string) {
  const [u, d] = email.split("@");
  return `${u.slice(0, 2)}${"•".repeat(Math.max(1, u.length - 2))}@${d}`;
}

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ code?: string; done?: string }> }) {
  const { code = "", done } = await searchParams;
  const claim = code ? await getStore().getClaimByCode(code.trim().toUpperCase()) : null;
  const unsubscribed = done === "1" || claim?.unsubscribed;

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-parchment px-5 text-ink">
      <div className="w-full max-w-md rounded-2xl bg-white p-7 text-center shadow-sm ring-1 ring-black/5">
        <div className="flex justify-center rounded-xl bg-evergreen py-5">
          <LogoLabel height={26} />
        </div>
        {!claim ? (
          <>
            <h1 className="mt-6 font-display text-2xl font-bold text-evergreen">Link not recognised</h1>
            <p className="mt-2 text-[15px] text-[#3B3A30]">
              We couldn&apos;t find that gift code. Email <a className="underline" href="mailto:info@morusai.com">info@morusai.com</a> and we&apos;ll remove you right away.
            </p>
          </>
        ) : unsubscribed ? (
          <>
            <h1 className="mt-6 font-display text-2xl font-bold text-evergreen">You&apos;re unsubscribed</h1>
            <p className="mt-2 text-[15px] text-[#3B3A30]">
              We won&apos;t send {mask(claim.email)} any more offers. Your gift code {claim.code} still works.
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-6 font-display text-2xl font-bold text-evergreen">Unsubscribe?</h1>
            <p className="mt-2 text-[15px] text-[#3B3A30]">
              Stop Morus AI and the event host from contacting {mask(claim.email)} about related offers. Your gift code stays valid.
            </p>
            <form method="post" action="/api/unsubscribe" className="mt-6">
              <input type="hidden" name="code" value={claim.code} />
              <button type="submit" className="btn-cranberry w-full text-base">Unsubscribe me</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
