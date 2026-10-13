import React from 'react';

type ChunkErrorBoundaryProps = {
    children: React.ReactNode;
    fallback: React.ReactNode;
};

type ChunkErrorBoundaryState = {
    has_error: boolean;
};

const CHUNK_RELOAD_KEY = 'dbot-chunk-reload-attempted';

export default class ChunkErrorBoundary extends React.Component<ChunkErrorBoundaryProps, ChunkErrorBoundaryState> {
    state: ChunkErrorBoundaryState = { has_error: false };

    componentDidMount() {
        window.sessionStorage.removeItem(CHUNK_RELOAD_KEY);
    }

    static getDerivedStateFromError(): ChunkErrorBoundaryState {
        return { has_error: true };
    }

    componentDidCatch(error: Error) {
        const is_chunk_error =
            error.name === 'ChunkLoadError' ||
            /Loading chunk|failed to fetch dynamically imported module/i.test(error.message);
        if (!is_chunk_error || typeof window === 'undefined') return;

        if (window.sessionStorage.getItem(CHUNK_RELOAD_KEY) !== '1') {
            window.sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
            window.location.reload();
        }
    }

    render() {
        return this.state.has_error ? this.props.fallback : this.props.children;
    }
}
