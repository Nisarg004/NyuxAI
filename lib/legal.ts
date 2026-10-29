// Contact details for the legal pages and email footers. Both come from the
// environment so no personal address is ever hard-coded; null means unset.
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? null;

// CAN-SPAM requires a physical postal address in every marketing email.
export const POSTAL_ADDRESS = process.env.EMAIL_POSTAL_ADDRESS ?? null;
