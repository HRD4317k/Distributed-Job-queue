import { Module, OnModuleInit } from "@nestjs/common";
import { HandlerRegistry } from "./handler.registry";
import { sendPaymentSmsHandler } from "./handlers/send-payment-sms.handler";

@Module({
    providers: [HandlerRegistry],
    exports: [HandlerRegistry],
})
export class HandlerModule implements OnModuleInit {
    constructor(private readonly registry: HandlerRegistry) {}

    onModuleInit() {
        this.registry.register('SEND_PAYMENT_SMS', sendPaymentSmsHandler);
    }
}
