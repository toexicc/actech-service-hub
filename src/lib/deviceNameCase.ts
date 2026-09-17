/**
 * Tidies device brand / model / colour / storage text so tickets read
 * professionally: "APPLE" and "aPPLE" both become "Apple", "IPHONE 13" becomes
 * "iPhone 13", "512gb" becomes "512GB". Only capitalisation changes — a value
 * is never renamed or merged into a different one.
 */

export type DeviceValueKind = "brand" | "model" | "color" | "storage";

/** Words the brands themselves spell in a particular way. */
const KNOWN_WORDS = [
  "iPhone",
  "iPad",
  "iMac",
  "iPod",
  "MacBook",
  "Mac",
  "AirPods",
  "AirTag",
  "Apple",
  "Watch",
  "Samsung",
  "Galaxy",
  "Xiaomi",
  "Redmi",
  "Realme",
  "Oppo",
  "Vivo",
  "Huawei",
  "Honor",
  "OnePlus",
  "Nokia",
  "Motorola",
  "Infinix",
  "Tecno",
  "Cherry",
  "Mobile",
  "Lenovo",
  "ThinkPad",
  "IdeaPad",
  "Dell",
  "Inspiron",
  "Latitude",
  "XPS",
  "Alienware",
  "Acer",
  "Aspire",
  "Nitro",
  "Predator",
  "ASUS",
  "ROG",
  "TUF",
  "ZenBook",
  "VivoBook",
  "MSI",
  "HP",
  "Pavilion",
  "EliteBook",
  "ProBook",
  "Omen",
  "Victus",
  "LG",
  "Sony",
  "PlayStation",
  "Xbox",
  "Nintendo",
  "Switch",
  "Toshiba",
  "Fujitsu",
  "Panasonic",
  "Google",
  "Pixel",
  "Microsoft",
  "Surface",
  "Pro",
  "Max",
  "Mini",
  "Plus",
  "Air",
  "Ultra",
  "Prime",
  "Lite",
  "Gray",
  "Grey",
  "Space",
  "Silver",
  "Gold",
  "Rose",
  "Midnight",
  "Starlight",
  "Graphite",
  "Titanium",
  "Sierra",
  "Blue",
  "Black",
  "White",
  "Red",
  "Green",
  "Purple",
  "Yellow",
  "Pink",
  "Natural",
  "Desert",
  "Deep",
  "Jet",
  "Matte",
  "Glossy",
];

const KNOWN_LOOKUP = new Map(KNOWN_WORDS.map((w) => [w.toLowerCase(), w]));

/** Short forms that should stay fully upper-case. */
const UPPER_TOKENS = new Set([
  "gb",
  "tb",
  "mb",
  "ssd",
  "hdd",
  "oem",
  "lcd",
  "oled",
  "led",
  "usb",
  "cpu",
  "gpu",
  "ram",
  "se",
  "xr",
  "xs",
  "x",
  "ii",
  "iii",
  "iv",
  "v",
  "vi",
]);

const titleCaseWord = (word: string) =>
  word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();

/** Fixes a single space-separated token, keeping punctuation in place. */
const fixToken = (token: string): string => {
  if (!token) return token;

  // Handle hyphen / slash compounds piece by piece (e.g. "space-gray").
  if (/[-/]/.test(token)) {
    return token
      .split(/([-/])/)
      .map((part) => (part === "-" || part === "/" ? part : fixToken(part)))
      .join("");
  }

  const bare = token.replace(/[^A-Za-z0-9+]/g, "");
  if (!bare) return token;

  const known = KNOWN_LOOKUP.get(bare.toLowerCase());
  if (known) return token.replace(bare, known);

  // Storage-style tokens: 512gb -> 512GB, 1tb -> 1TB
  const sizeMatch = bare.match(/^(\d+(?:\.\d+)?)(gb|tb|mb)$/i);
  if (sizeMatch) {
    return token.replace(bare, `${sizeMatch[1]}${sizeMatch[2].toUpperCase()}`);
  }

  if (UPPER_TOKENS.has(bare.toLowerCase())) {
    return token.replace(bare, bare.toUpperCase());
  }

  // Model codes mixing letters and digits (A2338, M1, RTX3060) stay upper-case.
  if (/\d/.test(bare) && /[A-Za-z]/.test(bare)) {
    return token.replace(bare, bare.toUpperCase());
  }

  // Pure numbers stay as they are.
  if (/^\d+$/.test(bare)) return token;

  return token.replace(bare, titleCaseWord(bare));
};

/**
 * Normalises spacing and capitalisation of a device value.
 * Returns an empty string for blank input.
 */
export const normalizeDeviceValue = (value: string, _kind?: DeviceValueKind): string => {
  const cleaned = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";
  return cleaned.split(" ").map(fixToken).join(" ");
};

export default normalizeDeviceValue;
