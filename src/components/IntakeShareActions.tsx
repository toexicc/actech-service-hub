import { ShareLinkActions } from "@/components/ShareLinkActions";

const INTAKE_URL = "https://actechrepair-service.com/intake";

export function IntakeShareActions() {
  return (
    <ShareLinkActions
      url={INTAKE_URL}
      buttonLabel="Share intake link"
      dialogTitle="Share intake link"
      dialogDescription="Scan or share this QR code to open the client intake form."
      shareTitle="AC Tech Repair — Client Intake"
      shareText="Submit your device for repair"
      downloadName="actech-intake-link.png"
      qrAlt="QR code linking to the AC Tech Repair client intake form"
    />
  );
}

export default IntakeShareActions;
