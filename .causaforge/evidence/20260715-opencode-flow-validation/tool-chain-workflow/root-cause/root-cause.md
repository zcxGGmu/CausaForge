# Root Cause root-cause-001

Status: confirmed

Problem: Configuration migration drops a required field.

Root Cause: Normalization did not copy the field after migration.

Verification Criteria:
- criterion-001: The field is preserved by migration.
