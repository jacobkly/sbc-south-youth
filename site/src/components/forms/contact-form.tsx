"use client";

import { useSyncExternalStore } from "react";
import { contactTopics } from "@/content/forms";
import { limits } from "@/lib/forms/schemas";
import { ChoiceTiles, PrivacyNote, TextArea, TextField } from "./fields";
import { MessageForm } from "./message-form";

const roles = [
  { value: "hs", label: "High school student" },
  { value: "college", label: "College student" },
  { value: "parent", label: "Parent or guardian" },
  { value: "other", label: "Someone else" },
] as const;

const noSubscribe = () => () => {};

/**
 * The `?topic=` a link sent someone with, read in the browser so the page
 * itself can stay static. It's null in the server's HTML.
 */
function useTopic() {
  const id = useSyncExternalStore(
    noSubscribe,
    () => new URLSearchParams(window.location.search).get("topic"),
    () => null,
  );
  return id && Object.hasOwn(contactTopics, id) ? contactTopics[id] : null;
}

export function ContactForm() {
  const topic = useTopic();

  return (
    <MessageForm
      kind="contact"
      submitLabel="Send message"
      finePrint={<PrivacyNote>We only use this to write back.</PrivacyNote>}
      sent={{ againLabel: "Send another message", next: { href: "/this-week", label: "See what's on" } }}
    >
      {(errors) => (
        <>
          <TextField
            label="Your name"
            name="name"
            autoComplete="name"
            maxLength={limits.name}
            error={errors.name}
          />
          <div className="grid gap-7 sm:grid-cols-2 sm:gap-4">
            <TextField
              label="Email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="off"
              spellCheck={false}
              maxLength={limits.email}
              error={errors.email}
            />
            <TextField
              label="Phone"
              optional
              name="phone"
              type="tel"
              autoComplete="tel"
              maxLength={limits.phone}
              error={errors.phone}
            />
          </div>
          <ChoiceTiles legend="I'm a…" name="gradeBand" choices={roles} error={errors.gradeBand} />
          {/* Remounts once the topic is known, so a link can start the message. */}
          <TextArea
            key={topic?.label ?? "blank"}
            label="Your message"
            name="message"
            rows={6}
            limit={limits.message}
            defaultValue={topic?.message}
            hint={topic ? `About: ${topic.label}` : undefined}
            error={errors.message}
          />
        </>
      )}
    </MessageForm>
  );
}
