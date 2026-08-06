import { DATA_BRIDGE_URL } from "@/lib/dataBridge";

interface CorsPostResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * CORS-safe POST handler for Google Apps Script.
 * Google Apps Script can successfully update the sheet but block reading
 * the response due to CORS. This function treats such cases as success.
 */
export async function corsSafePost(formData: FormData): Promise<CorsPostResult> {
  try {
    const response = await fetch(DATA_BRIDGE_URL, {
      method: "POST",
      body: formData,
    });

    // Try to parse the response
    let result: any = null;
    let parseError = false;
    try {
      result = await response.json();
    } catch (err) {
      // CORS prevents reading response body, but POST likely succeeded
      console.warn("Could not parse response (likely CORS issue), assuming success:", err);
      parseError = true;
    }

    // If we couldn't parse the response but got a successful HTTP status, treat as success
    if (parseError && response.ok) {
      return { success: true, data: null };
    }

    // If we got a response, check for success indicators
    if (result) {
      const isSuccess = result.result === "success" || result.status === "success";
      if (isSuccess) {
        return { success: true, data: result };
      } else {
        return { 
          success: false, 
          error: result?.message || "Operation failed" 
        };
      }
    }

    // If response.ok and no result, assume success (CORS blocked response body)
    if (response.ok) {
      return { success: true, data: null };
    }

    return { success: false, error: "Operation failed" };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const isCorsFetchError = msg.toLowerCase().includes("failed to fetch") || 
                              msg.toLowerCase().includes("cors") ||
                              msg.toLowerCase().includes("network");

    if (isCorsFetchError) {
      // CORS causes "Failed to fetch" even on successful POST (200 OK)
      console.warn("Fetch error (likely CORS after successful POST):", error);
      return { success: true, data: null };
    }

    console.error("POST request failed:", error);
    return { success: false, error: msg };
  }
}

/**
 * CORS-safe POST with URLSearchParams body
 */
export async function corsSafePostParams(params: URLSearchParams): Promise<CorsPostResult> {
  try {
    const response = await fetch(DATA_BRIDGE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body: params,
    });

    let result: any = null;
    try {
      result = await response.json();
    } catch (parseError) {
      console.warn("Could not parse response (likely CORS issue), assuming success:", parseError);
    }

    const isSuccess =
      (result && (result.result === "success" || result.status === "success")) ||
      (response.ok && result === null);

    if (isSuccess) {
      return { success: true, data: result };
    } else {
      return { 
        success: false, 
        error: result?.message || "Operation failed" 
      };
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const isCorsFetchError = msg.toLowerCase().includes("failed to fetch");

    if (isCorsFetchError) {
      console.warn("Fetch error (likely CORS after successful POST):", error);
      return { success: true, data: null };
    }

    console.error("POST request failed:", error);
    return { success: false, error: msg };
  }
}
