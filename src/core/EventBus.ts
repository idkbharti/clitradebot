import { EventEmitter } from "events";

class TradingEventBus extends EventEmitter {}

// Singleton instance to be used across all engines
export const EventBus = new TradingEventBus();

// Typed Event Names for consistency
export const Events = {
    SIGNAL_PDH_REJECTION: "SIGNAL_PDH_REJECTION",
    SIGNAL_FIB_PULLBACK: "SIGNAL_FIB_PULLBACK",
    TRADE_EXECUTED: "TRADE_EXECUTED",
    TRADE_CLOSED: "TRADE_CLOSED",
    SYSTEM_ERROR: "SYSTEM_ERROR",
};
