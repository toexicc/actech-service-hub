import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initOneSignal } from "./lib/onesignal";

// Initialize OneSignal for push notifications
initOneSignal();

createRoot(document.getElementById("root")!).render(<App />);
