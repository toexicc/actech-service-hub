import { BrowserRouter } from "react-router-dom";
import AppErrorBoundary from "@/components/AppErrorBoundary";
import QueueDisplay from "@/pages/QueueDisplay";

export default function QueueRoot() {
  return (
    <AppErrorBoundary>
      <BrowserRouter>
        <QueueDisplay />
      </BrowserRouter>
    </AppErrorBoundary>
  );
}