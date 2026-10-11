declare module '@deriv-com/translations' {
    export const Localize: any;
    export const localize: any;
    export const useTranslations: any;
    export const getInitialLanguage: any;
    export const initializeI18n: any;
    export const TranslationProvider: any;
}

declare module '@deriv-com/utils' {
    export const URLUtils: any;
}

declare namespace URLUtils {
    type LoginInfo = {
        loginid: string;
        token: string;
        currency: string;
    };
}
