import { localize } from '@deriv-com/translations';
import ApiHelpers from '../../../../services/api/api-helpers';
import DBotStore from '../../../dbot-store';
import { excludeOptionFromContextMenu, modifyContextMenu, runIrreversibleEvents } from '../../../utils';
/* eslint-disable */
window.Blockly.Blocks.trade_definition_market = {
    init() {
        this.jsonInit({
            message0: localize(
                '{{ manual_digit_toggle }} {{ manual_digit }} Market: {{ input_market }} > {{ input_submarket }} > {{ input_symbol }}',
                {
                    manual_digit_toggle: '%1',
                    manual_digit: '%2',
                    input_market: '%3',
                    input_submarket: '%4',
                    input_symbol: '%5',
                }
            ),
            args0: [
                {
                    type: 'field_checkbox',
                    name: 'MANUAL_DIGIT_ENABLED',
                    checked: false,
                    class: 'manualDigitToggle',
                },
                {
                    type: 'field_number',
                    name: 'MANUAL_DIGIT',
                    value: 0,
                    min: 0,
                    max: 9,
                    precision: 1,
                    class: 'manualDigitInput',
                },
                {
                    type: 'field_dropdown',
                    name: 'MARKET_LIST',
                    options: [['', '']],
                },
                {
                    type: 'field_dropdown',
                    name: 'SUBMARKET_LIST',
                    options: [['', '']],
                },
                {
                    type: 'field_dropdown',
                    name: 'SYMBOL_LIST',
                    options: [['', '']],
                },
            ],
            colour: window.Blockly.Colours.Special1.colour,
            colourSecondary: window.Blockly.Colours.Special1.colourSecondary,
            colourTertiary: window.Blockly.Colours.Special1.colourTertiary,
            previousStatement: null,
            nextStatement: null,
        });

        this.setMovable(false);
        this.setDeletable(false);
        this.getField('MANUAL_DIGIT').setVisible(false);
    },
    customContextMenu(menu) {
        const menu_items = [localize('Enable Block'), localize('Disable Block')];
        excludeOptionFromContextMenu(menu, menu_items);
        modifyContextMenu(menu);
    },
    onchange(event) {
        const allowed_events = ['BLOCK_CREATE', 'BLOCK_CHANGE', 'BLOCK_DRAG'];
        const is_allowed_event =
            allowed_events.findIndex(event_name => event.type === window.Blockly.Events[event_name]) !== -1;

        if (
            !this.workspace ||
            window.Blockly.derivWorkspace.isFlyoutVisible ||
            this.workspace.isDragging() ||
            !is_allowed_event
        ) {
            return;
        }

        this.enforceLimitations();

        const { active_symbols } = ApiHelpers?.instance ?? {};
        if (!active_symbols) return;

        const manual_digit_toggle = this.getField('MANUAL_DIGIT_ENABLED');
        const manual_digit_input = this.getField('MANUAL_DIGIT');
        const manual_digit_enabled = manual_digit_toggle?.getValue() === 'TRUE';
        manual_digit_input?.setVisible(manual_digit_enabled);
        if (manual_digit_enabled && (event.blockId === this.id || event.type === window.Blockly.Events.BLOCK_CREATE)) {
            const trade_options = this.getRootBlock()?.getChildByType('trade_definition_tradeoptions');
            const prediction_block = trade_options?.getInput('PREDICTION')?.connection?.targetBlock();
            if (prediction_block) prediction_block.setFieldValue(manual_digit_input.getValue(), 'NUM');
        }

        const market_dropdown = this.getField('MARKET_LIST');
        const submarket_dropdown = this.getField('SUBMARKET_LIST');
        const symbol_dropdown = this.getField('SYMBOL_LIST');
        const market = market_dropdown.getValue();
        const submarket = submarket_dropdown.getValue();
        const symbol = symbol_dropdown.getValue();

        const market_options = active_symbols.getMarketDropdownOptions();
        const is_unavailable = options => !options?.length || (options.length === 1 && options[0]?.[1] === 'na');
        if (!active_symbols.is_initialised || is_unavailable(market_options)) {
            Promise.resolve(active_symbols.retrieveActiveSymbols?.(true)).then(() => {
                if (this.workspace && !this.isDisposed?.()) {
                    const refreshed_markets = active_symbols.getMarketDropdownOptions();
                    const refreshed_market_value =
                        market && market !== 'na' ? market : refreshed_markets[0]?.[1] || 'synthetic_index';
                    market_dropdown.updateOptions(refreshed_markets, {
                        default_value: refreshed_market_value,
                        should_pretend_empty: true,
                        event_group: event.group,
                    });
                    const refreshed_market = market_dropdown.getValue() || refreshed_market_value;
                    const refreshed_submarkets = active_symbols.getSubmarketDropdownOptions(refreshed_market);
                    const refreshed_submarket_value =
                        submarket && submarket !== 'na' ? submarket : refreshed_submarkets[0]?.[1] || 'random_index';
                    submarket_dropdown.updateOptions(refreshed_submarkets, {
                        default_value: refreshed_submarket_value,
                        should_pretend_empty: true,
                        event_group: event.group,
                    });
                    const refreshed_submarket = submarket_dropdown.getValue() || refreshed_submarket_value;
                    const refreshed_symbols = active_symbols.getSymbolDropdownOptions(refreshed_submarket);
                    symbol_dropdown.updateOptions(refreshed_symbols, {
                        default_value: symbol && symbol !== 'na' ? symbol : refreshed_symbols[0]?.[1] || 'R_100',
                        should_pretend_empty: true,
                        event_group: event.group,
                    });
                }
            });
            return;
        }

        const populateDropdownChain = () => {
            const selected_market = market && market !== 'na' ? market : market_options[0]?.[1] || 'synthetic_index';
            market_dropdown?.updateOptions(market_options, {
                default_value: selected_market,
                should_pretend_empty: true,
                event_group: event.group,
            });

            const submarket_options = active_symbols.getSubmarketDropdownOptions(selected_market);
            const selected_submarket =
                submarket && submarket !== 'na' ? submarket : submarket_options[0]?.[1] || 'random_index';
            submarket_dropdown?.updateOptions(submarket_options, {
                default_value: selected_submarket,
                should_pretend_empty: true,
                event_group: event.group,
            });

            const symbol_options = active_symbols.getSymbolDropdownOptions(selected_submarket);
            symbol_dropdown?.updateOptions(symbol_options, {
                default_value: symbol && symbol !== 'na' ? symbol : symbol_options[0]?.[1] || 'R_100',
                should_pretend_empty: true,
                event_group: event.group,
            });
        };

        if (
            event.type === window.Blockly.Events.BLOCK_CREATE &&
            (event.ids?.includes(this.id) || event.blockId === this.id)
        ) {
            populateDropdownChain();
        } else if (event.type === window.Blockly.Events.BLOCK_CHANGE && event.blockId === this.id) {
            const changed_field = event.name || event.fieldName;
            if (changed_field === 'MARKET_LIST') {
                const next_submarket_options = active_symbols.getSubmarketDropdownOptions(market);
                const next_submarket = next_submarket_options.some(option => option[1] === submarket)
                    ? submarket
                    : next_submarket_options[0]?.[1];
                submarket_dropdown.updateOptions(next_submarket_options, {
                    default_value: next_submarket,
                    should_pretend_empty: true,
                    event_group: event.group,
                });
                const next_symbol_options = active_symbols.getSymbolDropdownOptions(next_submarket);
                symbol_dropdown.updateOptions(next_symbol_options, {
                    default_value: next_symbol_options.some(option => option[1] === symbol)
                        ? symbol
                        : next_symbol_options[0]?.[1],
                    should_pretend_empty: true,
                    event_group: event.group,
                });
            } else if (changed_field === 'SUBMARKET_LIST') {
                const next_symbol_options = active_symbols.getSymbolDropdownOptions(submarket);
                symbol_dropdown.updateOptions(next_symbol_options, {
                    default_value: next_symbol_options.some(option => option[1] === symbol)
                        ? symbol
                        : next_symbol_options[0]?.[1],
                    should_pretend_empty: true,
                    event_group: event.group,
                });
            } else if (event.name === 'SYMBOL_LIST') {
                const new_symbol = symbol_dropdown.getValue();
                DBotStore.instance.dashboard.setBotBuilderSymbol(new_symbol);
            }
        } else if (
            event.type === window.Blockly.Events.BLOCK_DRAG &&
            !event.isStart &&
            event.blockId === this.getRootBlock().id
        ) {
            if (market_dropdown.isEmpty() || submarket_dropdown.isEmpty() || symbol_dropdown.isEmpty()) {
                populateDropdownChain();
            }
        }
    },
    enforceLimitations() {
        runIrreversibleEvents(() => {
            if (!this.isDescendantOf('trade_definition')) {
                this.unplug(false); // Unplug without reconnecting siblings

                const top_blocks = this.workspace.getTopBlocks();
                const trade_definition_block = top_blocks.find(block => block.type === 'trade_definition');

                // Reconnect self to trade definition block.
                if (trade_definition_block) {
                    const connection = trade_definition_block.getLastConnectionInStatement('TRADE_OPTIONS');
                    if (connection) {
                        connection.connect(this.previousConnection);
                    }
                } else {
                    this.dispose();
                }
            }
            // These blocks cannot be disabled.
            else if (this.disabled) {
                this.setDisabled(false);
            }
        });
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.trade_definition_market = () => {};
