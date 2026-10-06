# 016 — `f5428f08` fix: sonarcloud issues

| | |
|---|---|
| **Hash** | `f5428f08b9b2da6a4c24758cf88fb5f461846a0c` |
| **Category** | Quality (end of range) |

## Functionality introduced

No product features. Sonar cleanups in Low Code–touched files, e.g.:

- Prefer `Number.parseFloat` / `Number.isNaN`
- Prefer `replaceAll` where appropriate
- Prefer `new Array(...).keys()` style cleanups
- Touched old files such as `FieldRenderer.tsx`, `FieldUtils.ts`, bounding-box / UML helpers

## Status on current `develop`

N/A as a feature. Develop has its own lint/Sonar baseline.

## Gap

None functionally.

## What to implement today

While porting Low Code code:

1. Write new code to satisfy current ESLint/Sonar rules on develop
2. Avoid reintroducing patterns Sonar already flagged on the old branch
3. Do not create a separate “sonar cleanup” commit unless the team wants one after the feature lands

## Files

No dedicated port. Apply as coding standard across FieldRenderer / FieldUtils / new utils.

## Do not copy

Drive-by cleanups in unrelated develop UML/bounding-box code that happens to share filenames with the old branch.

## Dependencies

End marker of the analyzed range. All feature work should already be planned via earlier docs.
