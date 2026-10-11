import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api_base } from '@/external/bot-skeleton';
import {
    LabelPairedChevronDownSmBoldIcon,
    LabelPairedPuzzlePieceTwoCaptionBoldIcon,
} from '@deriv/quill-icons/LabelPaired';
import './hedging.scss';

type HedgeMode = 'over-under' | 'ups-downs' | 'high-low';

type TickMessage = {
    tick?: { quote?: number; symbol?: string; epoch?: number };
};

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

const modes: { value: HedgeMode; label: string; icon?: string }[] = [
    { value: 'over-under', label: 'Shield Over / Under Hedging' },
    { value: 'ups-downs', label: 'Only Ups / Downs', icon: '›' },
    { value: 'high-low', label: 'High / Low Tick', icon: '↯' },
];

const Hedging = () => {
    const [mode, setMode] = useState<HedgeMode>('high-low');
    const [symbol, setSymbol] = useState('1HZ100V');
    const [target, setTarget] = useState(4);
    const [threshold, setThreshold] = useState('15%');
    const [scope, setScope] = useState('All (≥15)% Active');
    const [overStake, setOverStake] = useState('0.35');
    const [underStake, setUnderStake] = useState('0.35');
    const [martingale, setMartingale] = useState('1.23');
    const [quote, setQuote] = useState<number | null>(null);
    const [epoch, setEpoch] = useState<number | null>(null);
    const [tickHistory, setTickHistory] = useState<number[]>([]);
    const [tradeSession, setTradeSession] = useState<{ leg: string; ticks: number[]; total: number } | null>(null);

    useEffect(() => {
        setQuote(null);
        setEpoch(null);
        setTickHistory([]);
        setTradeSession(null);
        const api = api_base.api;
        if (!api) return;
        const handleMessage = (message: unknown) => {
            const tick = (message as TickMessage)?.tick;
            if (!tick?.quote || tick.symbol !== symbol) return;
            setQuote(tick.quote);
            setEpoch(tick.epoch ?? null);
            setTickHistory(previous => {
                const next = [...previous, tick.quote as number].slice(-60);
                setTradeSession(session => {
                    if (!session) return session;
                    const session_ticks = [...session.ticks, tick.quote as number].slice(-session.total);
                    return session_ticks.length >= session.total ? { ...session, ticks: session_ticks } : { ...session, ticks: session_ticks };
                });
                return next;
            });
        };
        const stream = api.onMessage?.();
        const subscription = stream?.subscribe(handleMessage);
        api.send({ ticks: symbol, subscribe: 1 });
        return () => {
            subscription?.unsubscribe();
            api.send({ forget_all: 'ticks' });
        };
    }, [symbol]);

    const selectedSymbol = useMemo(() => symbols.find(item => item.value === symbol) ?? symbols[0], [symbol]);
    const formattedQuote = quote === null ? 'Waiting for price' : quote.toFixed(quote >= 100 ? 2 : 4);
    const formattedTime = epoch ? new Date(epoch * 1000).toLocaleTimeString() : 'Waiting for live tick';
    const startTrade = (leg: string, total: number) => {
        setTradeSession({ leg, ticks: [], total });
    };
    const sessionTicks = tradeSession?.ticks ?? [];

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
                            {item.icon && <span className='hedging-select__icon' aria-hidden='true'>{item.icon}</span>}
                            {item.label}
                        </span>
                        <LabelPairedChevronDownSmBoldIcon height='20px' width='20px' fill='currentColor' aria-hidden='true' />
                    </button>
                ))}
            </section>

            {mode === 'over-under' && (
                <section className='hedging-panel' aria-label='Over and under hedging setup'>
                    <div className='hedging-panel__top'>
                        <div className='hedging-panel__title'><span className='hedging-radio' /> TARGET DIGIT SELECTION (0 - 9):</div>
                        <label className='hedging-market'>
                            <span className='hedging-market__icon'>100</span>
                            <span>
                                <select value={symbol} onChange={event => setSymbol(event.target.value)} aria-label='Select volatility index'>
                                    {symbols.map(item => <option value={item.value} key={item.value}>{item.label}</option>)}
                                </select>
                                <small>{formattedQuote} · {formattedTime}</small>
                            </span>
                            <span className='hedging-live' aria-label='Live tick connection' />
                        </label>
                    </div>

                    <div className='hedging-section'>
                        <div className='hedging-section__heading'><span className='hedging-radio' /> SELECT TARGET DIGIT: <small>Active: Target D{target} ({target === 4 ? '8.0%' : '10.0%'})</small></div>
                        <div className='digit-grid'>
                            {Array.from({ length: 10 }, (_, digit) => (
                                <button className={`digit-button ${target === digit ? 'is-selected' : ''}`} type='button' key={digit} onClick={() => setTarget(digit)}>
                                    <strong>{digit}</strong><span>{digit === 4 ? '8.0%' : digit === 6 ? '15.0%' : '11.0%'}</span>{target === digit && <em>TARGET</em>}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className='hedging-section hedging-section--threshold'>
                        <div className='hedging-section__heading'><span className='hedging-radio' /> CONTINUOUS TRADING POOL: <b>All Active Synthetics (2 Rotating)</b></div>
                        <div className='threshold-grid'>
                            {['10%', '12%', '14%', '15%', '16%'].map(value => <button className={`threshold-button ${threshold === value ? 'is-selected' : ''}`} type='button' key={value} onClick={() => setThreshold(value)}><strong>{value}</strong><span>{value === '15%' ? '2 Mkts' : '8 Markets'}</span></button>)}
                        </div>
                    </div>

                    <div className='hedging-section'>
                        <div className='hedging-section__heading'><span className='hedging-radio' /> POOL TRADING SCOPE: <small>Sequential 1-Trade Continuous Rotation</small></div>
                        <div className='scope-grid'>{['All (≥15)% Active', '1 Market Top 1', '2 Markets Top 2', '3 Markets Top 3', '4 Markets Top 4'].map(value => <button className={scope === value ? 'is-selected' : ''} type='button' key={value} onClick={() => setScope(value)}>{value}</button>)}</div>
                    </div>

                    <div className='hedging-live-canvas' aria-label='Live market tick chart'><LiveTickCanvas values={tickHistory} accent='#00e29b' /></div>
                    <div className='trade-grid'>
                        <div className='trade-card trade-card--over'><div>↕<span>Trade Type</span></div><div><span>Stake</span><input value={overStake} onChange={event => setOverStake(event.target.value)} inputMode='decimal' /></div><select aria-label='Over trade type'><option>Over</option></select></div>
                        <div className='trade-card trade-card--martingale'><div>▦<span>Martingale</span></div><input value={martingale} onChange={event => setMartingale(event.target.value)} inputMode='decimal' /></div>
                        <div className='trade-card trade-card--under'><div>↻<span>Trade Type</span></div><div><span>Stake</span><input value={underStake} onChange={event => setUnderStake(event.target.value)} inputMode='decimal' /></div><select aria-label='Under trade type'><option>Under</option></select></div>
                    </div>
                    <button className='hedging-trade-button' type='button'>Ready to trade Over + Under on tick D{target}</button>
                </section>
            )}

            {mode === 'ups-downs' && (
                <section className='hedging-market-mode hedging-market-mode--light' aria-label='Only ups and downs hedging'>
                    <MarketHeader selectedSymbol={selectedSymbol} symbol={symbol} setSymbol={setSymbol} formattedQuote={formattedQuote} formattedTime={formattedTime} />
                    <div className='direction-cards'>
                        <DirectionCard direction='up' quote={formattedQuote} stake={overStake} setStake={setOverStake} ticks={tradeSession?.leg === 'up' ? sessionTicks : []} onBuy={() => startTrade('up', 2)} />
                        <DirectionCard direction='down' quote={formattedQuote} stake={underStake} setStake={setUnderStake} ticks={tradeSession?.leg === 'down' ? sessionTicks : []} onBuy={() => startTrade('down', 2)} />
                    </div>
                    <div className='entry-strip'><span>ENTRY PRICE <b>{formattedQuote}</b></span><span>Market: {selectedSymbol.label} · Ticks sampled: 60</span></div>
                    <div className='probability-row'><div>↗ UP <strong>36%</strong></div><div>↘ DOWN <strong>64%</strong></div></div>
                </section>
            )}

            {mode === 'high-low' && (
                <section className='hedging-market-mode hedging-market-mode--light' aria-label='High and low tick hedging'>
                    <MarketHeader selectedSymbol={selectedSymbol} symbol={symbol} setSymbol={setSymbol} formattedQuote={formattedQuote} formattedTime={formattedTime} />
                    <div className='selected-strategy'><small>SELECTED STRATEGY</small><h2>High / Low Tick</h2><span>Trade both independent hedge legs from one view.</span></div>
                    <div className='high-low-cards'>
                        <TickCard label='High Tick' target='Peak Target: #5' stake={overStake} setStake={setOverStake} status='READY' ticks={tradeSession?.leg === 'high' ? sessionTicks : []} onRun={() => startTrade('high', 5)} />
                        <TickCard label='Low Tick' target='Valley Target: #5' stake={underStake} setStake={setUnderStake} status='LOSS' ticks={tradeSession?.leg === 'low' ? sessionTicks : []} onRun={() => startTrade('low', 5)} />
                    </div>
                </section>
            )}
        </main>
    );
};

const MarketHeader = ({ selectedSymbol, symbol, setSymbol, formattedQuote, formattedTime }: { selectedSymbol: (typeof symbols)[number]; symbol: string; setSymbol: (value: string) => void; formattedQuote: string; formattedTime: string }) => (
    <label className='hedging-market hedging-market--full'><span className='hedging-market__icon'>100</span><span><select value={symbol} onChange={event => setSymbol(event.target.value)} aria-label='Select volatility index'>{symbols.map(item => <option value={item.value} key={item.value}>{item.label}</option>)}</select><small>{formattedQuote} · {formattedTime}</small></span><span className='hedging-live hedging-live--green' /></label>
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
        for (let y = 12; y < height; y += 24) { context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke(); }
        if (values.length < 2) return;
        const min = Math.min(...values); const max = Math.max(...values); const range = max - min || 1;
        context.strokeStyle = accent; context.lineWidth = 2.5; context.lineJoin = 'round'; context.beginPath();
        values.forEach((value, index) => { const x = (index / (values.length - 1)) * width; const y = height - 12 - ((value - min) / range) * (height - 24); index ? context.lineTo(x, y) : context.moveTo(x, y); });
        context.stroke();
    }, [values, accent]);
    return <canvas ref={canvasRef} className='live-tick-canvas' aria-hidden='true' />;
};

