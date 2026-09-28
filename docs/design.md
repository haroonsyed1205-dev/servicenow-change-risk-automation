# Design notes

## Why the logic is in Script Includes
Business Rules, UI Actions and Flow Designer script steps all need the same
risk and approval decisions. Keeping the decision in one Script Include that
takes plain input avoids three copies drifting apart, and lets the rules be
unit tested with Node (`tests/`) and with ATF on the instance.

## Custom fields this app expects on `change_request`
| Field | Type | Purpose |
|---|---|---|
| `u_backout_tested` | True/False | Implementer confirms the backout plan was rehearsed |
| `u_risk_score` | Integer | 0-100 score from `ChangeRiskCalculator` |
| `u_risk_reasons` | String (1000) | Human-readable reasons shown to CAB |

## Risk model
| Factor | Points |
|---|---|
| CI criticality tier 1 / 2 / 3 / 4 | 30 / 20 / 10 / 0 |
| Each impacted service | 4 (max 20) |
| Business hours | 15 |
| Each failed change on the CI in 90 days | 8 (max 16) |
| Backout plan not tested | 10 |
| Implementation over 4 hours | 9 |
| Emergency change | 10 |

Levels: 70+ very high, 45+ high, 20+ moderate, otherwise low. Weights are
passed to the constructor, so they can be moved into a system property or a
decision table without changing the code.

## Approval matrix
| Type / risk | Approvers | CAB |
|---|---|---|
| Standard | none (pre-approved) | no |
| Normal, low | assignment group manager | no |
| Normal, moderate | + CI owner group | no |
| Normal, high | + CAB | yes |
| Normal, very high | + service owner | yes |
| Emergency | ECAB + CI owner group, retrospective review | no |

## Known simplifications
- Blackout lookup in the conflict Business Rule reads a flat table; a real
  instance evaluates `cmn_schedule_span` entries for blackout schedules.
- Business hours use one schedule from a system property; multi-region
  changes would need the CI's location schedule.

## ATF plan
1. Create CI with criticality 1 and two related services.
2. Insert normal change in business hours with untested backout -> assert risk = High/Very High and reasons populated.
3. Move a second change on the same CI into an overlapping Scheduled window -> assert the update is aborted.
