import { Logger } from "@nestjs/common";

const logger = new Logger('SEND_PAYMENT_SMS');

export async function sendPaymentSmsHandler(payload: Record<string, any>): Promise<void> {
    await new Promise((resolve, reject) =>
        setTimeout(() => {
            if (Math.random() < 0.5) {
                reject(new Error('SMS provider 503: Service unavailable'));
            } else {
                logger.log(`Sending SMS to ${payload.phone}: ₹${payload.amount} ref ${payload.txnId}`);
                resolve(null);
            }
        }, 2000)
    )
}
