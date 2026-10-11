import { useCallback, useState } from 'react';
import clsx from 'clsx';
import { observer } from 'mobx-react-lite';
import PWAInstallButton from '@/components/pwa-install-button';
import { generateOAuthURL, standalone_routes } from '@/components/shared';
import Button from '@/components/shared_ui/button';
import { generateDerivApiInstance } from '@/external/bot-skeleton/services/api/appId';
import useActiveAccount from '@/hooks/api/account/useActiveAccount';
import { useOauth2 } from '@/hooks/auth/useOauth2';
import { useFirebaseCountriesConfig } from '@/hooks/firebase/useFirebaseCountriesConfig';
import { useApiBase } from '@/hooks/useApiBase';
import { useStore } from '@/hooks/useStore';
import useTMB from '@/hooks/useTMB';
import { clearAuthData, handleOidcAuthFailure } from '@/utils/auth-utils';
import { StandaloneCircleUserRegularIcon } from '@deriv/quill-icons/Standalone';
import { requestOidcAuthentication } from '@deriv-com/auth-client';
import { Localize, useTranslations } from '@deriv-com/translations';
import { Header, useDevice, Wrapper } from '@deriv-com/ui';
import { Tooltip } from '@deriv-com/ui';
import { AppLogo } from '../app-logo';
import AccountsInfoLoader from './account-info-loader';
import AccountSwitcher from './account-switcher';
import MenuItems from './menu-items';
import MobileMenu from './mobile-menu';
import PlatformSwitcher from './platform-switcher';
import './header.scss';

type TAppHeaderProps = {
    isAuthenticating?: boolean;
};

