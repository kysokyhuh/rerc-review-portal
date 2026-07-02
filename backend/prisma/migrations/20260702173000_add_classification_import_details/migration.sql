ALTER TABLE "Classification" ADD COLUMN "reviewCategory" TEXT;
ALTER TABLE "Classification" ADD COLUMN "suggestedScientificReviewer" TEXT;
ALTER TABLE "Classification" ADD COLUMN "suggestedNonScientificReviewer" TEXT;
ALTER TABLE "Classification" ADD COLUMN "importedRemarksJustification" TEXT;
ALTER TABLE "Classification" ADD COLUMN "importedResearchSummary" TEXT;
ALTER TABLE "Classification" ADD COLUMN "importedConsentFormRemarks" TEXT;
ALTER TABLE "Classification" ADD COLUMN "importedInstrumentRemarks" TEXT;
ALTER TABLE "Classification" ADD COLUMN "importedAdditionalNotes" TEXT;

UPDATE "Classification"
SET
  "reviewCategory" = NULLIF(trim(substring("rationale" FROM 'Recommended type of review:\s*(?:Exempt|Expedited|Full(?:\s+Board|\s+Review)?)\s*[-–—]\s*([^\(\r\n]+)')), ''),
  "suggestedScientificReviewer" = NULLIF(trim(substring("rationale" FROM 'Recommended type of review:[^\r\n]*\([^\)]*(?:^|[;\s])S:\s*([^;\)]+)')), ''),
  "suggestedNonScientificReviewer" = NULLIF(trim(substring("rationale" FROM 'Recommended type of review:[^\r\n]*\([^\)]*(?:^|[;\s])NS:\s*([^;\)]+)')), ''),
  "importedRemarksJustification" = NULLIF(trim(substring("rationale" FROM 'Remarks/Justification:\s*([^\r\n]+)')), ''),
  "importedResearchSummary" = NULLIF(trim(substring("rationale" FROM 'Notes/Summary of Research:\s*([^\r\n]+)')), ''),
  "importedConsentFormRemarks" = NULLIF(trim(substring("rationale" FROM 'Remarks on Informed Consent Form/s:\s*([^\r\n]+)')), ''),
  "importedInstrumentRemarks" = NULLIF(trim(substring("rationale" FROM 'Remarks on Instruments:\s*([^\r\n]+)')), ''),
  "importedAdditionalNotes" = NULLIF(trim(substring("rationale" FROM 'Additional notes:\s*([^\r\n]+)')), '')
WHERE "rationale" LIKE '%Imported from classification CSV.%';
