// Local kiosk pairing credentials. The secret lives only on the paired device;
// the server stores a hash and the allowed shop IP, so an unpaired device (or the
// paired device off the shop WiFi) cannot record attendance.

const KEY = "actech.kiosk.attendance";

export interface KioskCredential {
  deviceId: string;
  secret: string;
  label?: string;
  pairedAt?: string;
}

export const getKioskCredential = (): KioskCredential | null => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as KioskCredential;
    if (!parsed?.deviceId || !parsed?.secret) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const saveKioskCredential = (cred: KioskCredential) => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...cred, pairedAt: new Date().toISOString() }));
  } catch {
    // storage unavailable (private mode) — pairing cannot persist
  }
};

export const clearKioskCredential = () => {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
};

export const kioskHeaders = (): Record<string, string> => {
  const cred = getKioskCredential();
  if (!cred) return {};
  return { "x-kiosk-device": cred.deviceId, "x-kiosk-key": cred.secret };
};
