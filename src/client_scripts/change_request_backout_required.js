/**
 * Client Script: Require backout plan for normal/emergency changes
 * Table: change_request   Type: onChange   Field: type
 */
function onChange(control, oldValue, newValue, isLoading, isTemplate) {
    if (isLoading) return;
    var needsPlan = newValue === 'normal' || newValue === 'emergency';
    g_form.setMandatory('backout_plan', needsPlan);
    g_form.setDisplay('u_backout_tested', needsPlan);
    if (!needsPlan) g_form.clearValue('u_backout_tested');
}