const DirectionCard = ({ direction, quote, stake, setStake, ticks, onBuy }: { direction: 'up' | 'down'; quote: string; stake: string; setStake: (value: string) => void; ticks: number[]; onBuy: () => void }) => (
    <article className={`direction-card direction-card--${direction}`}><header><span>{direction === 'up' ? '↗ ONLY UPS' : '↘ ONLY DOWNS'}</span><small>{ticks.length ? `Live trade: ${ticks.length}/2 ticks` : 'Buy to start a 2-tick trade'}</small></header><div className='mini-chart'><LiveTickCanvas values={ticks} accent={direction === 'up' ? '#08ad75' : '#2479ef'} /><span>{ticks.length ? ticks.map(value => value.toFixed(2)).join(' → ') : quote}</span><i /></div><div className='direction-stats'><span>ENTRY SPOT<br /><b>{quote}</b></span><span>CONTRACT TYPE<br /><b>0 / 2 Ticks</b></span><span>PAYOUT<br /><b>$3.82 (95%)</b></span></div><label>Stake<input value={stake} onChange={event => setStake(event.target.value)} inputMode='decimal' /></label><button type='button' onClick={onBuy} disabled={ticks.length > 0 && ticks.length < 2}>{ticks.length >= 2 ? '✓ TRADE COMPLETE' : direction === 'up' ? '▶ BUY ONLY UPS (2 TICKS)' : '▶ BUY ONLY DOWNS (2 TICKS)'} <small>{ticks.length ? `${ticks.length}/2 incoming ticks` : 'Payoff: $3.82 USD (+95%)'}</small></button></article>
);

