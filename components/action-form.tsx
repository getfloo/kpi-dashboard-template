"use client";

import { startTransition, useActionState } from "react";
import type { FormState } from "@/app/actions";

/**
 * A form posting to a server action that returns FormState. A refused submit keeps
 * what was typed and shows the server's message; a successful one clears the form.
 */
export function ActionForm({ action, submitLabel, className, children }: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  submitLabel: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form
      // A new key after each save remounts the form, resetting its fields.
      key={state?.savedAt}
      className={className}
      onSubmit={(event) => {
        // Submitting through the action prop would reset the fields on an error too.
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => formAction(data));
      }}
    >
      {children}
      {state?.error && (
        <p role="alert" className="mt-4 rounded-sm bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>
      )}
      <button type="submit" disabled={pending}
        className="mt-5 cursor-pointer rounded-sm bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:cursor-wait disabled:opacity-70">
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
