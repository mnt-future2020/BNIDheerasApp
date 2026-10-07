/**
 * Strings the phone signs with its device key. Shared by the browser (signing)
 * and the server (verifying), so it must not import Node-only modules.
 */
export const signedPayload = {
  register: (memberId: string, ts: number) => `bni-register|${memberId}|${ts}`,
  checkin: (memberId: string, qrToken: string) => `bni-checkin|${memberId}|${qrToken}`,
};

