import React from 'react';
import {
    LabelPairedChevronDownSmBoldIcon,
    LabelPairedPuzzlePieceTwoCaptionBoldIcon,
} from '@deriv/quill-icons/LabelPaired';
import './hedging.scss';

type HedgingSelectProps = {
    label: string;
    icon?: string;
};

const HedgingSelect = ({ label, icon }: HedgingSelectProps) => (
    <button className='hedging-select' type='button' aria-label={label}>
        <span className='hedging-select__label'>
            {icon && (
                <span className='hedging-select__icon' aria-hidden='true'>
                    {icon}
                </span>
            )}
            {label}
        </span>
        <LabelPairedChevronDownSmBoldIcon height='20px' width='20px' fill='var(--text-general)' aria-hidden='true' />
    </button>
);

const Hedging = () => (
    <main className='hedging-page'>
        <header className='hedging-page__header'>
            <div>
                <div className='hedging-page__eyebrow'>HEDGING TOOLS</div>
                <h1>
                    <LabelPairedPuzzlePieceTwoCaptionBoldIcon height='24px' width='24px' fill='var(--text-general)' />{' '}
                    Hedging
                </h1>
                <p>Configure simple market protection rules for your strategy.</p>
            </div>
        </header>
        <section className='hedging-controls' aria-label='Hedging controls'>
            <HedgingSelect label='Over / Under Hedging' />
            <HedgingSelect label='Only Ups / Downs' icon='↗' />
            <HedgingSelect label='High / Low Tick' icon='↯' />
        </section>
    </main>
);

export default Hedging;
