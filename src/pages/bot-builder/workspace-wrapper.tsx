import React from 'react';
import { observer } from 'mobx-react-lite';
import Flyout from '@/components/flyout';
import { ApiHelpers, runIrreversibleEvents } from '@/external/bot-skeleton';
import { useStore } from '@/hooks/useStore';
import StopBotModal from '../dashboard/stop-bot-modal';
import Toolbar from './toolbar';
import Toolbox from './toolbox';
import './workspace.scss';

const WorkspaceWrapper = observer(() => {
    const { blockly_store } = useStore();
    const { onMount, onUnmount, is_loading } = blockly_store;

    React.useEffect(() => {
        onMount();

        const refreshTradeParameters = async () => {
            const activeSymbols = ApiHelpers?.instance?.active_symbols;
            const contractsFor = ApiHelpers?.instance?.contracts_for;
            const workspace = window.Blockly?.derivWorkspace;
            if (!activeSymbols || !contractsFor || !workspace) return;

            await activeSymbols.retrieveActiveSymbols(true);
            contractsFor.disposeCache();
            workspace
                .getAllBlocks()
                .filter(block => block.type === 'trade_definition_market')
                .forEach(block => {
                    runIrreversibleEvents(() => {
                        const createEvent = new window.Blockly.Events.BlockCreate(block);
                        window.Blockly.Events.fire(createEvent);
                    });
                });
        };

        const refreshTimer = window.setTimeout(() => {
            void refreshTradeParameters();
        }, 0);

        return () => {
            window.clearTimeout(refreshTimer);
            onUnmount();
        };
    }, []);

    if (is_loading) return null;

    if (window.Blockly?.derivWorkspace)
        return (
            <React.Fragment>
                <Toolbox />
                <Toolbar />
                <Flyout />
                <StopBotModal />
            </React.Fragment>
        );

    return null;
});

export default WorkspaceWrapper;
