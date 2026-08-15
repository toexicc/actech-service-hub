import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Clock, LogIn, LogOut, ArrowLeft, Loader2, ShieldAlert } from "lucide-react";
import { getKioskCredential, kioskHeaders } from "@/lib/kioskDevice";
import acTechLogo from "@/assets/S_S_Marketing-2.png";


interface DirectoryEntry {
  id: string;
  name: string;
  username: string | null;
  staff_id: string | null;
  department: string | null;
  status: string;
  role: string | null;
}

const ROLE_GROUPS: { key: string; label: string }[] = [
  { key: "admin", label: "Admin" },
  { key: "management", label: "Management" },
  { key: "technician", label: "Technicians" },
  { key: "", label: "Other" },
];

const Attendance = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [staff, setStaff] = useState<DirectoryEntry[]>([]);
  const [staffId, setStaffId] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState<"in" | "out" | null>(null);
  const [now, setNow] = useState(new Date());
  const [kiosk] = useState(() => getKioskCredential());


  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("get_staff_directory");
      if (!error && data) {
        setStaff(
          (data as DirectoryEntry[]).filter(
            (s) =>
              (s.status || "").toLowerCase() === "active" &&
              s.name &&
              s.name !== "admin@actech.ph" &&
              s.name !== "AC Tech Admin",
          ),
        );
      }
    })();
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, DirectoryEntry[]>();
    for (const s of staff) {
      const key = (s.role || "").toLowerCase();
      const bucket = ROLE_GROUPS.find((g) => g.key === key) ? key : "";
      if (!map.has(bucket)) map.set(bucket, []);
      map.get(bucket)!.push(s);
    }
    return ROLE_GROUPS
      .map((g) => ({ ...g, items: (map.get(g.key) || []).sort((a, b) => a.name.localeCompare(b.name)) }))
      .filter((g) => g.items.length > 0);
  }, [staff]);

  const selected = useMemo(() => staff.find((s) => s.id === staffId), [staff, staffId]);

  const submit = async (action: "in" | "out") => {
    if (!staffId || !password || !selected) {
      toast({ title: "Missing fields", description: "Choose your name and enter your password.", variant: "destructive" });
      return;
    }
    setSubmitting(action);
    try {
      const email = selected.username || "";
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/record-attendance`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          ...kioskHeaders(),
        },
        body: JSON.stringify({ staffId, email, password, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const messages: Record<string, string> = {
          invalid_credentials: "Incorrect password.",
          credential_mismatch: "These credentials don't match the selected staff.",
          already_timed_in: "You already timed in today.",
          already_timed_out: "You already timed out today.",
          invalid_input: "Please complete all fields.",
          device_not_paired: "This device is not paired for attendance.",
          device_not_allowed: "This device is not allowed to record attendance.",
          network_not_allowed: "You must be on the shop WiFi to record attendance.",
        };
        toast({
          title: "Could not record",
          description: messages[data?.error] || data?.message || "Try again.",
          variant: "destructive",
        });
        return;
      }
      const tagBits: string[] = [];
      if (action === "in" && data.late) tagBits.push("LATE");
      if (action === "out" && data.overtime) tagBits.push("OVERTIME");
      toast({
        title: action === "in" ? "Time In recorded" : "Time Out recorded",
        description: `${data.staffName} • ${new Date().toLocaleTimeString()}${tagBits.length ? ` • ${tagBits.join(", ")}` : ""}`,
      });
      setPassword("");
      setStaffId("");
    } catch {
      toast({ title: "Network error", description: "Could not reach the server.", variant: "destructive" });
    } finally {
      setSubmitting(null);
    }
  };

  if (!kiosk) {
    return (
      <div className="min-h-screen min-h-[100dvh] flex flex-col items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <ShieldAlert className="h-5 w-5 text-destructive" /> Device not paired
            </CardTitle>
            <CardDescription>
              Attendance can only be recorded on the shop's paired kiosk device while connected to the shop WiFi.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              A management user must sign in on this device and pair it under Kiosk Devices.
            </p>
            <Button className="w-full" onClick={() => navigate("/kiosk-devices")}>
              Pair this device
            </Button>
            <Button variant="outline" className="w-full" onClick={() => navigate("/")}>
              Back to sign in
            </Button>

          </CardContent>
        </Card>
      </div>
    );
  }



  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col items-center justify-center p-4 bg-background">
      <div className="absolute top-4 left-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
      </div>
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3">
            <div className="p-3 rounded-2xl bg-card shadow-lg border border-border/50">
              <img src={acTechLogo} alt="AC Tech" className="h-14 w-14 object-contain rounded-lg" />
            </div>
          </div>
          <h1 className="text-2xl font-bold">Employee Attendance</h1>
          <p className="text-sm text-muted-foreground">Time In before 10:00 AM • Time Out at 7:00 PM</p>
        </div>

        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Clock className="h-5 w-5 text-primary" />
              {now.toLocaleTimeString()}
            </CardTitle>
            <CardDescription>{now.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Employee</Label>
              <Select value={staffId} onValueChange={setStaffId}>
                <SelectTrigger><SelectValue placeholder="Select your name" /></SelectTrigger>
                <SelectContent className="max-h-[280px]">
                  {grouped.map((g) => (
                    <div key={g.key || "other"}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        {g.label}
                      </div>
                      {g.items.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" autoComplete="off" />
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button onClick={() => submit("in")} disabled={submitting !== null} className="h-12">
                {submitting === "in" ? <Loader2 className="h-4 w-4 animate-spin" /> : <><LogIn className="h-4 w-4 mr-2" />Time In</>}
              </Button>
              <Button onClick={() => submit("out")} disabled={submitting !== null} variant="secondary" className="h-12">
                {submitting === "out" ? <Loader2 className="h-4 w-4 animate-spin" /> : <><LogOut className="h-4 w-4 mr-2" />Time Out</>}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Attendance;
