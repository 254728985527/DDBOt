import { runInvisibleEvents } from '../utils';

window.Blockly.FieldDropdown.prototype.updateOptions = function (dropdown_options, options = {}) {
    if (window.Blockly.DropDownDiv.isVisible()) {
        window.Blockly.DropDownDiv.hideWithoutAnimation();
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
