import http from 'k6/http';
import { sleep } from 'k6';

export const options = {
    vus: 50,          // 50 virtual users hitting simultaneously
    duration: '30s',  // run for 30 seconds
};

export default function () {
    const payload = JSON.stringify({
        type: 'SEND_PAYMENT_SMS',
        priority: Math.random() > 0.5 ? 'high' : 'default',
        payload: {
            phone: '+91-98XXXXXX02',
            amount: Math.floor(Math.random() * 10000),
            txnId: `TXN_${Date.now()}`,
        },
    });

    http.post('http://localhost:3000/jobs', payload, {
        headers: { 'Content-Type': 'application/json' },
    });

    sleep(0.5);
}


