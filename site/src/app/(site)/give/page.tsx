import type { Metadata } from "next";
import { PageIntro } from "@/components/site/page-intro";
import { Stub } from "@/components/site/stub";

export const metadata: Metadata = { title: "Give" };

export default function GivePage() {
  return (
    <>
      <PageIntro eyebrow="Give" title="Fuel the mission.">
        Your gift helps fund camps, trips, and youth nights.
      </PageIntro>
      <Stub note="Cash App giving and the FAQ go here." />
    </>
  );
}
