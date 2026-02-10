/**
 * Centralized branding configuration for the frontend.
 *
 * Every user-visible string that mentions the organisation name should
 * reference one of these constants so a rename is a one-line change.
 *
 * Internal technical identifiers (committee codes sent to the API, route
 * paths, etc.) are intentionally kept separate.
 */

export const BRAND = {
  /** Short name used in headings, page titles, sidebar, footer */
  name: "URERD",

  /** Full organisation name for formal contexts */
  fullName: "University Research Ethics Review and Development",

  /** Support/contact email shown on login and footers */
  supportEmail: "urerd.secretariat@dlsu.edu.ph",

  /** Tagline shown below the brand name */
  tagline: "Research Ethics Review Portal",

  /**
   * The committee code sent to the API.
   * This is a technical identifier — it matches the DB value and must NOT
   * be renamed unless the database is migrated.
   */
  defaultCommitteeCode: "RERC-HUMAN",
} as const;
