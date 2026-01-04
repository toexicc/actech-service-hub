import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ONESIGNAL_APP_ID = "0ba186cc-b8d9-4573-83f1-cc2ea6b9e841";
const ONESIGNAL_REST_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PushNotificationRequest {
  userId: string;        // The external_user_id set via OneSignal.login()
  title: string;
  message: string;
  url?: string;          // Optional URL to open when notification is clicked
  data?: Record<string, unknown>; // Optional additional data
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!ONESIGNAL_REST_API_KEY) {
      console.error("ONESIGNAL_REST_API_KEY is not set");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { userId, title, message, url, data }: PushNotificationRequest = await req.json();

    if (!userId || !title || !message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: userId, title, message" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Sending push notification to user: ${userId}`);
    console.log(`Title: ${title}`);
    console.log(`Message: ${message}`);

    // Send push notification via OneSignal REST API
    const oneSignalPayload: Record<string, unknown> = {
      app_id: ONESIGNAL_APP_ID,
      include_aliases: {
        external_id: [userId],
      },
      target_channel: "push",
      headings: { en: title },
      contents: { en: message },
    };

    // Add URL if provided
    if (url) {
      oneSignalPayload.url = url;
    }

    // Add custom data if provided
    if (data) {
      oneSignalPayload.data = data;
    }

    const response = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify(oneSignalPayload),
    });

    const responseData = await response.json();
    console.log("OneSignal API response:", JSON.stringify(responseData));

    if (!response.ok) {
      console.error("OneSignal API error:", responseData);
      return new Response(
        JSON.stringify({ error: "Failed to send push notification", details: responseData }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: responseData }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in send-push-notification:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
