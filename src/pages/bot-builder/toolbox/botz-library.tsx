import React from 'react';
import { load } from '@/external/bot-skeleton';
import { useStore } from '@/hooks/useStore';
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
        name: 'SΛMUΞL Entry + Manual Com Digit',
        description: 'Entry strategy with manual digit controls.',
        category: 'Entry',
        file: 'entry-manual-com-digit.xml',
        accent: 'violet',
    },
    {
        name: 'Entry Best',
        description: 'Target-digit entry strategy with manual comparison logic.',
        category: 'Entry',
        file: 'entry-best.xml',
        accent: 'purple',
    },
    {
        name: 'Multi Hedging Tool',
        description: 'Multi-run digit strategy with recovery and hedging controls.',
        category: 'Hedging',
        file: 'multi-hedging-tool.xml',
        accent: 'slate',
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
        name: 'SΛMUΞL Target + Entry',
        description: 'Target digit and entry analysis strategy.',
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
    const { dashboard } = useStore();
    const [query, setQuery] = React.useState('');
    const [loading_file, setLoadingFile] = React.useState<string | null>(null);
    const [message, setMessage] = React.useState('');
    const [canvas_scale, setCanvasScale] = React.useState(1);

    const adjustCanvasScale = (delta: number) => {
        setCanvasScale(current => Math.min(1.5, Math.max(0.65, Number((current + delta).toFixed(2)))));
    };

    const handleCanvasWheel = (event: React.WheelEvent<HTMLDivElement>) => {
        if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            adjustCanvasScale(event.deltaY < 0 ? 0.05 : -0.05);
        }
    };

    const sanitizeXmlForWorkspace = (xml_text: string) => {
        const xml_dom = new DOMParser().parseFromString(xml_text, 'application/xml');
        if (xml_dom.querySelector('parsererror')) throw new Error('This bot contains invalid XML');
        const removed_types = new Set<string>();
        xml_dom.querySelectorAll('block').forEach(block => {
            const type = block.getAttribute('type');
            if (type && !window.Blockly.Blocks?.[type]) {
                removed_types.add(type);
                block.parentElement?.removeChild(block);
                return;
            }
            if (type === 'trade_definition_market') {
                const defaults = {
                    TARGET_DIGIT: '0',
                    QUALIFYING_THRESHOLD: '10',
                    POOL_TRADE_SCOPE: 'all_gt_15',
                    POOL_ENABLED: 'TRUE',
                };
                Object.entries(defaults).forEach(([name, value]) => {
                    if (!block.querySelector(`field[name="${name}"]`)) {
                        const field = xml_dom.createElement('field');
                        field.setAttribute('name', name);
                        field.textContent = value;
                        block.appendChild(field);
                    }
                });
            }
        });
        return {
            xml_text: new XMLSerializer().serializeToString(xml_dom),
            removed_types: [...removed_types],
        };
    };

    const loadBot = async (strategy: BotzStrategy) => {
        setLoadingFile(strategy.file);
        setMessage('');
        try {
            const response = await fetch(`/botz/${strategy.file}`);
            if (!response.ok) throw new Error('Unable to load strategy');
            const raw_xml_text = await response.text();
            const { xml_text, removed_types } = sanitizeXmlForWorkspace(raw_xml_text);
            dashboard.setActiveTab(1);
            const load_started_at = Date.now();
            let workspace = window.Blockly?.derivWorkspace;
            while (!workspace && Date.now() - load_started_at < 5000) {
                await new Promise(resolve => window.setTimeout(resolve, 100));
                workspace = window.Blockly?.derivWorkspace;
            }
            if (!workspace || !window.Blockly?.Xml) throw new Error('Bot Builder is still loading');
            await load({
                block_string: xml_text,
                file_name: strategy.name,
                workspace,
                drop_event: {},
                strategy_id: null,
                from: 'botz',
                showIncompatibleStrategyDialog: false,
                show_snackbar: false,
            });
            workspace.strategy_to_load = xml_text;
            if (removed_types.length) {
                setMessage(
                    `Loaded with ${removed_types.length} unsupported block type${removed_types.length === 1 ? '' : 's'} removed.`
                );
            }
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
                <div className='botz-library__zoom' aria-label='Botz canvas zoom controls'>
                    <button type='button' onClick={() => adjustCanvasScale(-0.1)} aria-label='Zoom out'>
                        −
                    </button>
                    <output>{Math.round(canvas_scale * 100)}%</output>
                    <button type='button' onClick={() => adjustCanvasScale(0.1)} aria-label='Zoom in'>
                        +
                    </button>
                    <button type='button' onClick={() => setCanvasScale(1)} aria-label='Reset zoom'>
                        Reset
                    </button>
                </div>
            </div>
            {message && (
                <div className='botz-library__message' role='alert'>
                    {message}
                </div>
            )}
            <div
                className='botz-library__canvas'
                onWheel={handleCanvasWheel}
                aria-label='Scrollable Botz strategy canvas'
            >
                <div className='botz-library__grid' style={{ transform: `scale(${canvas_scale})` }}>
                    {filtered_strategies.map(strategy => (
                        <article className={`botz-card botz-card--${strategy.accent}`} key={strategy.file}>
                            <div className='botz-card__topline'>
                                <span>{strategy.category}</span>
                                <span className='botz-card__dot' />
                            </div>
                            <div className='botz-card__content'>
                                <h3>{strategy.name}</h3>
                                <p>{strategy.description}</p>
                            </div>
                            <button type='button' onClick={() => loadBot(strategy)} disabled={loading_file !== null}>
                                {loading_file === strategy.file ? 'Loading…' : 'Open in Builder'}
                            </button>
                        </article>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default BotzLibrary;
