UPDATE "Classification"
SET "suggestedScientificReviewer" = NULLIF(trim(substring("rationale" FROM 'Recommended type of review:[^\r\n]*[(;]\s*S:\s*([^;\)]+)')), '')
WHERE "suggestedScientificReviewer" IS NULL
  AND "rationale" LIKE '%Recommended type of review:%S:%';
