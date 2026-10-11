import { Analytics } from '@deriv-com/analytics';
import { ACTION, form_name, TSelectedStrategy } from './constants';
import type { TBotFormEvent } from './types';
import { getRsStrategyType } from './utils';

export const rudderStackSendSelectQsStrategyGuideEvent = ({ selected_strategy }: TSelectedStrategy) => {
    Analytics.trackEvent('ce_bot_form', {
        action: ACTION.SELECT_QUICK_STRATEGY_GUIDE,
        form_name,
        subpage_name: 'tutorials',
        strategy_name: getRsStrategyType(selected_strategy),
    });
};

export const rudderStackSendTutorialSearchEvent = ({ search_term }: TBotFormEvent) => {
    Analytics.trackEvent('ce_bot_form', {
        action: 'search',
        form_name: 'ce_bot_form',
        subpage_name: 'tutorials',
        search_term,
    });
};
