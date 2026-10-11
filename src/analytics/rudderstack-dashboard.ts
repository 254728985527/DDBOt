import { Analytics } from '@deriv-com/analytics';
import { ACTION, form_name } from './constants';
import type { TBotFormEvent } from './types';

export const rudderStackSendDashboardClickEvent = ({ dashboard_click_name, subpage_name }: TBotFormEvent) => {
    Analytics.trackEvent('ce_bot_form', {
        action: ACTION.DASHBOARD_CLICK,
        form_name,
        subpage_name,
        dashboard_click_name,
    });
};

export const rudderStackSendAnnouncementClickEvent = ({ announcement_name }: TBotFormEvent) => {
    Analytics.trackEvent('ce_bot_form', {
        action: ACTION.ANNOUNCEMENT_CLICK,
        form_name,
        subform_name: 'announcements',
        subform_source: 'dashboard',
        announcement_name,
    });
};

export const rudderStackSendAnnouncementActionEvent = ({ announcement_name, announcement_action }: TBotFormEvent) => {
    Analytics.trackEvent('ce_bot_form', {
        action: ACTION.ANNOUNCEMENT_ACTION,
        form_name,
        subform_name: 'announcements',
        subform_source: 'dashboard',
        announcement_name,
        announcement_action,
    });
};