const TickCard = ({ label, target, stake, setStake, status, ticks, onRun }: { label: string; target: string; stake: string; setStake: (value: string) => void; status: string; ticks: number[]; onRun: () => void }) => {
    const [enabled, setEnabled] = useState(false);
    const is_high = label === 'High Tick';

    return (
        <article className='tick-card'>
            <header className='tick-card__header'>
                <div><strong>{label}</strong><small>({target})</small></div>
                <em className='is-ready'>READY</em>
            </header>
            <div className={`tick-chart tick-chart--${is_high ? 'high' : 'low'}`}>
                <svg className='tick-chart__svg' viewBox='0 0 620 190' role='img' aria-label={`${label} five tick path`} preserveAspectRatio='none'>
                    <line className='tick-chart__target-line' x1='0' y1={is_high ? '92' : '112'} x2='620' y2={is_high ? '92' : '112'} />
                    <polyline className='tick-chart__path' points={is_high ? '35,145 175,88 275,135 400,58 535,150' : '35,62 175,115 275,70 400,132 535,42'} />
                    { (is_high ? [[35,145],[175,88],[275,135],[400,58],[535,150]] : [[35,62],[175,115],[275,70],[400,132],[535,42]]).map(([cx, cy], index) => <circle key={index} className={`tick-chart__point ${index === 3 ? 'is-target' : ''}`} cx={cx} cy={cy} r={index === 3 ? 11 : 6} />) }
                </svg>
                <span className='tick-chart__start'>Start</span><span className='tick-chart__exit'>Exit Tick</span><strong className='tick-chart__target'>{is_high ? 'Tick 5: Highest Tick' : 'Tick 5: Lowest Tick'}</strong>
            </div>
            <label className='tick-card__toggle'>
                <span>Manual stake<small>Set a separate stake for {label}.</small></span>
                <input type='checkbox' checked={enabled} onChange={event => setEnabled(event.target.checked)} />
                <i aria-hidden='true' />
            </label>
            <input className='tick-card__stake' value={`$ ${stake}`} onChange={event => setStake(event.target.value.replace(/[^0-9.]/g, ''))} inputMode='decimal' aria-label={`${label} manual stake`} />
            <div className='potential-payout'>Potential payout <b>$19.50</b></div>
            <button className='tick-card__run' type='button' disabled={!enabled || (ticks.length > 0 && ticks.length < 5)} onClick={onRun}>{ticks.length >= 5 ? `✓ ${label} complete` : ticks.length ? `Running ${label}: ${ticks.length}/5 ticks` : `Run ${label} (5 ticks)`}</button>
            <small className='tick-card__hint'>Select the strategy to configure it independently.</small>
        </article>
    );
};

export default Hedging;
