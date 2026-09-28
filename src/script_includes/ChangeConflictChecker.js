/**
 * ChangeConflictChecker
 * Detects schedule conflicts for a proposed change window:
 *   - overlap with other scheduled changes on the same CI
 *   - overlap with blackout windows (global or CI-specific)
 *   - falls outside a maintenance window when the CI requires one
 * Times are epoch milliseconds so the logic is timezone-neutral; the
 * platform wrapper converts GlideDateTime with getNumericValue().
 */
var ChangeConflictChecker = Class.create();
ChangeConflictChecker.prototype = {
    initialize: function () {},

    overlaps: function (aStart, aEnd, bStart, bEnd) {
        return aStart < bEnd && bStart < aEnd;
    },

    check: function (proposed, context) {
        var ctx = context || {};
        var conflicts = [];
        var self = this;

        if (proposed.end <= proposed.start) {
            return [{ type: 'invalid_window', message: 'Planned end must be after planned start' }];
        }

        (ctx.scheduledChanges || []).forEach(function (c) {
            if (c.number !== proposed.number && c.ci === proposed.ci &&
                self.overlaps(proposed.start, proposed.end, c.start, c.end)) {
                conflicts.push({ type: 'ci_already_scheduled', ref: c.number,
                    message: 'CI ' + c.ci + ' already has ' + c.number + ' in this window' });
            }
        });

        (ctx.blackouts || []).forEach(function (b) {
            var applies = !b.ci || b.ci === proposed.ci;
            if (applies && self.overlaps(proposed.start, proposed.end, b.start, b.end)) {
                conflicts.push({ type: 'blackout', ref: b.name,
                    message: 'Overlaps blackout window "' + b.name + '"' });
            }
        });

        if (ctx.maintenanceWindows && ctx.maintenanceWindows.length &&
            proposed.type !== 'emergency') {
            var inside = ctx.maintenanceWindows.some(function (m) {
                return proposed.start >= m.start && proposed.end <= m.end;
            });
            if (!inside) {
                conflicts.push({ type: 'outside_maintenance',
                    message: 'Change is not fully inside a maintenance window for this CI' });
            }
        }

        return conflicts;
    },

    type: 'ChangeConflictChecker'
};
