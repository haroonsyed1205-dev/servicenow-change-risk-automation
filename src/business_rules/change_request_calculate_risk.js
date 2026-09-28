/**
 * Business Rule: Calculate change risk
 * Table: change_request   When: before   Insert: true   Update: true
 * Condition: current.type.changes() || current.cmdb_ci.changes() ||
 *            current.start_date.changes() || current.u_backout_tested.changes()
 * (u_backout_tested is a custom True/False field added in this app.)
 */
(function executeRule(current, previous /*null when async*/) {

    var ci = current.cmdb_ci.getRefRecord();
    var facts = {
        type: current.getValue('type'),
        ciCriticality: parseInt(ci.getValue('busines_criticality'), 10) || 1,
        impactedServices: countImpactedServices(current.getValue('cmdb_ci')),
        inBusinessHours: isBusinessHours(current.start_date.getGlideObject()),
        failedChangesLast90d: countFailedChanges(current.getValue('cmdb_ci')),
        backoutPlanTested: current.getValue('u_backout_tested') == 'true',
        implementationMinutes: minutesBetween(current.start_date, current.end_date)
    };

    var result = new ChangeRiskCalculator().calculate(facts);
    current.setValue('risk', result.riskValue);
    current.setValue('u_risk_score', result.score);
    current.setValue('u_risk_reasons', result.reasons.join('\n'));

    function countImpactedServices(ciSysId) {
        var ga = new GlideAggregate('cmdb_rel_ci');
        ga.addQuery('child', ciSysId);
        ga.addQuery('parent.sys_class_name', 'IN', 'cmdb_ci_service,cmdb_ci_service_business,cmdb_ci_service_technical');
        ga.addAggregate('COUNT');
        ga.query();
        return ga.next() ? parseInt(ga.getAggregate('COUNT'), 10) : 0;
    }

    function countFailedChanges(ciSysId) {
        var ga = new GlideAggregate('change_request');
        ga.addQuery('cmdb_ci', ciSysId);
        ga.addQuery('close_code', 'unsuccessful');
        ga.addQuery('closed_at', '>=', gs.daysAgoStart(90));
        ga.addAggregate('COUNT');
        ga.query();
        return ga.next() ? parseInt(ga.getAggregate('COUNT'), 10) : 0;
    }

    function isBusinessHours(gdt) {
        if (!gdt || !gdt.isValid()) return false;
        var sched = new GlideSchedule(gs.getProperty('x_change_risk.business_hours_schedule'));
        return sched.isInSchedule(gdt);
    }

    function minutesBetween(start, end) {
        if (start.nil() || end.nil()) return 0;
        var ms = end.getGlideObject().getNumericValue() - start.getGlideObject().getNumericValue();
        return Math.round(ms / 60000);
    }

})(current, previous);
