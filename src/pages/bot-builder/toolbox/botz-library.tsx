import React from 'react';
import './botz-library.scss';

type BotzStrategy = {
    name: string;
    description: string;
    category: string;
    file: string;
    accent: string;
};

const BOTZ_STRATEGIES: BotzStrategy[] = [
    {
        name: 'Entry + Manual Digit',
        description: 'Manual digit confirmation with structured entry rules.',
        category: 'Entry',
        file: 'entry-manual-com-digit.xml',
        accent: 'violet',
    },
    {
        name: 'Cash Printer Original',
        description: 'A compact digit-over strategy with stake recovery.',
        category: 'Digits',
        file: 'cash-printer-original.xml',
        accent: 'cyan',
    },
    {
        name: 'Digits Over 4 Martingale PRO',
        description: 'Digit-over setup with progressive stake management.',
        category: 'Recovery',
        file: 'digits-over-4-martingale.xml',
        accent: 'amber',
    },
    {
        name: 'Entry Best',
        description: 'Entry-focused bot configuration for synthetic indices.',
        category: 'Entry',
        file: 'entry-best.xml',
        accent: 'emerald',
    },
    {
        name: 'Over 2 Strategy PRO+',
        description: 'A high-confidence over-two pattern with analysis blocks.',
        category: 'Digits',
        file: 'over-2-strategy-pro.xml',
        accent: 'blue',
    },
    {
        name: 'Over 2 Strategy + Entry',
        description: 'Combines over-two logic with an entry filter.',
        category: 'Entry',
        file: 'over-2-strategy-entry.xml',
        accent: 'rose',
    },
    {
        name: 'Target + Entry',
        description: 'Target digit tracking with a clear entry sequence.',
        category: 'Analysis',
        file: 'target-entry.xml',
        accent: 'indigo',
    },
    {
        name: 'PCT Operator Manual COMP',
        description: 'Percentage operator analysis with manual comparison controls.',
        category: 'Analysis',
        file: 'pct-operator-manual-comp.xml',
        accent: 'teal',
    },
];

type BotzLibraryProps = { onClose?: () => void; embedded?: boolean };

const BotzLibrary = ({ onClose = () => undefined, embedded = false }: BotzLibraryProps) => {
    const [query, setQuery] = React.useState('');
    const [loading_file, setLoadingFile] = React.useState<string | null>(null);
    const [message, setMessage] = React.useState('');

    const loadBot = async (strategy: BotzStrategy) => {
        setLoadingFile(strategy.file);
        setMessage('');
        try {
            const response = await fetch(`/botz/${strategy.file}`);
            if (!response.ok) throw new Error('Unable to load strategy');
            const xml_text = await response.text();
            const workspace = window.Blockly?.derivWorkspace;
            if (!workspace || !window.Blockly?.Xml) throw new Error('Bot Builder is still loading');
            workspace.clear();
            const xml_dom = window.Blockly.Xml.textToDom(xml_text);
            window.Blockly.Xml.domToWorkspace(xml_dom, workspace);
            onClose();
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Unable to load this bot');
        } finally {
            setLoadingFile(null);
        }
    };

    const filtered_strategies = BOTZ_STRATEGIES.filter(strategy =>
        `${strategy.name} ${strategy.description} ${strategy.category}`.toLowerCase().includes(query.toLowerCase())
    );

    return (
        <div
            className={`botz-library${embedded ? ' botz-library--embedded' : ''}`}
            role={embedded ? undefined : 'dialog'}
            aria-modal={embedded ? undefined : 'true'}
            aria-labelledby='botz-library-title'
        >
            <div className='botz-library__header'>
                <div>
                    <div className='botz-library__eyebrow'>STRATEGY LIBRARY</div>
                    <h2 id='botz-library-title'>Botz</h2>
                    <p>Import a ready-made strategy into your workspace.</p>
                </div>
                <button className='botz-library__close' type='button' onClick={onClose} aria-label='Close Botz library'>
                    ×
                </button>
            </div>
            <div className='botz-library__toolbar'>
                <input
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                    placeholder='Search strategies'
                    aria-label='Search Botz strategies'
                />
                <span>{filtered_strategies.length} strategies</span>
            </div>
            {message && (
                <div className='botz-library__message' role='alert'>
                    {message}
                </div>
            )}
            <div className='botz-library__grid'>
                {filtered_strategies.map(strategy => (
                    <article className={`botz-card botz-card--${strategy.accent}`} key={strategy.file}>
                        <div className='botz-card__topline'>
                            <span>{strategy.category}</span>
                            <span className='botz-card__dot' />
                        </div>
                        <h3>{strategy.name}</h3>
                        <p>{strategy.description}</p>
                        <button type='button' onClick={() => loadBot(strategy)} disabled={loading_file !== null}>
                            {loading_file === strategy.file ? 'Loading…' : 'Open in Builder'}
                        </button>
                    </article>
                ))}
            </div>
        </div>
    );
};

export default BotzLibrary;
