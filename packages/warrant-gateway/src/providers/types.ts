/**
 * Mock Provider Types & Fault Injection Interfaces
 */

export type FaultType = "NONE" | "TIMEOUT" | "DECLINE" | "SUCCEEDED_BUT_DISCONNECTED";

export interface BookingRecord {
  bookingRef: string;
  idempotencyKey: string;
  status: "CONFIRMED" | "CANCELLED";
  details: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface IMockProvider {
  readonly name: string;
  injectFault(fault: FaultType, remainingCalls?: number): void;
  getInjectedFault(): FaultType;
  resetFault(): void;
  getBookings(): BookingRecord[];
  getBookingByIdempotencyKey(key: string): BookingRecord | null;
  clear(): void;
}
