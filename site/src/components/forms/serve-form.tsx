"use client";

import { serveAreas } from "@/content/serve-areas";
import { limits } from "@/lib/forms/schemas";
import { ChoiceCards, PrivacyNote, ReachFields, TextArea, TextField } from "./fields";
import { MessageForm } from "./message-form";

// What each area is sits beside the form, so the choices stay short.
const areas = serveAreas.map((area) => ({ value: area.id, label: area.title }));

/** Pick the areas to try. A leader follows up. */
export function ServeForm() {
  return (
    <MessageForm
      kind="serve"
      submitLabel="Count me in"
      finePrint={<PrivacyNote>We only use this to follow up.</PrivacyNote>}
      sent={{ as: "h3", againLabel: "Sign up someone else", next: { href: "/leaders", label: "Meet the leaders" } }}
    >
      {(errors) => (
        <>
          <TextField label="Your name" name="name" autoComplete="name" maxLength={limits.name} error={errors.name} />
          <ChoiceCards
            type="checkbox"
            legend="Where would you like to help?"
            hint="Pick as many as you like."
            name="areas"
            choices={areas}
            error={errors.areas}
          />
          <ReachFields errors={errors} legend="How can a leader reach you?" />
          <TextArea
            label="Anything else?"
            optional
            name="message"
            rows={3}
            limit={limits.note}
            hint="Like what you've done before, or a question."
            error={errors.message}
          />
        </>
      )}
    </MessageForm>
  );
}
