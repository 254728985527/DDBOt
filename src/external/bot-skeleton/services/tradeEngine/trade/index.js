import { applyMiddleware, createStore } from 'redux';
import { thunk } from 'redux-thunk';
import { localize } from '@deriv-com/translations';
import { createError } from '../../../utils/error';
import { observer as globalObserver } from '../../../utils/observer';
import { api_base } from '../../api/api-base';
import { checkBlocksForProposalRequest, doUntilDone } from '../utils/helpers';
import { expectInitArg } from '../utils/sanitize';
import { proposalsReady, start } from './state/actions';
import * as constants from './state/constants';
import rootReducer from './state/reducers';
import Balance from './Balance';
import OpenContract from './OpenContract';
import Proposal from './Proposal';
import Purchase from './Purchase';
import Sell from './Sell';
import Ticks from './Ticks';
import Total from './Total';

const watchBefore = store =>
    watchScope({
        store,
        stopScope: constants.DURING_PURCHASE,
        passScope: constants.BEFORE_PURCHASE,
        passFlag: 'proposalsReady',
    });

const watchDuring = store =>
    watchScope({
        store,
        stopScope: constants.STOP,
        passScope: constants.DURING_PURCHASE,
        passFlag: 'openContract',
    });

/* The watchScope function is called randomly and resets the prevTick
 * which leads to the same problem we try to solve. So prevTick is isolated
 */
let prevTick;

const selectPoolMarket = (configuredSymbol, tradeOptions) => {
    const poolEnabled = tradeOptions?.poolEnabled === true || tradeOptions?.poolEnabled === 'TRUE';
    if (!poolEnabled) return configuredSymbol;

    const runtime = typeof window !== 'undefined' ? window : {};
    const marketPercentages = runtime.marketPercentages;
    if (!marketPercentages || typeof marketPercentages !== 'object') return configuredSymbol;

    const configuredThreshold = Number(tradeOptions.qualifyingThreshold ?? 10);
    const scope = tradeOptions.poolTradeScope ?? 'all_gt_15';
    const threshold = scope === 'all_gt_15' ? Math.max(configuredThreshold, 15) : configuredThreshold;
    const candidates = Object.entries(marketPercentages)
        .map(([symbol, value]) => {
            const metrics = typeof value === 'number' ? { botVariable: value } : (value ?? {});
            const percentages = [
                metrics.lastDigit ?? metrics.last_digit ?? metrics.lastDigitPercentage,
                metrics.directional ?? metrics.direction ?? metrics.directionalPercentage,
                metrics.botVariable ?? metrics.bot_variable ?? metrics.percentage,
            ].map(Number);
            const allMetricsAvailable = percentages.every(Number.isFinite);
            const qualifies = allMetricsAvailable && percentages.every(percentage => percentage >= threshold);
            return {
                symbol,
                score: allMetricsAvailable ? percentages.reduce((sum, percentage) => sum + percentage, 0) / 3 : 0,
                qualifies,
            };
        })
        .filter(candidate => candidate.qualifies)
        .sort((left, right) => right.score - left.score);

    const scopeSize = scope === 'all_gt_15' ? candidates.length : Math.max(1, Number(scope) || 1);
    const scopedCandidates = candidates.slice(0, scopeSize);
    return (
        scopedCandidates.reduce(
            (highest, candidate) => (!highest || candidate.score > highest.score ? candidate : highest),
            null
        )?.symbol ?? configuredSymbol
    );
};

const watchScope = ({ store, stopScope, passScope, passFlag }) => {
    // in case watch is called after stop is fired
    if (store.getState().scope === stopScope) {
        return Promise.resolve(false);
    }
    return new Promise(resolve => {
        const unsubscribe = store.subscribe(() => {
            const newState = store.getState();

            if (newState.newTick === prevTick) return;
            prevTick = newState.newTick;

            if (newState.scope === passScope && newState[passFlag]) {
                unsubscribe();
                resolve(true);
            }

            if (newState.scope === stopScope) {
                unsubscribe();
                resolve(false);
            }
        });
    });
};

