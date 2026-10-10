export default class AccountLimits {
    constructor(store) {
        this.ws = store.ws;
    }
    // eslint-disable-next-line default-param-last
    getStakePayoutLimits(currency = 'AUD', landing_company_shortcode = 'svg', selected_market) {
        // Account landing-company details are not part of public market data.
        return Promise.resolve({});
    }
}
