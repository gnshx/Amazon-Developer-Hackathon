import { randomUUID } from "node:crypto";
import { BookingRecord, FaultType, IMockProvider } from "./types.js";

export class MockTrainProvider implements IMockProvider {
  public readonly name = "train";
  private bookings = new Map<string, BookingRecord>();
  private currentFault: FaultType = "NONE";
  private faultCallsRemaining: number = 0;

  public injectFault(fault: FaultType, calls: number = 1): void {
    this.currentFault = fault;
    this.faultCallsRemaining = calls;
  }

  public getInjectedFault(): FaultType {
    return this.currentFault;
  }

  public resetFault(): void {
    this.currentFault = "NONE";
    this.faultCallsRemaining = 0;
  }

  public async searchTrains(origin: string, destination: string) {
    return [
      { id: "train_exp_1", departure: "08:30", priceMinor: 4500, origin, destination },
      { id: "train_exp_2", departure: "11:15", priceMinor: 5200, origin, destination }
    ];
  }

  public async bookTrain(
    idempotencyKey: string,
    params: { origin: string; destination: string; price?: number }
  ): Promise<{ bookingRef: string; status: "CONFIRMED"; origin: string; destination: string; priceMinor: number }> {
    const existing = this.getBookingByIdempotencyKey(idempotencyKey);
    if (existing) {
      return {
        bookingRef: existing.bookingRef,
        status: existing.status as "CONFIRMED",
        origin: (existing.details.origin as string) || params.origin,
        destination: (existing.details.destination as string) || params.destination,
        priceMinor: (existing.details.price as number) || 4500
      };
    }

    if (this.currentFault !== "NONE" && this.faultCallsRemaining > 0) {
      this.faultCallsRemaining--;
      const fault = this.currentFault;
      if (this.faultCallsRemaining === 0) {
        this.currentFault = "NONE";
      }

      if (fault === "DECLINE") {
        throw new Error("PROVIDER_DECLINED: Train coach sold out or ticket rejected.");
      }

      if (fault === "TIMEOUT") {
        throw new Error("PROVIDER_TIMEOUT: Rail booking API timed out after 5000ms.");
      }

      if (fault === "SUCCEEDED_BUT_DISCONNECTED") {
        const bookingRef = `trn_${randomUUID().slice(0, 8)}`;
        const record: BookingRecord = {
          bookingRef,
          idempotencyKey,
          status: "CONFIRMED",
          details: { ...params },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        this.bookings.set(bookingRef, record);
        throw new Error("CONNECTION_LOST_AFTER_PERSIST: Socket closed unexpectedly by remote peer.");
      }
    }

    const bookingRef = `trn_${randomUUID().slice(0, 8)}`;
    const record: BookingRecord = {
      bookingRef,
      idempotencyKey,
      status: "CONFIRMED",
      details: { ...params },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.bookings.set(bookingRef, record);

    return {
      bookingRef,
      status: "CONFIRMED",
      origin: params.origin,
      destination: params.destination,
      priceMinor: params.price ?? 4500
    };
  }

  public async cancelTrain(
    _idempotencyKey: string,
    bookingRef: string
  ): Promise<{ bookingRef: string; status: "CANCELLED" }> {
    const booking = this.bookings.get(bookingRef);
    if (booking) {
      booking.status = "CANCELLED";
      booking.updatedAt = new Date().toISOString();
    }

    return {
      bookingRef,
      status: "CANCELLED"
    };
  }

  public getBookings(): BookingRecord[] {
    return Array.from(this.bookings.values());
  }

  public getBookingByIdempotencyKey(key: string): BookingRecord | null {
    for (const b of this.bookings.values()) {
      if (b.idempotencyKey === key) return b;
    }
    return null;
  }

  public clear(): void {
    this.bookings.clear();
    this.resetFault();
  }
}
