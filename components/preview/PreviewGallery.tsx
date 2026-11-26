"use client";
import { MotionConfig } from "framer-motion";
import { ClaimFormScreen, ClosedScreen, ConfirmScreen, PhoneShell, RevealScreen, UnwrapScreen } from "@/components/phone/Screens";
import { codePrefix } from "@/lib/labels";
import type { PublicConfig, RevealPrize } from "@/lib/types";

function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <figure className="flex flex-col items-center gap-2">
      <figcaption className="text-[13px] font-semibold uppercase tracking-wider text-[#5B5A4E]">{title}</figcaption>
      <div className="h-[844px] w-[390px] overflow-y-auto overflow-x-hidden rounded-[36px] bg-black p-0 shadow-xl ring-8 ring-[#1B1A12] [&_.min-h-\[100dvh\]]:min-h-[844px]">
        {children}
      </div>
    </figure>
  );
}

export function PreviewGallery({ config, siteUrl }: { config: PublicConfig; siteUrl: string }) {
  const prizes: RevealPrize[] = config.prizes.map((p) => ({ id: p.id, label: p.label, isJackpot: p.isJackpot, offerType: p.offerType, value: p.value }));
  const regular = prizes.find((p) => !p.isJackpot) ?? prizes[0];
  const sampleCode = (p: RevealPrize) => `MORUS-${codePrefix(p)}-7F2K`;
  return (
    <MotionConfig reducedMotion="always">
      <div className="light-page min-h-screen px-6 py-8">
        <div className="mx-auto max-w-[1800px]">
          <h1 className="font-display text-3xl font-bold text-evergreen">Every screen and state</h1>
          <p className="mt-1 text-[15px] text-[#5B5A4E]">
            Uses your live event settings. Projector screen: <a className="underline" href="/screen" target="_blank">/screen</a> · QR points to {siteUrl}
          </p>
          <div className="mt-8 flex flex-wrap gap-8">
            <Frame title="Waiting">
              <PhoneShell soundOn onToggleSound={() => {}}>
                <UnwrapScreen config={config} status="waiting" remaining="10:00" />
              </PhoneShell>
            </Frame>
            <Frame title="Unwrap (live)">
              <PhoneShell soundOn onToggleSound={() => {}}>
                <UnwrapScreen config={config} status="live" remaining="06:12" onUnwrap={() => {}} />
              </PhoneShell>
            </Frame>
            <Frame title="Paused">
              <PhoneShell soundOn onToggleSound={() => {}}>
                <UnwrapScreen config={config} status="paused" remaining="04:30" />
              </PhoneShell>
            </Frame>
            {prizes.map((p) => (
              <Frame key={p.id} title={`Reveal · ${p.label}${p.isJackpot ? " (jackpot)" : ""}`}>
                <PhoneShell soundOn onToggleSound={() => {}}>
                  <RevealScreen config={config} prize={p} phase="revealed" remaining="05:48" onClaim={() => {}} />
                </PhoneShell>
              </Frame>
            ))}
            {regular && (
              <>
                <Frame title="Claim form">
                  <ClaimFormScreen config={config} prize={regular} />
                </Frame>
                <Frame title="Claim form · errors">
                  <ClaimFormScreen
                    config={config}
                    prize={regular}
                    initialValues={{ name: "Sam", email: "sam@", company: "", phone: "780", consent: false }}
                    initialErrors={{
                      email: "Please enter a valid email address.",
                      company: "Please enter your brokerage or company.",
                      phone: "Please enter a mobile number, e.g. (780) 555-0123.",
                      consent: "Please tick the box so we can send your gift.",
                    }}
                  />
                </Frame>
                <Frame title="Confirmation">
                  <ConfirmScreen config={config} code={sampleCode(regular)} prize={regular} />
                </Frame>
              </>
            )}
            <Frame title="Closed">
              <PhoneShell>
                <ClosedScreen config={config} variant="closed" />
              </PhoneShell>
            </Frame>
            <Frame title="All gifts claimed">
              <PhoneShell>
                <ClosedScreen config={config} variant="all_claimed" />
              </PhoneShell>
            </Frame>
          </div>
        </div>
      </div>
    </MotionConfig>
  );
}
