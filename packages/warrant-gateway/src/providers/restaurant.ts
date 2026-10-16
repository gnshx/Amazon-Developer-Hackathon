import { randomUUID } from "node:crypto";
import { BookingRecord, FaultType, IMockProvider } from "./types.js";

export class MockRestaurantProvider implements IMockProvider {
  public readonly name = "restaurant";
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

  public async searchRestaurants(city: string, cuisine: string = "Italian") {
    return [
      { id: "trattoria_bella", name: "Trattoria Bella", city, cuisine, priceMinor: 3000 },
      { id: "osteria_roma", name: "Osteria Roma", city, cuisine, priceMinor: 4000 }
    ];
  }

  public async reserveTable(
    idempotencyKey: string,
    params: { restaurant_id: string; guests: number; time?: string }
  ): Promise<{ bookingRef: string; status: "CONFIRMED"; restaurantId: string; guests: number; priceMinor: number }> {
    const existing = this.getBookingByIdempotencyKey(idempotencyKey);
    if (existing) {
      return {
        bookingRef: existing.bookingRef,
        status: existing.status as "CONFIRMED",
        restaurantId: (existing.details.restaurant_id as string) || params.restaurant_id,
        guests: (existing.details.guests as number) || params.guests,
        priceMinor: 0
      };
    }

    if (this.currentFault !== "NONE" && this.faultCallsRemaining > 0) {
      this.faultCallsRemaining--;
      const fault = this.currentFault;
      if (this.faultCallsRemaining === 0) {
        this.currentFault = "NONE";
      }

      if (fault === "DECLINE") {
        throw new Error("PROVIDER_DECLINED: Restaurant fully booked at requested hour.");
      }

      if (fault === "TIMEOUT") {
        throw new Error("PROVIDER_TIMEOUT: Dining reservation API timed out after 5000ms.");
      }

      if (fault === "SUCCEEDED_BUT_DISCONNECTED") {
        const bookingRef = `rst_${randomUUID().slice(0, 8)}`;
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

    const bookingRef = `rst_${randomUUID().slice(0, 8)}`;
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
      restaurantId: params.restaurant_id,
      guests: params.guests,
      priceMinor: 0
    };
  }

  public async cancelReservation(
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
