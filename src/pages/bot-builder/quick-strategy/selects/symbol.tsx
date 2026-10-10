import React, { useEffect, useMemo, useState } from 'react';
import { Field, FieldProps, useFormikContext } from 'formik';
import { MarketIcon } from '@/components/market/market-icon';
import Autocomplete from '@/components/shared_ui/autocomplete';
import { TItem } from '@/components/shared_ui/dropdown-list';
import Text from '@/components/shared_ui/text';
import { ApiHelpers } from '@/external/bot-skeleton';
import { useStore } from '@/hooks/useStore';
import { useDevice } from '@deriv-com/ui';
import { TFormData } from '../types';
import { V2_QS_STRATEGIES } from '../utils';

type TSymbol = {
    component?: React.ReactNode;
    text: string;
    value: string;
    group?: string;
    submarket?: string;
};

type TMarketOption = {
    symbol: TSymbol;
};

const MarketOption: React.FC<TMarketOption> = ({ symbol }) => (
    <div key={symbol.value} className='qs__select__option'>
        <MarketIcon type={symbol.value} size='sm' />
        <Text className='qs__select__option__text' size='xs' color='prominent'>
            {symbol.text}
        </Text>
    </div>
);

const SymbolSelect: React.FC = () => {
    const { quick_strategy } = useStore();
    const { isDesktop } = useDevice();
    const { setValue, selected_strategy } = quick_strategy;
    const [active_symbols, setActiveSymbols] = React.useState<TSymbol[]>([]);
    const [is_input_started, setIsInputStarted] = useState(false);
    const [input_value, setInputValue] = useState({ text: '', value: '' });
    const [last_selected_symbol, setLastSelectedSymbol] = useState({ text: '', value: '' });
    const { setFieldValue, values } = useFormikContext<TFormData>();
    const is_strategy_accumulator = V2_QS_STRATEGIES.includes(selected_strategy);

    const symbols = useMemo(
        () =>
            active_symbols
                .map((symbol: TSymbol) => ({
                    component: <MarketOption key={symbol.text} symbol={symbol} />,
                    ...symbol,
                }))
                .filter(symbol => !is_strategy_accumulator || symbol?.submarket === 'random_index'),
        [active_symbols, is_strategy_accumulator]
    );

    useEffect(() => {
        let cancelled = false;
        let retry_timer: ReturnType<typeof setTimeout> | undefined;
        const loadSymbols = async () => {
            const helper = ApiHelpers?.instance?.active_symbols as unknown as
                | {
                      retrieveActiveSymbols?: () => Promise<unknown>;
                      getSymbolsForBot?: () => TSymbol[];
                  }
                | undefined;
            await helper?.retrieveActiveSymbols?.();
            const loaded_symbols = helper?.getSymbolsForBot?.() ?? [];
            if (cancelled) return;
            setActiveSymbols(loaded_symbols);

            const has_symbol = loaded_symbols.some(symbol => symbol?.value === values?.symbol);
            if (!has_symbol && loaded_symbols[0]?.value) {
                setFieldValue('symbol', loaded_symbols[0].value);
                setValue('symbol', loaded_symbols[0].value);
            }
            if (!loaded_symbols.length) retry_timer = window.setTimeout(loadSymbols, 1000);
        };
        loadSymbols();
        return () => {
            cancelled = true;
            if (retry_timer) window.clearTimeout(retry_timer);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const selected_symbol = symbols.find(symbol => symbol.value === values.symbol);
        if (selected_symbol) {
            setInputValue({ text: selected_symbol.text, value: selected_symbol.value });
        }
    }, [symbols, values.symbol, setInputValue]);

    const handleFocus = () => {
        if (isDesktop && !is_input_started) {
            setIsInputStarted(true);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue({ ...input_value, text: e.target.value });
    };

    const handleItemSelection = (item: TItem) => {
        if (item?.value) {
            const { value } = item as TSymbol;
            setFieldValue('symbol', value);
            setValue('symbol', value);
            setIsInputStarted(false);
        }
    };

    const handleHideDropdownList = () => {
        if (isDesktop) {
            const selectedSymbol = symbols.find(symbol => symbol.value === values.symbol);
            if (selectedSymbol && selectedSymbol.text !== input_value.text) {
                setInputValue({ text: selectedSymbol.text, value: selectedSymbol.value });
                setLastSelectedSymbol({ text: selectedSymbol.text, value: selectedSymbol.value });
                setIsInputStarted(false);
            }
            if (!selectedSymbol) {
                setInputValue({ text: last_selected_symbol.text, value: last_selected_symbol.value });
                setIsInputStarted(false);
            }
        }
    };

    return (
        <div className='qs__form__field qs__form__field__input'>
            <Field name='symbol' key='asset' id='asset'>
                {({ field: { ...rest_field } }: FieldProps) => (
                    <>
                        <Autocomplete
                            {...rest_field}
                            readOnly={!isDesktop}
                            inputMode='none'
                            data-testid='dt_qs_symbol'
                            autoComplete='off'
                            className='qs__autocomplete'
                            value={input_value.text}
                            list_items={symbols}
                            onItemSelection={handleItemSelection}
                            onChange={handleInputChange}
                            onFocus={handleFocus}
                            onHideDropdownList={handleHideDropdownList}
                            leading_icon={<MarketIcon type={input_value.value} size='sm' />}
                        />
                    </>
                )}
            </Field>
        </div>
    );
};

export default SymbolSelect;
