import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getKioskCredential, saveKioskCredential, clearKioskCredential } from "@/lib/kioskDevice";
import { ArrowLeft, Loader2, MonitorSmartphone, ShieldCheck, Trash2, Wifi } from "lucide-react";

interface KioskDevice {
  id: string;
  label: string;
  purpose: string;
  allowed_ip: string | null;
  is_active: boolean;
  last_seen_at: string | null;
  last_seen_ip: string | null;
  created_at: string;
}

const KioskDevices = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [devices, setDevices] = useState<KioskDevice[]>([]);
  const [ip, setIp] = useState("");
  const [label, setLabel] = useState("Front Desk iPad");
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [paired, setPaired] = useState(getKioskCredential());

  const call = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("kiosk-pair", { body });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const load = async () => {
    try {
      const data = await call({ action: "list" });
      setDevices(data.devices || []);
      setIp(data.ip || "");
    } catch (e) {
      toast({
        title: "Could not load kiosk devices",
        description: e instanceof Error ? e.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pairThisDevice = async () => {
    if (!label.trim()) {
      toast({ title: "Name this device first", variant: "destructive" });
      return;
    }
    setBusy("pair");
    try {
      const data = await call({ action: "pair", label: label.trim() });
      saveKioskCredential({ deviceId: data.device.id, secret: data.secret, label: data.device.label });
      setPaired(getKioskCredential());
      toast({
        title: "This device is paired",
        description: `Attendance is now locked to this device on ${data.device.allowed_ip}.`,
      });
      await load();
    } catch (e) {
      toast({
        title: "Pairing failed",
        description: e instanceof Error ? e.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  const act = async (id: string, body: Record<string, unknown>, message: string) => {
    setBusy(id);
    try {
      await call({ ...body, id });
      toast({ title: message });
      await load();
    } catch (e) {
      toast({
        title: "Action failed",
        description: e instanceof Error ? e.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen min-h-[100dvh] bg-background p-4 sm:p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/menu")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <Badge variant="secondary" className="gap-1">
            <Wifi className="h-3 w-3" /> {ip || "detecting IP..."}
          </Badge>
        </div>

        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" /> Attendance Kiosk Devices
          </h1>
          <p className="text-sm text-muted-foreground">
            The attendance page only works on a paired device that is also on the allowed network.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MonitorSmartphone className="h-5 w-5" /> Pair this device
            </CardTitle>
            <CardDescription>
              Open this page on the iPad itself, then pair. Its current network IP ({ip || "..."}) becomes the
              allowed shop network.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {paired ? (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                This device is already paired as <strong>{paired.label || "kiosk"}</strong>.
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => navigate("/attendance")}>
                    Open attendance
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      clearKioskCredential();
                      setPaired(null);
                      toast({ title: "Pairing removed from this device" });
                    }}
                  >
                    Unpair locally
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label>Device name</Label>
                  <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Front Desk iPad" />
                </div>
                <Button onClick={pairThisDevice} disabled={busy === "pair"}>
                  {busy === "pair" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Pair this device
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Registered devices</CardTitle>
            <CardDescription>Deactivate or remove a device to instantly revoke its access.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : devices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No devices paired yet.</p>
            ) : (
              devices.map((d) => (
                <div
                  key={d.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0">
                    <div className="font-medium flex items-center gap-2">
                      {d.label}
                      {d.is_active ? (
                        <Badge variant="secondary">Active</Badge>
                      ) : (
                        <Badge variant="destructive">Disabled</Badge>
                      )}
                      {paired?.deviceId === d.id ? <Badge>This device</Badge> : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Allowed network: {d.allowed_ip || "any"}
                      {d.last_seen_at ? ` • last used ${new Date(d.last_seen_at).toLocaleString()}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy === d.id}
                      onClick={() => act(d.id, { action: "set_ip" }, "Allowed network updated")}
                    >
                      Use current IP
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy === d.id}
                      onClick={() =>
                        act(
                          d.id,
                          { action: "set_active", is_active: !d.is_active },
                          d.is_active ? "Device disabled" : "Device enabled",
                        )
                      }
                    >
                      {d.is_active ? "Disable" : "Enable"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy === d.id}
                      onClick={() => act(d.id, { action: "delete" }, "Device removed")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default KioskDevices;
