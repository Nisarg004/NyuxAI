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
      <h2 className="font-display text-lg font-semibold text-star">Your account</h2>
      <p className="mt-1 text-sm leading-[1.55] text-haze">
        Deleting your account removes every brief and all of your feedback.
      </p>
      <button
        type="submit"
        className="mt-3 rounded-full border border-alarm/40 px-4 py-1.5 text-sm text-alarm transition-colors hover:border-alarm hover:bg-alarm/10"
      >
        Delete my account
      </button>
    </form>
  );
}
