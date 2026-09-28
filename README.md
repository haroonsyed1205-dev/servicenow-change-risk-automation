# ServiceNow Change Risk Automation

> Portfolio project: original code with synthetic data. See [DISCLAIMER.md](DISCLAIMER.md).

Change Management automation for ServiceNow ITSM: a transparent risk score,
schedule conflict detection and an approval matrix, built so CAB can see
*why* a change is rated the way it is.

## What's inside
| Path | ServiceNow artifact | What it does |
|---|---|---|
| `src/script_includes/ChangeRiskCalculator.js` | Script Include | 0-100 risk score + level + reasons from CI criticality, impacted services, timing, change history, backout readiness |
| `src/script_includes/ChangeConflictChecker.js` | Script Include | Overlaps with other changes on the CI, blackout windows, maintenance windows |
| `src/script_includes/ChangeApprovalPolicy.js` | Script Include | Approval matrix by change type and risk level |
| `src/business_rules/change_request_calculate_risk.js` | Business Rule (before insert/update) | Gathers facts with GlideAggregate and sets risk fields |
| `src/business_rules/change_request_conflict_check.js` | Business Rule (before update) | Aborts scheduling when conflicts are found |
| `src/client_scripts/change_request_backout_required.js` | Client Script (onChange) | Makes the backout plan mandatory for normal/emergency changes |
| `docs/design.md` | — | Risk model, approval matrix, custom fields, ATF plan |

## Example
```
CHG0000101  normal, tier-1 CI, 4 services, business hours, 1 failed change, untested backout, 5h
-> score 88, very_high
   CI criticality tier 1 (+30)
   4 impacted service(s) (+16)
   Scheduled during business hours (+15)
   1 failed change(s) on this CI in 90 days (+8)
   Backout plan not tested (+10)
   Implementation longer than 4 hours (+9)
```

## Run the tests
Requires Node 18+. No dependencies.
```
node --test
```
`tests/harness.js` loads the Script Includes into a sandbox with small
stand-ins for `Class.create()` and `gs`, so the same files can be pasted into
an instance unchanged.

## Installing on a PDI
1. Create a scoped app (e.g. `x_change_risk`) in Studio.
2. Add the custom fields listed in `docs/design.md`.
3. Create each Script Include / Business Rule / Client Script from `src/`.
4. Set system property `x_change_risk.business_hours_schedule` to a schedule sys_id.

## Status
Logic is unit tested; platform scripts are being validated on a Personal
Developer Instance.
