import { generateDerivApiInstance } from './appId';

class ChartAPI {
    api;
    time_interval;
    reconnecting = false;

    onsocketclose = () => {
        this.reconnectIfNotConnected();
    };

    init = async (force_create_connection = false) => {
        if (!this.api || force_create_connection) {
            if (this.api?.connection) {
                this.api.connection.removeEventListener('close', this.onsocketclose);
                this.api.disconnect();
            }
            this.api = await generateDerivApiInstance();
            this.api?.connection.addEventListener('close', this.onsocketclose);
        }
        if (this.api?.connection?.readyState === 0) {
            await new Promise((resolve, reject) => {
                const connection = this.api.connection;
                const onopen = () => {
                    connection.removeEventListener('open', onopen);
                    connection.removeEventListener('error', onerror);
                    resolve();
                };
                const onerror = () => {
                    connection.removeEventListener('open', onopen);
                    connection.removeEventListener('error', onerror);
                    resolve();
                };
                connection.addEventListener('open', onopen, { once: true });
                connection.addEventListener('error', onerror, { once: true });
            });
        }
        if (this.api?.connection?.readyState === WebSocket.OPEN) this.getTime();
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
        this.init(true).finally(() => {
            this.reconnecting = false;
        });
    };
}

const chart_api = new ChartAPI();

export default chart_api;
