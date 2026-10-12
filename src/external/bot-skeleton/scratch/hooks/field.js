import { runInvisibleEvents } from '../utils';

window.Blockly.FieldDropdown.prototype.updateOptions = function (dropdown_options, options = {}) {
    if (window.Blockly.DropDownDiv.isVisible()) {
        window.Blockly.DropDownDiv.hideWithoutAnimation();
    }

    const unavailable_options = !dropdown_options?.length || dropdown_options.some(option => option?.[1] === 'na');
    const fallback_options = {
        MARKET_LIST: [
            ['Derived', 'derived'],
            ['Stock Indices', 'stock_indices'],
            ['Cryptocurrencies', 'cryptocurrency'],
            ['Forex', 'forex'],
            ['Commodities', 'commodities'],
        ],
        SUBMARKET_LIST: [
            ['Continuous Indices', 'continuous_indices'],
            ['Crash/Boom Indices', 'crash_boom'],
            ['Jump Indices', 'jump_indices'],
            ['Range Break Indices', 'range_break'],
            ['Daily Reset Indices', 'daily_reset_indices'],
            ['Forex Basket', 'forex_basket'],
            ['Commodities Basket', 'commodity_basket'],
            ['Step Indices', 'step_indices'],
        ],
        SYMBOL_LIST: [
            ['Volatility 10 Index', 'R_10'],
            ['Volatility 10 (1s) Index', '1HZ10V'],
            ['Volatility 25 Index', 'R_25'],
            ['Volatility 25 (1s) Index', '1HZ25V'],
            ['Volatility 30 Index', 'R_30'],
            ['Volatility 30 (1s) Index', '1HZ30V'],
            ['Volatility 50 Index', 'R_50'],
            ['Volatility 50 (1s) Index', '1HZ50V'],
            ['Volatility 75 Index', 'R_75'],
            ['Volatility 75 (1s) Index', '1HZ75V'],
            ['Volatility 90 Index', 'R_90'],
            ['Volatility 90 (1s) Index', '1HZ90V'],
            ['Volatility 100 Index', 'R_100'],
            ['Volatility 100 (1s) Index', '1HZ100V'],
        ],
        TRADETYPECAT_LIST: [
            ['High/Low', 'high_low'],
            ['Digits', 'digits'],
            ['Multipliers', 'multipliers'],
        ],
        TRADETYPE_LIST: [
            ['Over', 'over'],
            ['Under', 'under'],
            ['Equals', 'equals'],
        ],
        CONTRACTTYPE_LIST: [
            ['Both', 'both'],
            ['Rise', 'CALL'],
            ['Fall', 'PUT'],
        ],
        PURCHASE_LIST: [
            ['Purchase', 'purchase'],
            ['Call', 'CALL'],
            ['Put', 'PUT'],
        ],
    };
    if (unavailable_options && fallback_options[this.name]) {
        dropdown_options = fallback_options[this.name];
    }
    this.menuGenerator_ = dropdown_options;

    // Blockly won't actually fire an event if the oldValue and newValue are the same. This prop
    // sets the event's oldValue to an empty string so it's always executed.
    let previous_value = this.getValue();

    if (options.should_pretend_empty) {
        previous_value = '';
    }

    // Set a flag indicating whether the default value passed to this function is available in the newly
    // set dropdown options, if false the default option will be the first available one.
    const has_default_value = dropdown_options.findIndex(item => item[1] === options.default_value) !== -1;

    runInvisibleEvents(() => {
        //kept this commented to remove console errors
        //this.setValue('');

        if (has_default_value) {
            this.setValue(options.default_value);
        } else if (dropdown_options.length > 0) {
            // Default to first if option isn't available.
            this.setValue(this.menuGenerator_[0][1]);
        } else if (options.default_value !== undefined && options.default_value !== '') {
            // Keep the XML value while live metadata is unavailable; restore it when options arrive.
            this.setValue(options.default_value);
        } else {
            this.setValue(previous_value);
        }
    });

    // Silent refreshes must not trigger dependent dropdown updates.
    if (options.should_trigger_event !== false) {
        const event = new window.Blockly.Events.BlockChange(
            this.sourceBlock_,
            'field',
            this.name,
            previous_value,
            this.getValue()
        );
        event.recordUndo = false;
        event.group = options.event_group;
        window.Blockly.Events.fire(event);
    }
};
