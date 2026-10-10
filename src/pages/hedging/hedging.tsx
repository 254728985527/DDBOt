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

            {mode !== 'over-under' && <section className='hedging-placeholder'><h2>{modes.find(item => item.value === mode)?.label}</h2><p>Select this mode to configure its hedging rules.</p></section>}
        </main>
    );
};

export default Hedging;
