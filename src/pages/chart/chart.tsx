import { useEffect, useRef, useState } from 'react';
import classNames from 'classnames';
import { observer } from 'mobx-react-lite';
import chart_api from '@/external/bot-skeleton/services/api/chart-api';
import { useStore } from '@/hooks/useStore';
import { ActiveSymbolsRequest, ServerTimeRequest, TicksStreamRequest, TradingTimesRequest } from '@deriv/api-types';
import { ChartTitle, SmartChart } from '@deriv/deriv-charts';
import { useDevice } from '@deriv-com/ui';
import ToolbarWidgets from './toolbar-widgets';
import '@deriv/deriv-charts/dist/smartcharts.css';

type TSubscription = {
    [key: string]: null | {
        unsubscribe?: () => void;
    };
};

const subscriptions: TSubscription = {};
const DEFAULT_CHART_SYMBOL = '1HZ100V';

const Chart = observer(({ show_digits_stats }: { show_digits_stats: boolean }) => {
    const barriers: [] = [];
    const { common, ui } = useStore();
    const { chart_store, run_panel, dashboard } = useStore();
    const [isSafari, setIsSafari] = useState(false);
    const [isChartApiReady, setIsChartApiReady] = useState(false);
    const [chartConnectionError, setChartConnectionError] = useState<string | null>(null);
    const [connectionAttempt, setConnectionAttempt] = useState(0);

    const {
        chart_type,
        getMarketsOrder,
        granularity,
        onSymbolChange,
        setChartStatus,
        symbol,
        updateChartType,
        updateGranularity,
        updateSymbol,
        setChartSubscriptionId,
        chart_subscription_id,
    } = chart_store;
    const chartSubscriptionIdRef = useRef(chart_subscription_id);
    const { isDesktop, isMobile } = useDevice();
    const { is_drawer_open } = run_panel;
    const { is_chart_modal_visible } = dashboard;
    const settings = {
        assetInformation: false, // ui.is_chart_asset_info_visible,
        countdown: true,
        isHighestLowestMarkerEnabled: false, // TODO: Pending UI,
        language: common.current_language.toLowerCase(),
        position: ui.is_chart_layout_default ? 'bottom' : 'left',
        theme: ui.is_dark_mode_on ? 'dark' : 'light',
    };
    useEffect(() => {
        let cancelled = false;
        let retry_timer: ReturnType<typeof setTimeout> | undefined;
        let timeout_timer: ReturnType<typeof setTimeout> | undefined;
        const connect = async () => {
            window.clearTimeout(timeout_timer);
            timeout_timer = window.setTimeout(() => {
                if (!cancelled && chart_api.api?.connection?.readyState !== WebSocket.OPEN) {
                    setChartConnectionError('Market data connection timed out');
                }
            }, 5000);
            try {
                const api = await chart_api.init(connectionAttempt > 0);
                if (!cancelled && api?.connection?.readyState === WebSocket.OPEN) {
                    window.clearTimeout(timeout_timer);
                    setChartConnectionError(null);
                    setIsChartApiReady(true);
                    return;
                }
            } catch (error) {
                if (!cancelled) setChartConnectionError(error instanceof Error ? error.message : 'Unable to connect');
            }
            if (!cancelled) {
                const delay = Math.min(1000 * 2 ** Math.min(connectionAttempt, 4), 12000);
                retry_timer = window.setTimeout(connect, delay);
            }
        };
        connect();

        return () => {
            cancelled = true;
            window.clearTimeout(retry_timer);
            window.clearTimeout(timeout_timer);
        };
    }, [connectionAttempt]);

    useEffect(() => {
        // Safari browser detection
        const isSafariBrowser = () => {
            const ua = navigator.userAgent.toLowerCase();
            return ua.indexOf('safari') !== -1 && ua.indexOf('chrome') === -1 && ua.indexOf('android') === -1;
        };

        setIsSafari(isSafariBrowser());

        return () => {
            Object.values(subscriptions).forEach(subscription => subscription?.unsubscribe?.());
            Object.keys(subscriptions).forEach(subscription_id => {
                chart_api.api?.forget(subscription_id);
                delete subscriptions[subscription_id];
            });
            chart_api.api?.forgetAll('ticks');
        };
    }, []);

    useEffect(() => {
        chartSubscriptionIdRef.current = chart_subscription_id;
    }, [chart_subscription_id]);

    useEffect(() => {
        if (!isChartApiReady) return;
        if (!chart_store.symbol) chart_store.symbol = DEFAULT_CHART_SYMBOL;
        updateSymbol();
    }, [chart_store, isChartApiReady, updateSymbol]);

    const requestAPI = async (req: ServerTimeRequest | ActiveSymbolsRequest | TradingTimesRequest) => {
        const api = chart_api.api?.connection?.readyState === WebSocket.OPEN ? chart_api.api : await chart_api.init();
        if (!api || api.connection?.readyState !== WebSocket.OPEN) throw new Error('Chart connection is unavailable');
        return api.send(req);
    };
    const requestForgetStream = (subscription_id: string) => {
        if (!subscription_id) return;
        subscriptions[subscription_id]?.unsubscribe?.();
        delete subscriptions[subscription_id];
        chart_api.api?.forget(subscription_id);
    };

    const requestSubscribe = async (req: TicksStreamRequest, callback: (data: any) => void) => {
        if (!req.ticks_history || req.ticks_history === 'undefined' || req.ticks_history === '') return;

        requestForgetStream(chartSubscriptionIdRef.current);
        const api = chart_api.api?.connection?.readyState === WebSocket.OPEN ? chart_api.api : await chart_api.init();
        if (!api || api.connection?.readyState !== WebSocket.OPEN) throw new Error('Chart connection is unavailable');

        const subscription = api.subscribe(req);
        const unsubscribe = subscription.subscribe((response: any) => {
            if (response?.error) return;
            const subscriptionId = response?.subscription?.id;
            if (subscriptionId && !subscriptions[subscriptionId]) {
                subscriptions[subscriptionId] = { unsubscribe };
                setChartSubscriptionId(subscriptionId);
            }
            callback(response);
        });
    };

    if (!symbol || !isChartApiReady || !chart_api.api) {
        return (
            <div className='dashboard__chart-wrapper chart-loading-state'>
                <div className='chart-loading-state__spinner' aria-hidden='true' />
                <span>
                    {chartConnectionError
                        ? 'Failed to connect to market data. Check your network, sign in with a token that has Read permission, or retry.'
                        : isChartApiReady
                          ? 'Retrieving Market Symbols...'
                          : 'Connecting to market data...'}
                </span>
                {chartConnectionError && (
                    <button
                        type='button'
                        className='chart-loading-state__retry'
                        onClick={() => {
                            chart_api.disconnect();
                            setIsChartApiReady(false);
                            setChartConnectionError(null);
                            setConnectionAttempt(attempt => attempt + 1);
                        }}
                    >
                        Retry
                    </button>
                )}
            </div>
        );
    }
    const is_connection_opened = chart_api.api?.connection?.readyState === WebSocket.OPEN;
    return (
        <div
            className={classNames('dashboard__chart-wrapper', {
                'dashboard__chart-wrapper--expanded': is_drawer_open && isDesktop,
                'dashboard__chart-wrapper--modal': is_chart_modal_visible && isDesktop,
                'dashboard__chart-wrapper--safari': isSafari,
            })}
            dir='ltr'
        >
            <SmartChart
                id='dbot'
                barriers={barriers}
                showLastDigitStats={show_digits_stats}
                chartControlsWidgets={null}
                enabledChartFooter={false}
                chartStatusListener={(v: boolean) => setChartStatus(!v)}
                toolbarWidget={() => (
                    <ToolbarWidgets
                        updateChartType={updateChartType}
                        updateGranularity={updateGranularity}
                        position={!isDesktop ? 'bottom' : 'top'}
                        isDesktop={isDesktop}
                    />
                )}
                chartType={chart_type}
                isMobile={isMobile}
                enabledNavigationWidget={isDesktop}
                granularity={granularity}
                requestAPI={requestAPI}
                requestForget={requestForgetStream}
                requestForgetStream={requestForgetStream}
                requestSubscribe={requestSubscribe}
                settings={settings}
                symbol={symbol}
                topWidgets={() => <ChartTitle onChange={onSymbolChange} />}
                isConnectionOpened={is_connection_opened}
                getMarketsOrder={getMarketsOrder}
                isLive
                leftMargin={80}
            />
        </div>
    );
});

export default Chart;
