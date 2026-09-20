import { useToast } from "@/hooks/use-toast";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";

/**
 * macOS-style notification banners: they slide in at the top-right just below
 * the app header, stack, and disappear on their own after ~5 seconds.
 */
export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider duration={5000} swipeDirection="right">
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-0.5">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
