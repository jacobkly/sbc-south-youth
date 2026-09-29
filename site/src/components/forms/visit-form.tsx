"use client";

import { limits } from "@/lib/forms/schemas";
import { ChoiceTiles, PrivacyNote, ReachFields, studentBands, TextArea, TextField } from "./fields";
import { MessageForm } from "./message-form";

/** "I'm coming this week", so a leader can look out for them. Optional: anyone can just show up. */
export function VisitForm() {
  return (
    <MessageForm
      kind="visit"
      submitLabel="Let us know"
      finePrint={<PrivacyNote>We only use this to say hi.</PrivacyNote>}
      sent={{ as: "h3", next: { href: "/this-week", label: "See what's on" } }}
    >
      {(errors) => (
        <>
          <TextField label="Your name" name="name" autoComplete="name" maxLength={limits.name} error={errors.name} />
          <ChoiceTiles legend="I'm in…" name="gradeBand" choices={studentBands} error={errors.gradeBand} />
          <ReachFields errors={errors} />
          <TextArea
            label="Anything we should know?"
            optional
            name="message"
            rows={3}
            limit={limits.note}
            hint="Like if you're bringing a friend."
            error={errors.message}
          />
        </>
      )}
    </MessageForm>
  );
}