export default class TradeEngine extends Balance(Purchase(Sell(OpenContract(Proposal(Ticks(Total(class {}))))))) {
    constructor($scope) {
        super();
        this.observer = $scope.observer;
        this.$scope = $scope;
        this.observe();
        this.data = {
            contract: {},
            proposals: [],
        };
        this.subscription_id_for_accumulators = null;
        this.is_proposal_requested_for_accumulators = false;
        this.store = createStore(rootReducer, applyMiddleware(thunk));
    }

    init(...args) {
        const [token, options] = expectInitArg(args);
        const { symbol } = options;

        this.initArgs = args;
        this.options = options;
        this.startPromise = this.loginAndGetBalance(token);

        if (!this.checkTicksPromiseExists()) this.watchTicks(symbol);
    }

    start(tradeOptions) {
        if (!this.options) {
            throw createError('NotInitialized', localize('Bot.init is not called'));
        }

        globalObserver.emit('bot.running');

        const validated_trade_options = this.validateTradeOptions(tradeOptions);

        const poolSymbol = selectPoolMarket(this.options.symbol, {
            ...this.options,
            ...validated_trade_options,
            poolEnabled: validated_trade_options.poolEnabled ?? validated_trade_options.POOL_ENABLED,
            qualifyingThreshold:
                validated_trade_options.qualifyingThreshold ?? validated_trade_options.QUALIFYING_THRESHOLD,
            poolTradeScope: validated_trade_options.poolTradeScope ?? validated_trade_options.POOL_TRADE_SCOPE,
        });
        this.tradeOptions = { ...validated_trade_options, symbol: poolSymbol };
        this.store.dispatch(start());
        this.checkLimits(validated_trade_options);

        this.makeDirectPurchaseDecision();
    }

    loginAndGetBalance(token) {
        if (this.token === token) {
            return Promise.resolve();
        }
        // for strategies using total runs, GetTotalRuns function is trying to get loginid and it gets called before Proposals calls.
        // the below required loginid to be set in Proposal calls where loginAndGetBalance gets resolved.
        // Earlier this used to happen as soon as we get ticks_history response and by the time GetTotalRuns gets called we have required info.
        this.accountInfo = api_base.account_info;
        this.token = api_base.token;
        return new Promise(resolve => {
            // Try to recover from a situation where API doesn't give us a correct response on
            // "proposal_open_contract" which would make the bot run forever. When there's a "sell"
            // event, wait a couple seconds for the API to give us the correct "proposal_open_contract"
            // response, if there's none after x seconds. Send an explicit request, which _should_
            // solve the issue. This is a backup!
            const subscription = api_base.api.onMessage().subscribe(({ data }) => {
                if (data.msg_type === 'transaction' && data.transaction.action === 'sell') {
                    this.transaction_recovery_timeout = setTimeout(() => {
                        const { contract } = this.data;
                        const is_same_contract = contract.contract_id === data.transaction.contract_id;
                        const is_open_contract = contract.status === 'open';
                        if (is_same_contract && is_open_contract) {
                            doUntilDone(() => {
                                api_base.api.send({ proposal_open_contract: 1, contract_id: contract.contract_id });
                            }, ['PriceMoved']);
                        }
                    }, 1500);
                }
                resolve();
            });
            api_base.pushSubscription(subscription);
        });
    }

    observe() {
        this.observeOpenContract();
        this.observeBalance();
        this.observeProposals();
    }

    watch(watchName) {
        if (watchName === 'before') {
            return watchBefore(this.store);
        }
        return watchDuring(this.store);
    }

    makeDirectPurchaseDecision() {
        const { has_payout_block, is_basis_payout } = checkBlocksForProposalRequest();
        this.is_proposal_subscription_required = has_payout_block || is_basis_payout;

        if (this.is_proposal_subscription_required) {
            this.makeProposals({ ...this.options, ...this.tradeOptions });
            this.checkProposalReady();
        } else {
            this.store.dispatch(proposalsReady());
        }
    }
}
