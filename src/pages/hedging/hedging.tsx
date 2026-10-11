import React, { useEffect, useMemo, useState } from 'react';
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
    { value: '1HZ100V', label: 'Volatility 100 (1s) Index' },
    { value: '1HZ50V', label: 'Volatility 50 (1s) Index' },
    { value: 'R_100', label: 'Volatility 100 Index' },
];

const modes: { value: HedgeMode; label: string; icon?: string }[] = [
    { value: 'over-under', label: 'Over / Under Hedging' },
    { value: 'ups-downs', label: 'Only Ups / Downs', icon: '↗' },
    { value: 'high-low', label: 'High / Low Tick', icon: '↯' },
];

const Hedging = () => {
    const [mode, setMode] = useState<HedgeMode>('over-under');
    const [symbol, setSymbol] = useState('1HZ100V');
    const [target, setTarget] = useState(4);
    const [threshold, setThreshold] = useState('15%');
    const [scope, setScope] = useState('All (≥15)% Active');
    const [overStake, setOverStake] = useState('0.35');
    const [underStake, setUnderStake] = useState('0.35');
    const [martingale, setMartingale] = useState('1.23');
    const [quote, setQuote] = useState<number | null>(null);
    const [epoch, setEpoch] = useState<number | null>(null);

    useEffect(() => {
        const api = api_base.api;
        if (!api) return;
        const handleMessage = (message: unknown) => {
            const tick = (message as TickMessage)?.tick;
            if (!tick?.quote || tick.symbol !== symbol) return;
            setQuote(tick.quote);
            setEpoch(tick.epoch ?? null);
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
    const formattedQuote = quote === null ? '—' : quote.toFixed(2);
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
                        <DirectionCard direction='up' quote={formattedQuote} stake={overStake} setStake={setOverStake} />
                        <DirectionCard direction='down' quote={formattedQuote} stake={underStake} setStake={setUnderStake} />
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
                        <TickCard label='High Tick' target='Peak Target: #5' stake={overStake} setStake={setOverStake} status='READY' />
                        <TickCard label='Low Tick' target='Valley Target: #5' stake={underStake} setStake={setUnderStake} status='LOSS' />
                    </div>
                </section>
            )}
        </main>
    );
};

const MarketHeader = ({ selectedSymbol, symbol, setSymbol, formattedQuote, formattedTime }: { selectedSymbol: (typeof symbols)[number]; symbol: string; setSymbol: (value: string) => void; formattedQuote: string; formattedTime: string }) => (
    <label className='hedging-market hedging-market--full'><span className='hedging-market__icon'>100</span><span><select value={symbol} onChange={event => setSymbol(event.target.value)} aria-label='Select volatility index'>{symbols.map(item => <option value={item.value} key={item.value}>{item.label}</option>)}</select><small>{formattedQuote} · {formattedTime}</small></span><span className='hedging-live hedging-live--green' /></label>
);

const DirectionCard = ({ direction, quote, stake, setStake }: { direction: 'up' | 'down'; quote: string; stake: string; setStake: (value: string) => void }) => (
    <article className={`direction-card direction-card--${direction}`}><header><span>{direction === 'up' ? '↗ ONLY UPS' : '↘ ONLY DOWNS'}</span><small>Continuous Fall/Rise (Tick N-1 &gt; Tick N)</small></header><div className='mini-chart'><span>{quote}</span><i /></div><div className='direction-stats'><span>ENTRY SPOT<br /><b>{quote}</b></span><span>CONTRACT TYPE<br /><b>0 / 2 Ticks</b></span><span>PAYOUT<br /><b>$3.82 (95%)</b></span></div><label>Stake<input value={stake} onChange={event => setStake(event.target.value)} inputMode='decimal' /></label><button type='button'>{direction === 'up' ? '▶ BUY ONLY UPS' : '▶ BUY ONLY DOWNS'} <small>Payoff: $3.82 USD (+95%)</small></button></article>
);

const TickCard = ({ label, target, stake, setStake, status }: { label: string; target: string; stake: string; setStake: (value: string) => void; status: string }) => (
    <article className='tick-card'><header><strong>{label}</strong><small>{target}</small><em className={status === 'LOSS' ? 'is-loss' : ''}>{status}</em></header><div className='tick-chart'><span>Tick 5: {label === 'High Tick' ? 'Highest' : 'Lowest'} Tick</span><i /></div><label>Manual stake<small>Set a separate stake for {label}.</small><input value={stake} onChange={event => setStake(event.target.value)} inputMode='decimal' /></label><div className='potential-payout'>Potential payout <b>$19.50</b></div><button type='button'>Run {label}</button><small>Select the strategy to configure it independently.</small></article>
);

export default Hedging;
