/**
 * ChangeRiskCalculator
 * Scores a change request from 0-100 and maps it to a risk level.
 * Pure logic: callers pass a plain "facts" object, so it can be reused from a
 * Business Rule, a UI Action or Flow Designer (via a script step) and tested
 * outside the platform.
 *
 * facts = {
 *   type: 'standard' | 'normal' | 'emergency',
 *   ciCriticality: 1..4          (1 = most critical, matches busines_criticality),
 *   impactedServices: number,    (count of services related to the CI)
 *   inBusinessHours: boolean,
 *   failedChangesLast90d: number (on the same CI),
 *   backoutPlanTested: boolean,
 *   implementationMinutes: number
 * }
 */
var ChangeRiskCalculator = Class.create();
ChangeRiskCalculator.prototype = {
    initialize: function (weights) {
        this.weights = weights || {
            criticality: { 1: 30, 2: 20, 3: 10, 4: 0 },
            perImpactedService: 4,
            impactedServiceCap: 20,
            businessHours: 15,
            perFailedChange: 8,
            failedChangeCap: 16,
            untestedBackout: 10,
            longImplementation: 9,   // > 240 minutes
            emergency: 10
        };
        this.levels = [
            { min: 70, level: 'very_high', value: 1 },
            { min: 45, level: 'high', value: 2 },
            { min: 20, level: 'moderate', value: 3 },
            { min: 0, level: 'low', value: 4 }
        ];
    },

    calculate: function (facts) {
        var f = facts || {};
        var w = this.weights;
        var score = 0;
        var reasons = [];

        if (f.type === 'standard') {
            // Standard changes are pre-approved templates; risk is fixed low
            // unless the template is being run against a tier-1 CI.
            var std = f.ciCriticality === 1 ? 20 : 5;
            return this._result(std, ['Standard change template' +
                (f.ciCriticality === 1 ? ' on a tier-1 CI' : '')]);
        }

        var crit = w.criticality[f.ciCriticality];
        if (crit === undefined) {
            crit = w.criticality[1];
            reasons.push('CI criticality unknown, treated as tier 1');
        } else if (crit > 0) {
            reasons.push('CI criticality tier ' + f.ciCriticality + ' (+' + crit + ')');
        }
        score += crit;

        var svc = Math.min((f.impactedServices || 0) * w.perImpactedService, w.impactedServiceCap);
        if (svc > 0) {
            reasons.push(f.impactedServices + ' impacted service(s) (+' + svc + ')');
        }
        score += svc;

        if (f.inBusinessHours) {
            score += w.businessHours;
            reasons.push('Scheduled during business hours (+' + w.businessHours + ')');
        }

        var failed = Math.min((f.failedChangesLast90d || 0) * w.perFailedChange, w.failedChangeCap);
        if (failed > 0) {
            reasons.push(f.failedChangesLast90d + ' failed change(s) on this CI in 90 days (+' + failed + ')');
        }
        score += failed;

        if (!f.backoutPlanTested) {
            score += w.untestedBackout;
            reasons.push('Backout plan not tested (+' + w.untestedBackout + ')');
        }

        if ((f.implementationMinutes || 0) > 240) {
            score += w.longImplementation;
            reasons.push('Implementation longer than 4 hours (+' + w.longImplementation + ')');
        }

        if (f.type === 'emergency') {
            score += w.emergency;
            reasons.push('Emergency change (+' + w.emergency + ')');
        }

        return this._result(Math.min(score, 100), reasons);
    },

    _result: function (score, reasons) {
        for (var i = 0; i < this.levels.length; i++) {
            if (score >= this.levels[i].min) {
                return {
                    score: score,
                    level: this.levels[i].level,
                    riskValue: this.levels[i].value, // change_request.risk choice value
                    reasons: reasons
                };
            }
        }
    },

    type: 'ChangeRiskCalculator'
};
