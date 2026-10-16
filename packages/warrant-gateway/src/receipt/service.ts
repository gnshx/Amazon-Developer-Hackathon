import { generateKeyPairSync, sign, verify, KeyObject, randomUUID } from "node:crypto";
import { ActionReceipt, MinorUnits } from "../types.js";
import { WarrantRepository } from "../storage/db.js";
import { canonicalizeJson } from "../crypto/canonical.js";

export class ReceiptService {
  private privateKey: KeyObject;
  private publicKey: KeyObject;
  private publicKeyPem: string;

  constructor(
    private repo: WarrantRepository,
    keyPair?: { privateKey: KeyObject; publicKey: KeyObject }
  ) {
    if (keyPair) {
      this.privateKey = keyPair.privateKey;
      this.publicKey = keyPair.publicKey;
    } else {
      const generated = generateKeyPairSync("ed25519");
      this.privateKey = generated.privateKey;
      this.publicKey = generated.publicKey;
    }

    this.publicKeyPem = this.publicKey
      .export({ type: "spki", format: "pem" })
      .toString();
  }

  public getPublicKeyPem(): string {
    return this.publicKeyPem;
  }

  /**
   * Generates, cryptographically signs with Ed25519, and stores an ActionReceipt.
   */
  public createReceipt(params: {
    actionId: string;
    planId: string;
    grantId: string;
    toolName: string;
    paramsHash: string;
    spendMinor: MinorUnits;
    providerBookingRef: string;
    currency?: "USD";
  }): ActionReceipt {
    const receiptId = `rcpt_${randomUUID().replace(/-/g, "")}`;
    const executedAt = new Date().toISOString();
    const currency = params.currency || "USD";

    // Build deterministic payload fields
    const receiptData = {
      actionId: params.actionId,
      currency,
      executedAt,
      grantId: params.grantId,
      paramsHash: params.paramsHash,
      planId: params.planId,
      providerBookingRef: params.providerBookingRef,
      receiptId,
      spendMinor: params.spendMinor,
      toolName: params.toolName,
      version: "1.0" as const
    };

    const canonical = canonicalizeJson(receiptData);
    const signature = sign(null, Buffer.from(canonical, "utf-8"), this.privateKey).toString("hex");

    const receipt: ActionReceipt = {
      ...receiptData,
      gatewayPublicKey: this.publicKeyPem,
      signature
    };

    // Persist receipt in DB
    this.repo.saveReceipt(receipt);

    // Record audit event
    this.repo.appendAuditEvent("ACTION_RECEIPT_ISSUED", receipt.actionId, {
      receiptId: receipt.receiptId,
      toolName: receipt.toolName,
      spendMinor: receipt.spendMinor,
      paramsHash: receipt.paramsHash,
      signaturePrefix: receipt.signature.substring(0, 16)
    });

    return receipt;
  }

  /**
   * Verifies an ActionReceipt's Ed25519 signature and canonical payload integrity.
   * Can be executed completely offline by third parties using only the receipt.
   */
  public static verifyReceipt(
    receipt: ActionReceipt,
    expectedPublicKeyPem?: string
  ): { valid: boolean; reason?: string } {
    try {
      if (receipt.version !== "1.0") {
        return { valid: false, reason: `Unsupported receipt version: ${receipt.version}` };
      }

      if (expectedPublicKeyPem && receipt.gatewayPublicKey.trim() !== expectedPublicKeyPem.trim()) {
        return { valid: false, reason: "Receipt was not signed by expected Gateway public key." };
      }

      const receiptData = {
        actionId: receipt.actionId,
        currency: receipt.currency,
        executedAt: receipt.executedAt,
        grantId: receipt.grantId,
        paramsHash: receipt.paramsHash,
        planId: receipt.planId,
        providerBookingRef: receipt.providerBookingRef,
        receiptId: receipt.receiptId,
        spendMinor: receipt.spendMinor,
        toolName: receipt.toolName,
        version: receipt.version
      };

      const canonical = canonicalizeJson(receiptData);
      const isSignatureValid = verify(
        null,
        Buffer.from(canonical, "utf-8"),
        receipt.gatewayPublicKey,
        Buffer.from(receipt.signature, "hex")
      );

      if (!isSignatureValid) {
        return { valid: false, reason: "Ed25519 signature mismatch; receipt payload has been tampered with." };
      }

      return { valid: true };
    } catch (err: any) {
      return { valid: false, reason: `Verification error: ${err.message}` };
    }
  }

  public verifyReceipt(
    receipt: ActionReceipt,
    enforceGatewayKey: boolean = false
  ): { valid: boolean; reason?: string } {
    return ReceiptService.verifyReceipt(
      receipt,
      enforceGatewayKey ? this.publicKeyPem : undefined
    );
  }

  public getReceipt(receiptId: string): ActionReceipt | null {
    return this.repo.getReceipt(receiptId);
  }

  public getReceiptByActionId(actionId: string): ActionReceipt | null {
    return this.repo.getReceiptByActionId(actionId);
  }
}
