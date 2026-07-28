import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

type Role = "admin" | "technician" | "management";

interface CreateBody {
  action: "create";
  email: string;
  password: string;
  name: string;
  username?: string;
  role: Role;
  department?: string;
  staff_id?: string;
  salary?: number;
  salary_type?: string;
  status?: string;
}
interface UpdateBody {
  action: "update";
  user_id: string;
  name?: string;
  username?: string;
  role?: Role;
  department?: string;
  staff_id?: string;
  salary?: number;
  salary_type?: string;
  status?: string;
  password?: string;
}
interface DeleteBody {
  action: "delete";
  user_id: string;
}
interface ListBody { action: "list"; }
type Body = CreateBody | UpdateBody | DeleteBody | ListBody;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Verify caller is admin or management
    const authHeader = req.headers.get("Authorization") ?? "";
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: callerRoles } = await callerClient.from("user_roles").select("role").eq("user_id", caller.id);
    const isAuthorized = (callerRoles ?? []).some((r: any) => r.role === "admin" || r.role === "management");
    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = (await req.json()) as Body;

    if (body.action === "list") {
      const emails: Record<string, string> = {};
      let page = 1;
      // paginate auth.users
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) throw error;
        for (const u of data.users) emails[u.id] = u.email ?? "";
        if (data.users.length < 1000) break;
        page += 1;
      }
      return new Response(JSON.stringify({ ok: true, emails }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (body.action === "create") {
      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email: body.email,
        password: body.password,
        email_confirm: true,
        user_metadata: { name: body.name, username: body.username ?? body.email },
      });
      if (cErr || !created.user) throw cErr ?? new Error("Create failed");
      const uid = created.user.id;
      await admin.from("profiles").upsert({
        id: uid,
        name: body.name,
        username: body.username ?? body.email,
        department: body.department ?? null,
        staff_id: body.staff_id ?? null,
        salary: body.salary ?? 0,
        salary_type: body.salary_type ?? "monthly",
        status: body.status ?? "active",
      });
      // Remove the auto-assigned admin role if this isn't the bootstrap user
      await admin.from("user_roles").delete().eq("user_id", uid);
      await admin.from("user_roles").insert({ user_id: uid, role: body.role });
      return new Response(JSON.stringify({ ok: true, user_id: uid }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (body.action === "update") {
      const updates: Record<string, unknown> = {};
      if (body.name !== undefined) updates.name = body.name;
      if (body.username !== undefined) updates.username = body.username;
      if (body.department !== undefined) updates.department = body.department;
      if (body.staff_id !== undefined) updates.staff_id = body.staff_id;
      if (body.salary !== undefined) updates.salary = body.salary;
      if (body.salary_type !== undefined) updates.salary_type = body.salary_type;
      if (body.status !== undefined) updates.status = body.status;
      if (Object.keys(updates).length > 0) {
        await admin.from("profiles").update(updates).eq("id", body.user_id);
      }
      if (body.role) {
        await admin.from("user_roles").delete().eq("user_id", body.user_id);
        await admin.from("user_roles").insert({ user_id: body.user_id, role: body.role });
      }
      if (body.password) {
        await admin.auth.admin.updateUserById(body.user_id, { password: body.password });
      }
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (body.action === "delete") {
      await admin.from("user_roles").delete().eq("user_id", body.user_id);
      const { error: profErr } = await admin.from("profiles").delete().eq("id", body.user_id);
      if (profErr) {
        // Likely FK references (services, expenses, etc.) — soft-delete instead
        await admin.from("profiles").update({ status: "inactive" }).eq("id", body.user_id);
      }
      const { error: delErr } = await admin.auth.admin.deleteUser(body.user_id);
      if (delErr) {
        return new Response(JSON.stringify({ error: delErr.message || String(delErr) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ ok: true, soft: !!profErr }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    const msg = e?.message || e?.error_description || e?.msg || (typeof e === "string" ? e : JSON.stringify(e));
    return new Response(JSON.stringify({ error: msg || "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
