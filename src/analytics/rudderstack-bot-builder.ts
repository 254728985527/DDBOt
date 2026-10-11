import { Analytics } from '@deriv-com/analytics';
import { ACTION, form_name } from './constants';
import type { TBotFormEvent } from './types';

export const rudderStackSendSwitchLoadStrategyTabEvent = ({ load_strategy_tab }: TBotFormEvent) => {
    Analytics.trackEvent('ce_bot_form', {
        action: ACTION.SWITCH_LOAD_STRATEGY_TAB,
        form_name,
        load_strategy_tab,
        subform_name: 'load_strategy',
        subpage_name: 'bot_builder',
    });
};
