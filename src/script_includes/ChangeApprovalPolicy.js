/**
 * ChangeApprovalPolicy
 * Decides which approvals a change needs, mirroring the kind of decision
 * table you would build in a Change Approval Policy:
 *   standard        -> no approval (pre-approved template)
 *   emergency       -> ECAB + CI owner group, approval can happen post-implementation
 *   normal / low    -> assignment group manager (peer review)
 *   normal / moderate -> + CI owner group
 *   normal / high+  -> + CAB; very_high also needs the service owner
 */
var ChangeApprovalPolicy = Class.create();
ChangeApprovalPolicy.prototype = {
    initialize: function (groups) {
        this.groups = groups || { cab: 'Change Advisory Board', ecab: 'Emergency CAB' };
    },

    decide: function (change) {
        var approvals = [];
        var add = function (who, reason) {
            if (who && approvals.every(function (a) { return a.approver !== who; })) {
                approvals.push({ approver: who, reason: reason });
            }
        };

        if (change.type === 'standard') {
            return { approvals: [], requiresCab: false, retrospective: false };
        }

        if (change.type === 'emergency') {
            add(this.groups.ecab, 'Emergency change');
            add(change.ciOwnerGroup, 'CI owner');
            return { approvals: approvals, requiresCab: false, retrospective: true };
        }

        add(change.assignmentGroupManager, 'Peer / manager review');
        if (['moderate', 'high', 'very_high'].indexOf(change.riskLevel) > -1) {
            add(change.ciOwnerGroup, 'CI owner for ' + change.riskLevel + ' risk');
        }
        var cab = change.riskLevel === 'high' || change.riskLevel === 'very_high';
        if (cab) {
            add(this.groups.cab, 'CAB review for ' + change.riskLevel + ' risk');
        }
        if (change.riskLevel === 'very_high') {
            add(change.serviceOwner, 'Service owner sign-off');
        }
        return { approvals: approvals, requiresCab: cab, retrospective: false };
    },

    type: 'ChangeApprovalPolicy'
};
