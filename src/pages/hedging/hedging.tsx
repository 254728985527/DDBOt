import React, { useEffect, useMemo, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { LabelPairedChevronDownSmBoldIcon } from '@deriv/quill-icons/LabelPaired';
import './hedging.scss';

type HedgeMode = 'over-under' | 'ups-downs' | 'high-low';

type TickMessage = {
    tick?: { quote?: number; symbol?: string; epoch?: number };
};

type MarketStats = {
    symbol: string;
    quotes: number[];
    digitCounts: number[];
};

const getLastDigit = (quote: number) => {
    const normalized = String(quote).replace(/[^0-9]/g, '');
    return Number(normalized.at(-1) ?? 0);
};
const scopeLimit = (value: string) => (value.startsWith('All') ? Infinity : Number(value.match(/^([1-4])/i)?.[1] ?? 1));
const thresholdValue = (value: string) => Number.parseFloat(value) || 0;

const symbols = [
    { value: 'R_10', label: 'Volatility 10 Index' },
    { value: '1HZ10V', label: 'Volatility 10 (1s) Index' },
    { value: 'R_25', label: 'Volatility 25 Index' },
    { value: '1HZ25V', label: 'Volatility 25 (1s) Index' },
    { value: 'R_30', label: 'Volatility 30 Index' },
    { value: '1HZ30V', label: 'Volatility 30 (1s) Index' },
    { value: 'R_50', label: 'Volatility 50 Index' },
    { value: '1HZ50V', label: 'Volatility 50 (1s) Index' },
    { value: 'R_75', label: 'Volatility 75 Index' },
    { value: '1HZ75V', label: 'Volatility 75 (1s) Index' },
    { value: 'R_90', label: 'Volatility 90 Index' },
    { value: '1HZ90V', label: 'Volatility 90 (1s) Index' },
    { value: 'R_100', label: 'Volatility 100 Index' },
    { value: '1HZ100V', label: 'Volatility 100 (1s) Index' },
    { value: '1HZ150V', label: 'Volatility 150 (1s) Index' },
    { value: '1HZ250V', label: 'Volatility 250 (1s) Index' },
    { value: '1HZ200V', label: 'Volatility 200 (1s) Index' },
    { value: '1HZ300V', label: 'Volatility 300 (1s) Index' },
    { value: 'BOOM300N', label: 'Boom 300 Index' },
    { value: 'BOOM500', label: 'Boom 500 Index' },
    { value: 'BOOM1000', label: 'Boom 1000 Index' },
    { value: 'CRASH300N', label: 'Crash 300 Index' },
    { value: 'CRASH500', label: 'Crash 500 Index' },
    { value: 'CRASH1000', label: 'Crash 1000 Index' },
    { value: 'RDBEAR', label: 'Bear Market Index' },
    { value: 'RDBULL', label: 'Bull Market Index' },
];

const volatilitySymbols = symbols.filter(item => item.value.startsWith('R_') || item.value.startsWith('1HZ'));

const modes: { value: HedgeMode; label: string; icon?: string }[] = [
    { value: 'over-under', label: 'Shield Over / Under Hedging' },
    { value: 'ups-downs', label: 'Only Ups / Downs', icon: '›' },
    { value: 'high-low', label: 'High / Low Tick', icon: '↯' },
];

const Hedging = observer(() => {
    const { run_panel } = useStore();
    const runIsOn = run_panel.is_running || run_panel.has_open_contract;
    const runStateRef = useRef(runIsOn);
    const previousRunState = useRef(runIsOn);
    useEffect(() => {
        runStateRef.current = runIsOn;
        if (!runIsOn && previousRunState.current) {
            tickKeysRef.current.clear();
            setTickHistory([]);
        }
        if (runIsOn && !previousRunState.current) {
            tickKeysRef.current.clear();
            setTickHistory([]);
        }
        previousRunState.current = runIsOn;
    }, [runIsOn]);
    const [mode, setMode] = useState<HedgeMode>('high-low');
    const [symbol, setSymbol] = useState('1HZ100V');
    const [target, setTarget] = useState(4);
    const [threshold, setThreshold] = useState('15%');
    const [scope, setScope] = useState('All (≥15)% Active');
    const [overStake, setOverStake] = useState('0.35');
    const [underStake, setUnderStake] = useState('0.35');
    const [martingale, setMartingale] = useState('1.23');
    const [currentLotMultiplier] = useState(1);
    const [martingaleStep] = useState(0);
    const [maxMartingaleSteps, setMaxMartingaleSteps] = useState('3');
    const [manualPrediction, setManualPrediction] = useState(false);
    const [predictionDigit, setPredictionDigit] = useState('5');
    const [quote, setQuote] = useState<number | null>(null);
    const [epoch, setEpoch] = useState<number | null>(null);
    const MAX_HEDGE_TICKS = 2;
    const [tickHistory, setTickHistory] = useState<number[]>([]);
    const tickKeysRef = useRef(new Set<string>());
    const [marketStats, setMarketStats] = useState<Record<string, MarketStats>>({});
    const [tickSubscriptionActive, setTickSubscriptionActive] = useState(false);
    const [canvasZoom, setCanvasZoom] = useState(1);
    const [canvasPan, setCanvasPan] = useState({ x: 0, y: 0 });
    const [panMode, setPanMode] = useState(true);
    const panRef = useRef({ active: false, pointerId: 0, startX: 0, startY: 0, originX: 0, originY: 0 });

    const zoomCanvas = (delta: number, focalPoint?: { x: number; y: number }) => {
        setCanvasZoom(current => {
            const next = Math.min(3, Math.max(0.25, Number((current + delta).toFixed(2))));
            if (focalPoint && next !== current) {
                const ratio = next / current;
                setCanvasPan(previous => ({
                    x: focalPoint.x - (focalPoint.x - previous.x) * ratio,
                    y: focalPoint.y - (focalPoint.y - previous.y) * ratio,
                }));
            }
            return next;
        });
    };

    const handleCanvasPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        if (
            !panMode ||
            event.button !== 0 ||
            (event.target as HTMLElement).closest('button, input, select, textarea, label')
        )
            return;
        const point = event.currentTarget.getBoundingClientRect();
        panRef.current = {
            active: true,
            pointerId: event.pointerId,
            startX: event.clientX - point.left,
            startY: event.clientY - point.top,
            originX: canvasPan.x,
            originY: canvasPan.y,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
    };

    const handleCanvasPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        const pan = panRef.current;
        if (!pan.active || pan.pointerId !== event.pointerId) return;
        const rect = event.currentTarget.getBoundingClientRect();
        setCanvasPan({
            x: pan.originX + event.clientX - rect.left - pan.startX,
            y: pan.originY + event.clientY - rect.top - pan.startY,
        });
    };

    const stopCanvasPan = (event: React.PointerEvent<HTMLDivElement>) => {
        if (panRef.current.pointerId === event.pointerId) panRef.current.active = false;
    };

    const handleCanvasWheel = (event: React.WheelEvent<HTMLDivElement>) => {
        event.preventDefault();
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.ctrlKey || event.metaKey) {
            zoomCanvas(event.deltaY < 0 ? 0.1 : -0.1, { x: event.clientX - rect.left, y: event.clientY - rect.top });
            return;
        }
        setCanvasPan(previous => ({
            x: previous.x - (event.shiftKey ? event.deltaY : event.deltaX),
            y: previous.y - (event.shiftKey ? 0 : event.deltaY),
        }));
    };

    useEffect(() => {
        setQuote(null);
        setEpoch(null);
        tickKeysRef.current.clear();
        setTickHistory([]);
        setMarketStats({});
        const publicSocket = new WebSocket('wss://api.derivws.com/trading/v1/options/ws/public');
        setTickSubscriptionActive(false);
        const handleMessage = (message: unknown) => {
            const tick = (message as TickMessage)?.tick;
            if (tick?.quote == null || !tick.symbol) return;
            const quote = Number(tick.quote);
            const tickKey = `${tick.symbol}:${tick.epoch ?? 'no-epoch'}:${quote}`;
            if (tick.symbol === symbol && tickKeysRef.current.has(tickKey)) return;
            if (tick.symbol === symbol) tickKeysRef.current.add(tickKey);
            setMarketStats(previous => {
                const current = previous[tick.symbol!] ?? {
                    symbol: tick.symbol!,
                    quotes: [],
                    digitCounts: Array(10).fill(0),
                };
                const digitCounts = [...current.digitCounts];
                digitCounts[getLastDigit(quote)] += 1;
                return {
                    ...previous,
                    [tick.symbol!]: {
                        symbol: tick.symbol!,
                        quotes: [...current.quotes, quote].slice(-60),
                        digitCounts,
                    },
                };
            });
            if (tick.symbol !== symbol) return;
            setQuote(quote);
            setEpoch(tick.epoch ?? null);
            if (runStateRef.current) {
                setTickHistory(previous => (previous.length >= MAX_HEDGE_TICKS ? previous : [...previous, quote]));
            }
        };
        publicSocket.addEventListener('open', () => {
            setTickSubscriptionActive(true);
            volatilitySymbols.forEach(item => publicSocket.send(JSON.stringify({ ticks: item.value, subscribe: 1 })));
        });
        publicSocket.addEventListener('message', event => {
            try {
                handleMessage(JSON.parse(event.data as string));
            } catch {
                // Ignore non-JSON WebSocket frames from the public gateway.
            }
        });
        publicSocket.addEventListener('close', () => setTickSubscriptionActive(false));
        publicSocket.addEventListener('error', () => setTickSubscriptionActive(false));
        return () => {
            if (publicSocket.readyState === WebSocket.OPEN) publicSocket.close(1000, 'Hedging view closed');
            setTickSubscriptionActive(false);
        };
    }, [symbol]);

    const selectedSymbol = useMemo(() => symbols.find(item => item.value === symbol) ?? symbols[0], [symbol]);
    const qualifiedMarkets = useMemo(
        () =>
            volatilitySymbols
                .map(item => {
                    const stats = marketStats[item.value];
                    const total = stats?.digitCounts.reduce((sum, count) => sum + count, 0) ?? 0;
                    const percentage = total ? ((stats?.digitCounts[target] ?? 0) / total) * 100 : 0;
                    return { ...item, percentage, qualified: total > 0 && percentage >= thresholdValue(threshold) };
                })
                .filter(item => item.qualified)
                .sort((a, b) => b.percentage - a.percentage),
        [marketStats, target, threshold]
    );
    const tradingMarkets = useMemo(() => qualifiedMarkets.slice(0, scopeLimit(scope)), [qualifiedMarkets, scope]);
    const momentum = useMemo(() => {
        const changes = tickHistory
            .slice(1)
            .map((value, index) => value - tickHistory[index])
            .filter(change => change !== 0);
        const up = changes.filter(change => change > 0).length;
        const down = changes.filter(change => change < 0).length;
        const total = up + down;
        return { up: total ? Math.round((up / total) * 100) : 50, down: total ? Math.round((down / total) * 100) : 50 };
    }, [tickHistory]);
    const formattedQuote = quote === null ? 'Waiting for price' : quote.toFixed(quote >= 100 ? 2 : 4);
    const formattedTime = epoch ? new Date(epoch * 1000).toLocaleTimeString() : 'Waiting for live tick';

    return (
        <main className='hedging-page'>
            <section className='hedging-controls' aria-label='Hedging modes'>
                {modes.map(item => (
                    <button
                        className={`hedging-select ${mode === item.value ? 'is-active' : ''}`}
                        key={item.value}
                        type='button'
                        aria-pressed={mode === item.value}
                        onClick={() => setMode(item.value)}
                    >
                        <span className='hedging-select__label'>
                            {item.icon && (
                                <span className='hedging-select__icon' aria-hidden='true'>
                                    {item.icon}
                                </span>
                            )}
                            {item.label}
                        </span>
                        <LabelPairedChevronDownSmBoldIcon
                            height='20px'
                            width='20px'
                            fill='currentColor'
                            aria-hidden='true'
                        />
                    </button>
                ))}
            </section>

            <section className='hedging-canvas' aria-label='Hedging strategy canvas'>
                <div className='hedging-canvas__toolbar'>
                    <span>Strategy canvas</span>
                    <div className='hedging-canvas__zoom' aria-label='Canvas zoom controls'>
                        <button type='button' onClick={() => zoomCanvas(-0.1)} aria-label='Zoom out'>
                            −
                        </button>
                        <output>{Math.round(canvasZoom * 100)}%</output>
                        <button type='button' onClick={() => zoomCanvas(0.1)} aria-label='Zoom in'>
                            +
                        </button>
                        <button
                            type='button'
                            onClick={() => {
                                setCanvasZoom(1);
                                setCanvasPan({ x: 0, y: 0 });
                            }}
                            aria-label='Reset view'
                        >
                            Reset view
                        </button>
                        <button
                            type='button'
                            onClick={() => {
                                setCanvasZoom(0.75);
                                setCanvasPan({ x: 0, y: 0 });
                            }}
                            aria-label='Fit canvas'
                        >
                            Fit canvas
                        </button>
                        <button
                            className={panMode ? 'is-active' : ''}
                            type='button'
                            onClick={() => setPanMode(current => !current)}
                            aria-pressed={panMode}
                            aria-label='Toggle pan mode'
                        >
                            Pan
                        </button>
                    </div>
                </div>
                <div
                    className={`hedging-canvas__viewport ${panMode ? 'is-pan-enabled' : ''}`}
                    onPointerDown={handleCanvasPointerDown}
                    onPointerMove={handleCanvasPointerMove}
                    onPointerUp={stopCanvasPan}
                    onPointerCancel={stopCanvasPan}
                    onWheel={handleCanvasWheel}
                >
                    <div
                        className='hedging-canvas__stage'
                        style={{ transform: `translate(${canvasPan.x}px, ${canvasPan.y}px) scale(${canvasZoom})` }}
                    >
                        {mode === 'over-under' && (
                            <section className='hedging-panel' aria-label='Over and under hedging setup'>
                                <div className='hedging-panel__top'>
                                    <div className='hedging-panel__title'>
                                        <span className='hedging-radio' /> TARGET DIGIT SELECTION (0 - 9):
                                    </div>
                                    <label className='hedging-market'>
                                        <span className='hedging-market__icon'>100</span>
                                        <span>
                                            <select
                                                value={symbol}
                                                onChange={event => setSymbol(event.target.value)}
                                                aria-label='Select volatility index'
                                            >
                                                {symbols.map(item => (
                                                    <option value={item.value} key={item.value}>
                                                        {item.label}
                                                    </option>
                                                ))}
                                            </select>
                                            <small>
                                                {formattedQuote} · {formattedTime}
                                            </small>
                                        </span>
                                        <span
                                            className={`hedging-live ${quote === null ? 'is-waiting' : 'hedging-live--green'}`}
                                            aria-label={
                                                tickSubscriptionActive
                                                    ? 'Subscribed to live tick WebSocket'
                                                    : 'Waiting for live tick WebSocket'
                                            }
                                        />
                                        <span className='hedging-market__status'>
                                            {quote === null
                                                ? tickSubscriptionActive
                                                    ? 'Waiting for price'
                                                    : 'Waiting for live tick subscription'
                                                : 'Live price'}
                                        </span>
                                    </label>
                                </div>

                                <div className='hedging-section'>
                                    <div className='hedging-section__heading'>
                                        <span className='hedging-radio' /> SELECT TARGET DIGIT:{' '}
                                        <small>
                                            Active: Target D{target} (
                                            {(
                                                ((marketStats[symbol]?.digitCounts[target] ?? 0) /
                                                    Math.max(
                                                        1,
                                                        marketStats[symbol]?.digitCounts.reduce(
                                                            (sum, count) => sum + count,
                                                            0
                                                        ) ?? 1
                                                    )) *
                                                100
                                            ).toFixed(1)}
                                            %)
                                        </small>
                                    </div>
                                    <div className='digit-grid'>
                                        {Array.from({ length: 10 }, (_, digit) => (
                                            <button
                                                className={`digit-button ${target === digit ? 'is-selected' : ''}`}
                                                type='button'
                                                key={digit}
                                                onClick={() => setTarget(digit)}
                                            >
                                                <strong>{digit}</strong>
                                                <span>
                                                    {(
                                                        ((marketStats[symbol]?.digitCounts[digit] ?? 0) /
                                                            Math.max(
                                                                1,
                                                                marketStats[symbol]?.digitCounts.reduce(
                                                                    (sum, count) => sum + count,
                                                                    0
                                                                ) ?? 1
                                                            )) *
                                                        100
                                                    ).toFixed(1)}
                                                    %
                                                </span>
                                                {target === digit && <em>TARGET</em>}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className='hedging-section hedging-section--threshold'>
                                    <div className='hedging-section__heading'>
                                        <span className='hedging-radio' /> CONTINUOUS TRADING POOL:{' '}
                                        <b>All Active Synthetics (2 Rotating)</b>
                                    </div>
                                    <div className='threshold-grid'>
                                        {['10%', '12%', '14%', '15%', '16%'].map(value => (
                                            <button
                                                className={`threshold-button ${threshold === value ? 'is-selected' : ''}`}
                                                type='button'
                                                key={value}
                                                onClick={() => setThreshold(value)}
                                            >
                                                <strong>{value}</strong>
                                                <span>{value === '15%' ? '2 Mkts' : '8 Markets'}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className='hedging-section'>
                                    <div className='hedging-section__heading'>
                                        <span className='hedging-radio' /> POOL TRADING SCOPE:{' '}
                                        <small>Sequential 1-Trade Continuous Rotation</small>
                                    </div>
                                    <div className='scope-grid'>
                                        {[
                                            'All (≥15)% Active',
                                            '1 Market Top 1',
                                            '2 Markets Top 2',
                                            '3 Markets Top 3',
                                            '4 Markets Top 4',
                                        ].map(value => (
                                            <button
                                                className={scope === value ? 'is-selected' : ''}
                                                type='button'
                                                key={value}
                                                onClick={() => setScope(value)}
                                            >
                                                {value}
                                            </button>
                                        ))}
                                    </div>
                                    <div className='pool-summary' aria-live='polite'>
                                        <span>
                                            QUALIFIED MARKETS <b>{qualifiedMarkets.length}</b>
                                        </span>
                                        <span>
                                            TRADING MARKETS <b>{tradingMarkets.length}</b>
                                        </span>
                                        <div>
                                            {qualifiedMarkets.map(item => (
                                                <span key={item.value}>
                                                    {item.label.replace(' Index', '')} — {item.percentage.toFixed(1)}%
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <p className='hedging-engine-hint'>
                                    Execution is controlled by the website Run button and the selected Bot Builder bot.
                                </p>

                                <div className='hedging-live-canvas' aria-label='Live market tick chart'>
                                    <LiveTickCanvas values={tickHistory} accent='#00e29b' />
                                </div>
                                <div className='trade-grid'>
                                    <div className='trade-card trade-card--over'>
                                        <div>
                                            ��<span>Trade Type</span>
                                        </div>
                                        <div>
                                            <span>Stake</span>
                                            <input
                                                value={overStake}
                                                onChange={event => setOverStake(event.target.value)}
                                                inputMode='decimal'
                                            />
                                        </div>
                                        <select aria-label='Over trade type'>
                                            <option>Over</option>
                                        </select>
                                    </div>
                                    <div className='trade-card trade-card--martingale'>
                                        <div>
                                            ▦<span>Martingale</span>
                                        </div>
                                        <input
                                            value={martingale}
                                            onChange={event => setMartingale(event.target.value)}
                                            inputMode='decimal'
                                        />
                                    </div>
                                    <div className='trade-card trade-card--under'>
                                        <div>
                                            ↻<span>Trade Type</span>
                                        </div>
                                        <div>
                                            <span>Stake</span>
                                            <input
                                                value={underStake}
                                                onChange={event => setUnderStake(event.target.value)}
                                                inputMode='decimal'
                                            />
                                        </div>
                                        <select aria-label='Under trade type'>
                                            <option>Under</option>
                                        </select>
                                    </div>
                                </div>
                                <p className='hedging-engine-hint'>
                                    Execution is controlled by the website Run button and the selected Bot Builder bot.
                                </p>
                            </section>
                        )}

                        {mode === 'ups-downs' && (
                            <section
                                className='hedging-market-mode hedging-market-mode--light'
                                aria-label='Only ups and downs hedging'
                            >
                                <HedgeControlPanel
                                    target={target}
                                    setTarget={setTarget}
                                    threshold={threshold}
                                    setThreshold={setThreshold}
                                    scope={scope}
                                    setScope={setScope}
                                    qualifiedMarkets={qualifiedMarkets}
                                    martingale={martingale}
                                    setMartingale={setMartingale}
                                    maxMartingaleSteps={maxMartingaleSteps}
                                    setMaxMartingaleSteps={setMaxMartingaleSteps}
                                    currentLotMultiplier={currentLotMultiplier}
                                    martingaleStep={martingaleStep}
                                />
                                <MarketHeader
                                    symbol={symbol}
                                    setSymbol={setSymbol}
                                    formattedQuote={formattedQuote}
                                    formattedTime={formattedTime}
                                    tickSubscriptionActive={tickSubscriptionActive}
                                />
                                <div className='direction-cards'>
                                    <DirectionCard
                                        direction='up'
                                        quote={formattedQuote}
                                        stake={overStake}
                                        setStake={setOverStake}
                                        momentum={momentum.up}
                                    />
                                    <DirectionCard
                                        direction='down'
                                        quote={formattedQuote}
                                        stake={underStake}
                                        setStake={setUnderStake}
                                        momentum={momentum.down}
                                    />
                                </div>
                                <div
                                    className='momentum-strip'
                                    aria-label={`Live momentum: Up ${momentum.up} percent, Down ${momentum.down} percent`}
                                >
                                    <div className='momentum-strip__up'>
                                        <span>↗ UP</span>
                                        <strong>{momentum.up}%</strong>
                                    </div>
                                    <div className='momentum-strip__down'>
                                        <span>↘ DOWN</span>
                                        <strong>{momentum.down}%</strong>
                                    </div>
                                </div>
                                <div className='entry-strip'>
                                    <span>
                                        ENTRY PRICE <b>{formattedQuote}</b>
                                    </span>
                                    <span>Market: {selectedSymbol.label} · Ticks sampled: 60</span>
                                </div>
                            </section>
                        )}

                        {mode === 'high-low' && (
                            <section
                                className='hedging-market-mode hedging-market-mode--light'
                                aria-label='High and low tick hedging'
                            >
                                <HedgeControlPanel
                                    target={target}
                                    setTarget={setTarget}
                                    threshold={threshold}
                                    setThreshold={setThreshold}
                                    scope={scope}
                                    setScope={setScope}
                                    qualifiedMarkets={qualifiedMarkets}
                                    martingale={martingale}
                                    setMartingale={setMartingale}
                                    maxMartingaleSteps={maxMartingaleSteps}
                                    setMaxMartingaleSteps={setMaxMartingaleSteps}
                                    currentLotMultiplier={currentLotMultiplier}
                                    martingaleStep={martingaleStep}
                                />
                                <MarketHeader
                                    symbol={symbol}
                                    setSymbol={setSymbol}
                                    formattedQuote={formattedQuote}
                                    formattedTime={formattedTime}
                                    tickSubscriptionActive={tickSubscriptionActive}
                                />
                                <div className='selected-strategy'>
                                    <small>SELECTED STRATEGY</small>
                                    <h2>High / Low Tick</h2>
                                    <span>Trade both independent hedge legs from one view.</span>
                                </div>
                                <div className='high-low-cards'>
                                    <TickCard
                                        label='High Tick'
                                        target={`Peak Target: #${manualPrediction ? predictionDigit : 5}`}
                                        stake={overStake}
                                        setStake={setOverStake}
                                        status='READY'
                                        ticks={tickHistory}
                                        manualPrediction={manualPrediction}
                                        setManualPrediction={setManualPrediction}
                                        predictionDigit={predictionDigit}
                                        setPredictionDigit={setPredictionDigit}
                                    />
                                    <TickCard
                                        label='Low Tick'
                                        target={`Valley Target: #${manualPrediction ? predictionDigit : 5}`}
                                        stake={underStake}
                                        setStake={setUnderStake}
                                        status='LOSS'
                                        ticks={tickHistory}
                                        manualPrediction={manualPrediction}
                                        setManualPrediction={setManualPrediction}
                                        predictionDigit={predictionDigit}
                                        setPredictionDigit={setPredictionDigit}
                                    />
                                </div>
                            </section>
                        )}
                    </div>
                </div>
            </section>
        </main>
    );
});

const HedgeControlPanel = ({
    target,
    setTarget,
    threshold,
    setThreshold,
    scope,
    setScope,
    qualifiedMarkets,
    martingale,
    setMartingale,
    maxMartingaleSteps,
    setMaxMartingaleSteps,
    currentLotMultiplier,
    martingaleStep,
}: {
    target: number;
    setTarget: (value: number) => void;
    threshold: string;
    setThreshold: (value: string) => void;
    scope: string;
    setScope: (value: string) => void;
    qualifiedMarkets: Array<{ value: string; label: string; percentage: number }>;
    martingale: string;
    setMartingale: (value: string) => void;
    maxMartingaleSteps: string;
    setMaxMartingaleSteps: (value: string) => void;
    currentLotMultiplier: number;
    martingaleStep: number;
}) => (
    <div className='hedge-control-panel' aria-label='Hedging qualification controls'>
        <label>
            <span>
                <b aria-hidden='true'>◉</b> SELECT TARGET DIGIT
            </span>
            <select value={target} onChange={event => setTarget(Number(event.target.value))}>
                {Array.from({ length: 10 }, (_, digit) => (
                    <option value={digit} key={digit}>
                        Target digit {digit}
                    </option>
                ))}
            </select>
        </label>
        <label>
            <span>
                <b aria-hidden='true'>▥</b> SELECT QUALIFYING THRESHOLD ON TARGET
            </span>
            <select value={threshold} onChange={event => setThreshold(event.target.value)}>
                {['10%', '12%', '14%', '15%', '16%'].map(value => (
                    <option value={value} key={value}>
                        {value} qualifying threshold
                    </option>
                ))}
            </select>
        </label>
        <label>
            <span>
                <b aria-hidden='true'>▱</b> POOL TRADING SCOPE
            </span>
            <select value={scope} onChange={event => setScope(event.target.value)}>
                {['All (≥15)% Active', '1 Market Top 1', '2 Markets Top 2', '3 Markets Top 3', '4 Markets Top 4'].map(
                    value => (
                        <option value={value} key={value}>
                            {value}
                        </option>
                    )
                )}
            </select>
        </label>
        <label className='hedge-martingale'>
            <span>
                <b aria-hidden='true'>↻</b> MARTINGALE
            </span>
            <input
                value={martingale}
                onChange={event => setMartingale(event.target.value.replace(/[^0-9.]/g, ''))}
                inputMode='decimal'
                aria-label='Martingale multiplier'
            />
            <small>
                Next lot: ×{currentLotMultiplier.toFixed(2)} · Step {martingaleStep}
            </small>
        </label>
        <label className='hedge-martingale'>
            <span>
                <b aria-hidden='true'>!</b> MAX RECOVERY STEPS
            </span>
            <input
                value={maxMartingaleSteps}
                onChange={event => setMaxMartingaleSteps(event.target.value.replace(/[^0-9]/g, ''))}
                inputMode='numeric'
                aria-label='Maximum martingale recovery steps'
            />
            <small>Cap consecutive double-loss recovery.</small>
        </label>
        <p className='hedge-control-panel__summary'>
            <b aria-hidden='true'>☷</b>
            {qualifiedMarkets.length ? (
                <>
                    <strong>
                        {qualifiedMarkets.length} qualified market{qualifiedMarkets.length === 1 ? '' : 's'}:
                    </strong>{' '}
                    {qualifiedMarkets
                        .map(item => `${item.label.replace(' Index', '')} ${item.percentage.toFixed(1)}%`)
                        .join(' · ')}
                </>
            ) : (
                'Select all three controls to build the qualified volatility pool.'
            )}
        </p>
    </div>
);

const MarketHeader = ({
    symbol,
    setSymbol,
    formattedQuote,
    formattedTime,
    tickSubscriptionActive,
}: {
    symbol: string;
    setSymbol: (value: string) => void;
    formattedQuote: string;
    formattedTime: string;
    tickSubscriptionActive: boolean;
}) => (
    <label className='hedging-market hedging-market--full'>
        <span className='hedging-market__icon'>100</span>
        <span>
            <select
                value={symbol}
                onChange={event => setSymbol(event.target.value)}
                aria-label='Select volatility index'
            >
                {symbols.map(item => (
                    <option value={item.value} key={item.value}>
                        {item.label}
                    </option>
                ))}
            </select>
            <small>
                {formattedQuote} · {formattedTime}
            </small>
        </span>
        <span
            className={`hedging-live ${formattedQuote === 'Waiting for price' ? 'is-waiting' : 'hedging-live--green'}`}
        />
        <span className='hedging-market__status'>
            {formattedQuote === 'Waiting for price'
                ? tickSubscriptionActive
                    ? 'Waiting for price'
                    : 'Waiting for live tick subscription'
                : 'Live price'}
        </span>
    </label>
);

const LiveTickCanvas = ({ values, accent }: { values: number[]; accent: string }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext('2d');
        if (!context) return;
        const ratio = window.devicePixelRatio || 1;
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        canvas.width = width * ratio;
        canvas.height = height * ratio;
        context.scale(ratio, ratio);
        context.clearRect(0, 0, width, height);
        context.strokeStyle = '#e7eef4';
        context.lineWidth = 1;
        for (let y = 12; y < height; y += 24) {
            context.beginPath();
            context.moveTo(0, y);
            context.lineTo(width, y);
            context.stroke();
        }
        if (values.length < 2) return;
        const min = Math.min(...values);
        const max = Math.max(...values);
        const range = max - min || 1;
        context.strokeStyle = accent;
        context.lineWidth = 2.5;
        context.lineJoin = 'round';
        context.beginPath();
        values.forEach((value, index) => {
            const x = (index / (values.length - 1)) * width;
            const y = height - 12 - ((value - min) / range) * (height - 24);
            index ? context.lineTo(x, y) : context.moveTo(x, y);
        });
        context.stroke();
    }, [values, accent]);
    return <canvas ref={canvasRef} className='live-tick-canvas' aria-hidden='true' />;
};

const DirectionCard = ({
    direction,
    quote,
    stake,
    setStake,
    momentum,
}: {
    direction: 'up' | 'down';
    quote: string;
    stake: string;
    setStake: (value: string) => void;
    momentum: number;
}) => (
    <article className={`direction-card direction-card--${direction}`}>
        <header>
            <div className='direction-card__identity'>
                <span className='direction-card__icon' aria-hidden='true'>
                    {direction === 'up' ? '↗' : '↘'}
                </span>
                <div>
                    <strong>{direction === 'up' ? 'ONLY UPS' : 'ONLY DOWNS'}</strong>
                    <small>
                        {direction === 'up' ? 'Continuous Rise Tick N+1 Tick N' : 'Continuous Fall Tick N+1 Tick N'}
                    </small>
                </div>
            </div>
            <div className='direction-card__badges'>
                <b>Weekly</b>
                <em>Active</em>
            </div>
        </header>
        <div className='mini-chart'>
            <strong>✓ {direction === 'up' ? 'Continuous Rise' : 'Continuous Fall'} (0/2 Ticks)</strong>
            <span className='direction-card__momentum'>
                {direction === 'up' ? 'UP' : 'DOWN'} MOMENTUM <b>{momentum}</b>
            </span>
            <svg
                viewBox='0 0 620 190'
                preserveAspectRatio='none'
                aria-label={`${direction} direction chart`}
                role='img'
            >
                <polyline points={direction === 'up' ? '45,150 310,95 565,40' : '45,40 310,95 565,150'} />
                <circle cx='45' cy={direction === 'up' ? '150' : '40'} r='7' />
                <circle className='is-middle' cx='310' cy='95' r='7' />
                <circle cx='565' cy={direction === 'up' ? '40' : '150'} r='7' />
            </svg>
            <span className='mini-chart__start'>Start</span>
            <span className='mini-chart__end'>End</span>
        </div>
        <div className='direction-stats'>
            <span>
                ENTRY SPOT
                <br />
                <b>{quote}</b>
            </span>
            <span>
                CONTRACT TYPE
                <br />
                <b>0 / 2 Ticks</b>
            </span>
            <span>
                PAYOUT
                <br />
                <b>$3.82 (95%)</b>
            </span>
        </div>
        <label>
            Stake
            <input value={stake} onChange={event => setStake(event.target.value)} inputMode='decimal' />
        </label>
        <small className='hedging-engine-hint'>Execution is controlled by the website Run button.</small>
    </article>
);

const TickCard = ({
    label,
    target,
    stake,
    setStake,
    status,
    ticks,
    manualPrediction,
    setManualPrediction,
    predictionDigit,
    setPredictionDigit,
}: {
    label: string;
    target: string;
    stake: string;
    setStake: (value: string) => void;
    status: string;
    ticks: number[];
    manualPrediction: boolean;
    setManualPrediction: (value: boolean) => void;
    predictionDigit: string;
    setPredictionDigit: (value: string) => void;
}) => {
    const [enabled, setEnabled] = useState(false);
    const is_high = label === 'High Tick';
    const chartTicks = ticks.slice(0, 5);
    const targetIndex = chartTicks.length
        ? chartTicks.reduce(
              (best, value, index, values) =>
                  is_high ? (value > values[best] ? index : best) : value < values[best] ? index : best,
              0
          )
        : -1;
    const chartMin = chartTicks.length ? Math.min(...chartTicks) : 0;
    const chartMax = chartTicks.length ? Math.max(...chartTicks) : 1;
    const chartRange = chartMax - chartMin || 1;
    const chartPoints = chartTicks
        .map(
            (value, index) =>
                `${35 + (index / Math.max(1, chartTicks.length - 1)) * 500},${155 - ((value - chartMin) / chartRange) * 105}`
        )
        .join(' ');
    const targetLabel =
        targetIndex >= 0
            ? `Tick ${targetIndex + 1}: ${is_high ? 'Highest' : 'Lowest'} Tick`
            : `${is_high ? 'Highest' : 'Lowest'} Tick`;

    return (
        <article className='tick-card'>
            <header className='tick-card__header'>
                <div>
                    <strong>{label}</strong>
                    <small>({target})</small>
                </div>
                <em className='is-ready'>{status}</em>
            </header>
            <div className={`tick-chart tick-chart--${is_high ? 'high' : 'low'}`}>
                <svg
                    className='tick-chart__svg'
                    viewBox='0 0 620 190'
                    role='img'
                    aria-label={`${label} live tick sequence`}
                    preserveAspectRatio='none'
                >
                    {chartTicks.length > 1 && <polyline className='tick-chart__path' points={chartPoints} />}
                    {chartTicks.map((value, index) => {
                        const cx = 35 + (index / Math.max(1, chartTicks.length - 1)) * 500;
                        const cy = 155 - ((value - chartMin) / chartRange) * 105;
                        return (
                            <circle
                                key={`${index}-${value}`}
                                className={`tick-chart__point ${index === targetIndex ? 'is-target' : ''}`}
                                cx={cx}
                                cy={cy}
                                r={index === targetIndex ? 11 : 4}
                            />
                        );
                    })}
                </svg>
                <span className='tick-chart__start'>Start</span>
                <span className='tick-chart__exit'>{chartTicks.length > 1 ? 'Exit Tick' : 'Waiting for tick'}</span>
                <strong className='tick-chart__target'>{targetLabel}</strong>
            </div>
            <label className='tick-card__toggle'>
                <span>
                    Manual stake<small>Set a separate stake for {label}.</small>
                </span>
                <input type='checkbox' checked={enabled} onChange={event => setEnabled(event.target.checked)} />
                <i aria-hidden='true' />
            </label>
            <input
                className='tick-card__stake'
                value={`$ ${stake}`}
                onChange={event => setStake(event.target.value.replace(/[^0-9.]/g, ''))}
                inputMode='decimal'
                aria-label={`${label} manual stake`}
            />
            <div className='tick-card__prediction'>
                <label className='tick-card__toggle'>
                    <span>
                        Prediction
                        <small>
                            {manualPrediction ? 'Manual digit used for prediction.' : 'Use automatic prediction.'}
                        </small>
                    </span>
                    <input
                        type='checkbox'
                        checked={manualPrediction}
                        onChange={event => setManualPrediction(event.target.checked)}
                    />
                    <i aria-hidden='true' />
                </label>
                {manualPrediction && (
                    <label className='tick-card__digit'>
                        Manual prediction digit
                        <select
                            value={predictionDigit}
                            onChange={event => setPredictionDigit(event.target.value)}
                            aria-label={`${label} prediction digit`}
                        >
                            {Array.from({ length: 10 }, (_, digit) => (
                                <option value={digit} key={digit}>
                                    {digit}
                                </option>
                            ))}
                        </select>
                    </label>
                )}
            </div>
            <div className='potential-payout'>
                Potential payout <b>$19.50</b>
            </div>
            <small className='tick-card__hint'>Execution is controlled by the website Run button.</small>
        </article>
    );
};

export default Hedging;
