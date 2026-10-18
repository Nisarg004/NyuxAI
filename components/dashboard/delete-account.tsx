"use client";

import { deleteAccount } from "@/app/auth/actions";

export function DeleteAccount() {
  return (
    <form
      action={deleteAccount}
      onSubmit={(e) => {
        if (!window.confirm("Delete your account and every brief in your archive? This can't be undone.")) {
          e.preventDefault();
        }
      }}
    >
      <button type="submit" className="text-sm text-ink-soft underline decoration-rule underline-offset-4 hover:text-editor">
        Delete my account
      </button>
    </form>
  );
}
