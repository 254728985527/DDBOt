import { generateDerivApiInstance } from './appId';

const OPEN_TIMEOUT_MS = 5000;
const MAX_RECONNECT_DELAY_MS = 12000;

class ChartAPI {
    api;
    time_interval;
    reconnecting = false;
    reconnect_attempt = 0;
    connection_error = null;
    connection_generation = 0;

    onsocketclose = () => {
        // The chart view owns retries. Avoid a second reconnect loop racing its lifecycle.
        this.connection_error = new Error('Market data WebSocket closed');
    };

    getConnectionError = () => this.connection_error;

    disconnect = () => {
        this.connection_generation += 1;
        if (this.time_interval) clearInterval(this.time_interval);
        this.time_interval = null;
        this.api?.connection?.removeEventListener('close', this.onsocketclose);
        this.api?.disconnect();
        this.api = null;
    };

    init = async (force_create_connection = false) => {
        if (!this.api || force_create_connection) {
            if (this.api?.connection) this.disconnect();
            this.api = await generateDerivApiInstance();
            this.api?.connection.addEventListener('close', this.onsocketclose);
        }
        if (this.api?.connection?.readyState === WebSocket.CONNECTING) {
            const connection = this.api.connection;
            const generation = this.connection_generation;
            await new Promise((resolve, reject) => {
                let timer;
                const finish = error => {
                    window.clearTimeout(timer);
                    connection.removeEventListener('open', onopen);
                    connection.removeEventListener('error', onerror);
                    connection.removeEventListener('close', onclose);
                    error ? reject(error) : resolve();
                };
                const onopen = () => finish();
                const onerror = () => finish(new Error('Market data connection was blocked or failed'));
                const onclose = () => finish(new Error('Market data connection closed before opening'));
                timer = window.setTimeout(
                    () => finish(new Error('Market data connection timed out after 5 seconds')),
                    OPEN_TIMEOUT_MS
                );
                connection.addEventListener('open', onopen, { once: true });
                connection.addEventListener('error', onerror, { once: true });
                connection.addEventListener('close', onclose, { once: true });
            });
            if (generation !== this.connection_generation) throw new Error('Market data connection was reset');
        }
        if (this.api?.connection?.readyState === WebSocket.OPEN) {
            this.reconnect_attempt = 0;
            this.connection_error = null;
            this.getTime();
        } else {
            throw new Error('Market data connection is unavailable');
        }
        return this.api;
    };

    getTime() {
        if (!this.time_interval) {
            this.time_interval = setInterval(() => {
                this.api.send({ time: 1 });
            }, 30000);
        }
    }

    reconnectIfNotConnected = () => {
        if (this.reconnecting || this.api?.connection?.readyState === WebSocket.OPEN) return;
        this.reconnecting = true;
        const delay = Math.min(500 * 2 ** this.reconnect_attempt, MAX_RECONNECT_DELAY_MS);
        this.reconnect_attempt += 1;
        window.setTimeout(() => {
            this.init(true)
                .catch(error => {
                    this.connection_error = error;
                })
                .finally(() => {
                    this.reconnecting = false;
                    if (this.api?.connection?.readyState !== WebSocket.OPEN) this.reconnectIfNotConnected();
                });
        }, delay);
    };
}

const chart_api = new ChartAPI();

export default chart_api;
