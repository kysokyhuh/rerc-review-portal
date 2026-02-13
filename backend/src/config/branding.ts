/**
 * Centralized branding configuration for the backend.
 *
 * Change the values here (or override via environment variables) to rebrand
 * every user-facing string produced by the API, letter generator, and HTML pages.
 *
 * Internal technical identifiers (DB committee codes, table names, etc.) are
 * intentionally NOT controlled here so that a rename doesn't break data.
 */

export const BRAND = {
  /** Short organisation/product name shown in titles and headings */
  name: process.env.BRAND_NAME || "URERB",

  /** Full organisation name */
  fullName:
    process.env.BRAND_FULL_NAME ||
    "University Research Ethics Review and Development",

  /** The default committee code stored in the DB. NOT user-facing. */
  defaultCommitteeCode: "RERC-HUMAN",

  /** Label shown on rendered HTML pages / letters for the committee */
  committeeLabel: process.env.BRAND_COMMITTEE_LABEL || "URERB",

  /** Support / contact e-mail surfaced in UI & letters */
  supportEmail:
    process.env.BRAND_SUPPORT_EMAIL || "urerd.secretariat@dlsu.edu.ph",

  /** Generic tagline */
  tagline: process.env.BRAND_TAGLINE || "Research Ethics Review Portal",
} as const;
