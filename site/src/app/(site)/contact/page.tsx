import type { Metadata } from "next";
import { PageIntro } from "@/components/site/page-intro";
import { Stub } from "@/components/site/stub";

export const metadata: Metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <>
      <PageIntro eyebrow="Contact" title="Say hi.">
        Questions about youth nights, events, or anything else? Send us a message.
      </PageIntro>
      <Stub note="The contact form goes here." />
    </>
  );
}
