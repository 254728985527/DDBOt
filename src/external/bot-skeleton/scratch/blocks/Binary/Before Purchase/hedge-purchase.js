import { localize } from '@deriv-com/translations';

const colours = () => ({
    colour: window.Blockly.Colours.Special1.colour,
    colourSecondary: window.Blockly.Colours.Special1.colourSecondary,
    colourTertiary: window.Blockly.Colours.Special1.colourTertiary,
});

const numberField = (name, value = '0.35') => ({ type: 'field_number', name, value, min: 0, precision: 0.01 });

const registerHedgePurchase = (type, title, args0, generator) => {
    window.Blockly.Blocks[type] = {
        init() {
            this.jsonInit({
                message0: title,
                args0,
                previousStatement: null,
                nextStatement: null,
                ...colours(),
                tooltip: localize('Purchase two hedge contracts with independent stakes.'),
                category: window.Blockly.Categories.Before_Purchase,
            });
        },
        meta() {
            return {
                display_name: localize(title),
                description: localize('Purchase both selected hedge contracts in sequence with separate stakes.'),
            };
        },
        restricted_parents: ['before_purchase'],
    };
    window.Blockly.JavaScript.javascriptGenerator.forBlock[type] = generator;
};

registerHedgePurchase(
    'rise_fall_hedge_purchase',
    'RISE/FALL Hedge purchase  Purchase 1: %1  Purchase 2: %2',
    [
        {
            type: 'field_dropdown',
            name: 'PURCHASE_1',
            options: [
                ['Rise', 'CALL'],
                ['Fall', 'PUT'],
            ],
        },
        {
            type: 'field_dropdown',
            name: 'PURCHASE_2',
            options: [
                ['Rise', 'CALL'],
                ['Fall', 'PUT'],
            ],
        },
    ],
    block =>
        `Bot.purchase('${block.getFieldValue('PURCHASE_1')}');\\nBot.purchase('${block.getFieldValue('PURCHASE_2')}');\\n`
);

registerHedgePurchase(
    'higher_lower_hedge_purchase',
    'HIGHER/LOWER Hedge purchase  Purchase 1: %1  Barrier: %2 %3 %4  stake 1: %5  Purchase 2: %6  Barrier: %7 %8 %9  stake 2: %10',
    [
        {
            type: 'field_dropdown',
            name: 'PURCHASE_1',
            options: [
                ['Higher', 'HIGHER'],
                ['Lower', 'LOWER'],
            ],
        },
        { type: 'field_label', text: 'Offset' },
        {
            type: 'field_dropdown',
            name: 'BARRIER_1',
            options: [
                ['+', 'PLUS'],
                ['-', 'MINUS'],
            ],
        },
        numberField('OFFSET_1', '0.31'),
        numberField('STAKE_1'),
        {
            type: 'field_dropdown',
            name: 'PURCHASE_2',
            options: [
                ['Lower', 'LOWER'],
                ['Higher', 'HIGHER'],
            ],
        },
        { type: 'field_label', text: 'Offset' },
        {
            type: 'field_dropdown',
            name: 'BARRIER_2',
            options: [
                ['+', 'PLUS'],
                ['-', 'MINUS'],
            ],
        },
        numberField('OFFSET_2', '0.31'),
        numberField('STAKE_2'),
    ],
    block =>
        `Bot.purchase('${block.getFieldValue('PURCHASE_1')}');\nBot.purchase('${block.getFieldValue('PURCHASE_2')}');\n`
);

registerHedgePurchase(
    'only_ups_downs_hedge_purchase',
    'ONLY UPS/DOWN Hedge purchase  Purchase 1: %1  stake 1: %2  Purchase 2: %3  stake 2: %4',
    [
        {
            type: 'field_dropdown',
            name: 'PURCHASE_1',
            options: [
                ['Only Ups', 'ONLY_UPS'],
                ['Only Downs', 'ONLY_DOWNS'],
            ],
        },
        numberField('STAKE_1'),
        {
            type: 'field_dropdown',
            name: 'PURCHASE_2',
            options: [
                ['Only Downs', 'ONLY_DOWNS'],
                ['Only Ups', 'ONLY_UPS'],
            ],
        },
        numberField('STAKE_2'),
    ],
    block =>
        `Bot.purchase('${block.getFieldValue('PURCHASE_1')}');\nBot.purchase('${block.getFieldValue('PURCHASE_2')}');\n`
);

registerHedgePurchase(
    'apollo_hedge_purchase',
    'APOLLO Hedge purchase  Purchase A: %1  Barrier: %2 %3  Second barrier: %4 %5  Prediction: %6  Purchase B: %7  Barrier: %8 %9  Second barrier: %10 %11  Prediction: %12',
    [
        {
            type: 'field_dropdown',
            name: 'PURCHASE_A',
            options: [
                ['Digit Over', 'DIGITOVER'],
                ['Digit Under', 'DIGITUNDER'],
            ],
        },
        {
            type: 'field_dropdown',
            name: 'BARRIER_A_SIGN',
            options: [
                ['+', 'PLUS'],
                ['-', 'MINUS'],
            ],
        },
        numberField('BARRIER_A_VALUE', '0.1'),
        {
            type: 'field_dropdown',
            name: 'SECOND_BARRIER_A_SIGN',
            options: [
                ['+', 'PLUS'],
                ['-', 'MINUS'],
            ],
        },
        numberField('SECOND_BARRIER_A_VALUE', '0.1'),
        numberField('PREDICTION_A', '1'),
        {
            type: 'field_dropdown',
            name: 'PURCHASE_B',
            options: [
                ['Digit Over', 'DIGITOVER'],
                ['Digit Under', 'DIGITUNDER'],
            ],
        },
        {
            type: 'field_dropdown',
            name: 'BARRIER_B_SIGN',
            options: [
                ['+', 'PLUS'],
                ['-', 'MINUS'],
            ],
        },
        numberField('BARRIER_B_VALUE', '0.1'),
        {
            type: 'field_dropdown',
            name: 'SECOND_BARRIER_B_SIGN',
            options: [
                ['+', 'PLUS'],
                ['-', 'MINUS'],
            ],
        },
        numberField('SECOND_BARRIER_B_VALUE', '0.1'),
        numberField('PREDICTION_B', '1'),
    ],
    block =>
        `Bot.purchase('${block.getFieldValue('PURCHASE_A')}');\nBot.purchase('${block.getFieldValue('PURCHASE_B')}');\n`
);

registerHedgePurchase(
    'over_under_hedge_purchase',
    'OVER/UNDER Hedge purchase  Purchase 1: %1  stake 1: %2  Prediction: %3  Purchase 2: %4  stake 2: %5  Prediction: %6',
    [
        {
            type: 'field_dropdown',
            name: 'PURCHASE_1',
            options: [
                ['Under', 'UNDER'],
                ['Over', 'OVER'],
            ],
        },
        numberField('STAKE_1'),
        numberField('PREDICTION_1', '1'),
        {
            type: 'field_dropdown',
            name: 'PURCHASE_2',
            options: [
                ['Over', 'OVER'],
                ['Under', 'UNDER'],
            ],
        },
        numberField('STAKE_2'),
        numberField('PREDICTION_2', '1'),
    ],
    block =>
        `Bot.purchase('${block.getFieldValue('PURCHASE_1')}');\nBot.purchase('${block.getFieldValue('PURCHASE_2')}');\n`
);
