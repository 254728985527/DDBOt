import React from 'react';
import { useOauth2 } from '@/hooks/auth/useOauth2';

type AuthLoadingWrapperProps = {
    children: React.ReactNode;
};

const AuthLoadingWrapper = ({ children }: AuthLoadingWrapperProps) => {
    useOauth2();

    return <>{children}</>;
};

export default AuthLoadingWrapper;