const AppHeader = observer(({ isAuthenticating }: TAppHeaderProps) => {
    const { isDesktop } = useDevice();
    const { isAuthorizing, activeLoginid } = useApiBase();
    const { client } = useStore() ?? {};

    const { data: activeAccount } = useActiveAccount({ allBalanceData: client?.all_accounts_balance });
    const { accounts, getCurrency, is_virtual } = client ?? {};
    const has_wallet = Object.keys(accounts ?? {}).some(id => accounts?.[id].account_category === 'wallet');
    const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);
    const [isAppIdModalOpen, setIsAppIdModalOpen] = useState(false);
    const [appId, setAppId] = useState('34DmCFChY0gCQkERvwyKd');
    const [redirectUrl, setRedirectUrl] = useState('');
    const [websiteUrl, setWebsiteUrl] = useState('');
    const [apiToken, setApiToken] = useState('');
    const [tokenError, setTokenError] = useState('');
    const [isConnectingToken, setIsConnectingToken] = useState(false);

    const currency = getCurrency?.();
    const { localize } = useTranslations();

    const { isSingleLoggingIn } = useOauth2();

    const { hubEnabledCountryList } = useFirebaseCountriesConfig();
    const { onRenderTMBCheck, isTmbEnabled } = useTMB();
    const is_tmb_enabled = isTmbEnabled() || window.is_tmb_enabled === true;
    // No need for additional state management here since we're handling it in the layout component

    const startAppIdLogin = async () => {
        clearAuthData(false);
        const query_param_currency =
            new URLSearchParams(window.location.search).get('account') ||
            sessionStorage.getItem('query_param_currency') ||
            'USD';
        try {
            if (await isTmbEnabled()) return onRenderTMBCheck(true);
            await requestOidcAuthentication({
                redirectCallbackUri: redirectUrl || `${window.location.origin}/callback`,
                ...(query_param_currency
                    ? { state: { account: query_param_currency, app_id: appId, website_url: websiteUrl } }
                    : {}),
            });
        } catch (error) {
            handleOidcAuthFailure(error);
            window.location.replace(generateOAuthURL());
        }
    };

    const renderAccountSection = useCallback(() => {
        // Show loader during authentication processes
        if (isAuthenticating || isAuthorizing || (isSingleLoggingIn && !is_tmb_enabled)) {
            return <AccountsInfoLoader isLoggedIn isMobile={!isDesktop} speed={3} />;
        } else if (activeLoginid) {
            return (
                <>
                    {/* <CustomNotifications /> */}

                    {isDesktop &&
                        (has_wallet ? (
                            <Button
                                className='manage-funds-button'
                                has_effect
                                text={localize('Manage funds')}
                                onClick={() => {
                                    let redirect_url = new URL(standalone_routes.wallets_transfer);
                                    const is_hub_enabled_country = hubEnabledCountryList.includes(
                                        client?.residence || ''
                                    );
                                    if (is_hub_enabled_country) {
                                        redirect_url = new URL(standalone_routes.recent_transactions);
                                    }
                                    if (is_virtual) {
                                        redirect_url.searchParams.set('account', 'demo');
                                    } else if (currency) {
                                        redirect_url.searchParams.set('account', currency);
                                    }
                                    window.location.assign(redirect_url.toString());
                                }}
                                primary
                            />
                        ) : (
                            <Button
                                primary
                                onClick={() => {
                                    const redirect_url = new URL(standalone_routes.cashier_deposit);
                                    if (currency) {
                                        redirect_url.searchParams.set('account', currency);
                                    }
                                    window.location.assign(redirect_url.toString());
                                }}
                                className='deposit-button'
                            >
                                {localize('Deposit')}
                            </Button>
                        ))}

                    <AccountSwitcher activeAccount={activeAccount} />

                    {isDesktop &&
                        (() => {
                            let redirect_url = new URL(standalone_routes.personal_details);
                            const is_hub_enabled_country = hubEnabledCountryList.includes(client?.residence || '');

                            if (has_wallet && is_hub_enabled_country) {
                                redirect_url = new URL(standalone_routes.account_settings);
                            }
                            // Check if the account is a demo account
                            // Use the URL parameter to determine if it's a demo account, as this will update when the account changes
                            const urlParams = new URLSearchParams(window.location.search);
                            const account_param = urlParams.get('account');
                            const is_virtual = client?.is_virtual || account_param === 'demo';

                            if (is_virtual) {
                                // For demo accounts, set the account parameter to 'demo'
                                redirect_url.searchParams.set('account', 'demo');
                            } else if (currency) {
                                // For real accounts, set the account parameter to the currency
                                redirect_url.searchParams.set('account', currency);
                            }
                            return (
                                <Tooltip
                                    as='a'
                                    href={redirect_url.toString()}
                                    tooltipContent={localize('Manage account settings')}
                                    tooltipPosition='bottom'
                                    className='app-header__account-settings'
                                >
                                    <StandaloneCircleUserRegularIcon className='app-header__profile_icon' />
                                </Tooltip>
                            );
                        })()}
                </>
            );
        } else {
            return (
                <div className='auth-actions'>
                    <span className='auth-status-dot' aria-hidden='true' />
                    <Button
                        className='auth-action auth-action--login'
                        tertiary
                        onClick={() => {
                            setRedirectUrl(`${window.location.origin}/callback`);
                            setWebsiteUrl(window.location.origin);
                            setIsAppIdModalOpen(true);
                        }}
                    >
                        <Localize i18n_default_text='Log in' />
                    </Button>
                    <Button
                        className='auth-action auth-action--token'
                        tertiary
                        onClick={() => {
                            setTokenError('');
                            setApiToken('');
                            setIsTokenModalOpen(true);
                        }}
                    >
                        <Localize i18n_default_text='Use API token' />
                    </Button>
                    <Button
                        className='auth-action auth-action--signup'
                        primary
                        onClick={() => window.open(standalone_routes.signup)}
                    >
                        <Localize i18n_default_text='Sign up' />
                    </Button>
                </div>
            );
        }
    }, [
        isAuthenticating,
        isAuthorizing,
        isSingleLoggingIn,
        isDesktop,
        activeLoginid,
        standalone_routes,
        client,
        has_wallet,
        currency,
        localize,
        activeAccount,
        is_virtual,
        onRenderTMBCheck,
        is_tmb_enabled,
    ]);

    const connectApiToken = async () => {
        const token = apiToken.trim();
        if (!token) return setTokenError('Paste your personal access token to continue.');
        setIsConnectingToken(true);
        setTokenError('');
        try {
            const api = await generateDerivApiInstance();
            const { authorize, error } = await api.authorize(token);
            api.disconnect();
            if (error || !authorize?.account_list?.length)
                throw new Error('This token could not be authorized. Check that it has trade permission.');
            const account = authorize.account_list[0];
            const accountsList = { [account.loginid]: token };
            const clientAccounts = {
                [account.loginid]: { loginid: account.loginid, token, currency: account.currency },
            };
            sessionStorage.setItem('accountsList', JSON.stringify(accountsList));
            sessionStorage.setItem('clientAccounts', JSON.stringify(clientAccounts));
            localStorage.setItem('accountsList', JSON.stringify(accountsList));
            localStorage.setItem('clientAccounts', JSON.stringify(clientAccounts));
            localStorage.setItem('authToken', token);
            localStorage.setItem('active_loginid', account.loginid);
            setIsTokenModalOpen(false);
            window.location.reload();
        } catch (error) {
            setTokenError(error instanceof Error ? error.message : 'Unable to connect this token.');
        } finally {
            setIsConnectingToken(false);
        }
    };

    if (client?.should_hide_header) return null;
    return (
        <Header
            className={clsx('app-header', {
                'app-header--desktop': isDesktop,
                'app-header--mobile': !isDesktop,
            })}
        >
            <Wrapper variant='left'>
                <AppLogo />
                <MobileMenu />
                {isDesktop && <MenuItems.TradershubLink />}
                {isDesktop && <MenuItems />}
                {isDesktop && <PlatformSwitcher />}
            </Wrapper>
            <Wrapper variant='right'>
                {!isDesktop && <PWAInstallButton variant='primary' size='medium' />}
                {renderAccountSection()}
            </Wrapper>
            {isAppIdModalOpen && (
                <div
                    className='app-id-modal__backdrop'
                    role='presentation'
                    onMouseDown={event => event.target === event.currentTarget && setIsAppIdModalOpen(false)}
                >
                    <section className='app-id-modal' role='dialog' aria-modal='true' aria-labelledby='app-id-title'>
                        <button
                            className='app-id-modal__close'
                            type='button'
                            aria-label='Close App ID dialog'
                            onClick={() => setIsAppIdModalOpen(false)}
                        >
                            ×
                        </button>
                        <div className='app-id-modal__title'>
                            <span aria-hidden='true'>◇</span>
                            <h2 id='app-id-title'>
                                Log in with{' '}
                                <a href='https://developers.deriv.com/' target='_blank' rel='noreferrer'>
                                    App ID
                                </a>
                            </h2>
                        </div>
                        <label htmlFor='app-id-input'>App ID</label>
                        <input
                            id='app-id-input'
                            value={appId}
                            onChange={event => setAppId(event.target.value)}
                            placeholder='34DmCFChY0gCQkERvwyKd'
                        />
                        <label htmlFor='redirect-url-input'>Redirect URL</label>
                        <input
                            id='redirect-url-input'
                            value={redirectUrl}
                            onChange={event => setRedirectUrl(event.target.value)}
                            placeholder='https://your-redirect-url.com'
                            type='url'
                        />
                        <label htmlFor='website-url-input'>Website URL</label>
                        <input
                            id='website-url-input'
                            value={websiteUrl}
                            onChange={event => setWebsiteUrl(event.target.value)}
                            placeholder='https://your-website-url.com'
                            type='url'
                        />
                        <div className='app-id-modal__actions'>
                            <Button tertiary onClick={() => setIsAppIdModalOpen(false)}>
                                Cancel
                            </Button>
                            <Button
                                primary
                                disabled={!appId.trim()}
                                onClick={() => {
                                    setIsAppIdModalOpen(false);
                                    void startAppIdLogin();
                                }}
                            >
                                Continue
                            </Button>
                        </div>
                    </section>
                </div>
            )}
            {isTokenModalOpen && (
                <div
                    className='api-token-modal__backdrop'
                    role='presentation'
                    onMouseDown={event => event.target === event.currentTarget && setIsTokenModalOpen(false)}
                >
                    <section
                        className='api-token-modal'
                        role='dialog'
                        aria-modal='true'
                        aria-labelledby='api-token-title'
                    >
                        <button
                            className='api-token-modal__close'
                            type='button'
                            aria-label='Close API token dialog'
                            onClick={() => setIsTokenModalOpen(false)}
                        >
                            ×
                        </button>
                        <h2 id='api-token-title'>Sign in with an API token</h2>
                        <label htmlFor='api-token-input'>Personal access token</label>
                        <textarea
                            id='api-token-input'
                            value={apiToken}
                            onChange={event => setApiToken(event.target.value)}
                            placeholder='Paste your token'
                            autoFocus
                        />
                        <p>
                            Only a token with the trade permission can connect. Your token is kept only for this browser
                            session.
                        </p>
                        {tokenError && (
                            <div className='api-token-modal__error' role='alert'>
                                {tokenError}
                            </div>
                        )}
                        <div className='api-token-modal__actions'>
                            <Button tertiary onClick={() => setIsTokenModalOpen(false)}>
                                Cancel
                            </Button>
                            <Button primary disabled={!apiToken.trim() || isConnectingToken} onClick={connectApiToken}>
                                {isConnectingToken ? 'Connecting…' : 'Connect'}
                            </Button>
                        </div>
                    </section>
                </div>
            )}
        </Header>
    );
});

export default AppHeader;
