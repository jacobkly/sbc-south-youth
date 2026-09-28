import type { Metadata } from "next";
import { PageIntro } from "@/components/site/page-intro";
import { Stub } from "@/components/site/stub";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <>
      <PageIntro eyebrow="Privacy" title="Your privacy.">
        What our forms collect, why, and how long we keep it.
      </PageIntro>
      <Stub note="The privacy details go here." />
    </>
  );
}
