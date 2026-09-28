/**
 * Business Rule: Block scheduling conflicts
 * Table: change_request   When: before   Update: true
 * Condition: current.state.changesTo(-2) (Scheduled) ||
 *            (current.state == -2 && (current.start_date.changes() || current.end_date.changes()))
 */
(function executeRule(current, previous) {

    var start = current.start_date.getGlideObject().getNumericValue();
    var end = current.end_date.getGlideObject().getNumericValue();
    var ciId = current.getValue('cmdb_ci');

    var scheduled = [];
    var gr = new GlideRecord('change_request');
    gr.addQuery('cmdb_ci', ciId);
    gr.addQuery('state', 'IN', '-2,-1'); // Scheduled, Implement
    gr.addQuery('sys_id', '!=', current.getUniqueValue());
    gr.addQuery('start_date', '<', current.getValue('end_date'));
    gr.addQuery('end_date', '>', current.getValue('start_date'));
    gr.query();
    while (gr.next()) {
        scheduled.push({
            number: gr.getValue('number'), ci: ciId,
            start: gr.start_date.getGlideObject().getNumericValue(),
            end: gr.end_date.getGlideObject().getNumericValue()
        });
    }

    var blackouts = [];
    var bo = new GlideRecord('cmn_schedule_blackout');
    bo.addQuery('type', 'blackout');
    bo.query();
    // Simplified: real blackout schedules use cmn_schedule_span; see docs/design.md
    while (bo.next()) {
        blackouts.push({ name: bo.getValue('name'),
            start: new GlideDateTime(bo.getValue('start_date')).getNumericValue(),
            end: new GlideDateTime(bo.getValue('end_date')).getNumericValue() });
    }

    var conflicts = new ChangeConflictChecker().check(
        { number: current.getValue('number'), ci: ciId, start: start, end: end, type: current.getValue('type') },
        { scheduledChanges: scheduled, blackouts: blackouts });

    if (conflicts.length) {
        conflicts.forEach(function (c) { gs.addErrorMessage(c.message); });
        current.setAbortAction(true);
    }

})(current, previous);
