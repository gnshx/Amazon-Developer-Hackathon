import { randomUUID } from "node:crypto";
import { BookingRecord, FaultType, IMockProvider } from "./types.js";

export class MockHotelProvider implements IMockProvider {
  public readonly name = "hotel";
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

  public async searchHotels(destination: string) {
    return [
      { id: "grand_plaza", name: "Grand Plaza Hotel", priceMinor: 12000, destination },
      { id: "harbor_view", name: "Harbor View Inn", priceMinor: 9500, destination }
    ];
  }

  public async bookHotel(
    idempotencyKey: string,
    params: { hotel_id: string; nights: number; price?: number }
  ): Promise<{ bookingRef: string; status: "CONFIRMED"; hotelId: string; priceMinor: number }> {
    // Check for cached idempotent booking
    const existing = this.getBookingByIdempotencyKey(idempotencyKey);
    if (existing) {
      return {
        bookingRef: existing.bookingRef,
        status: existing.status as "CONFIRMED",
        hotelId: (existing.details.hotel_id as string) || params.hotel_id,
        priceMinor: (existing.details.price as number) || 12000
      };
    }

    // Process Injected Faults
    if (this.currentFault !== "NONE" && this.faultCallsRemaining > 0) {
      this.faultCallsRemaining--;
      const fault = this.currentFault;
      if (this.faultCallsRemaining === 0) {
        this.currentFault = "NONE";
      }

      if (fault === "DECLINE") {
        throw new Error("PROVIDER_DECLINED: Hotel room unavailable or credit card declined.");
      }

      if (fault === "TIMEOUT") {
        throw new Error("PROVIDER_TIMEOUT: Upstream hotel booking engine timed out after 5000ms.");
      }

      if (fault === "SUCCEEDED_BUT_DISCONNECTED") {
        // External state IS persisted, but response connection is lost before client gets ACK
        const bookingRef = `htl_${randomUUID().slice(0, 8)}`;
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

    const bookingRef = `htl_${randomUUID().slice(0, 8)}`;
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
      hotelId: params.hotel_id,
      priceMinor: params.price ?? 12000
    };
  }

  public async cancelHotel(
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
