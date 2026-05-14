import { supabase } from "@/integrations/supabase/client";
import { sendPushNotification } from "./pushNotificationSender";

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: "service_update" | "new_inquiry" | "message" | "system" | "part_request" | "others";
  read: boolean;
  createdAt: string;
  serviceId?: string;
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  receiverName: string;
  content: string;
  read: boolean;
  createdAt: string;
  groupId?: string;
}

export interface GroupChat {
  id: string;
  name: string;
  createdBy: string;
  memberIds: string[];
  memberNames: string[];
  createdAt: string;
}

export interface ReadReceipt {
  id: string;
  messageId: string;
  userId: string;
  userName: string;
  readAt: string;
}

const mapNotification = (r: any): Notification => ({
  id: r.id,
  userId: r.recipient_id ?? "",
  title: r.title ?? "",
  message: r.message ?? "",
  type: (r.category as Notification["type"]) ?? "system",
  read: !!r.is_read,
  createdAt: r.created_at ?? "",
  serviceId: r.service_id ?? undefined,
});

export const fetchNotifications = async (userId: string): Promise<Notification[]> => {
  if (!userId) return [];
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("recipient_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return [];
  return (data ?? []).map(mapNotification);
};

export const markNotificationRead = async (notificationId: string): Promise<boolean> => {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("id", notificationId);
  return !error;
};

export const markAllNotificationsRead = async (userId: string): Promise<boolean> => {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("recipient_id", userId)
    .eq("is_read", false);
  return !error;
};

export const createNotification = async (
  notification: Omit<Notification, "id" | "createdAt" | "read">
): Promise<boolean> => {
  try {
    sendPushNotification({
      userId: notification.userId,
      title: notification.title,
      message: notification.message,
      data: notification.serviceId ? { serviceId: notification.serviceId } : undefined,
    });
  } catch {}

  const { error } = await supabase.from("notifications").insert({
    recipient_id: notification.userId,
    title: notification.title,
    message: notification.message,
    category: notification.type,
    service_id: notification.serviceId ?? null,
  });
  return !error;
};

// ============ MESSAGING (thread-based) ============

export const fetchMessages = async (userId: string): Promise<Message[]> => {
  if (!userId) return [];
  const { data: memberships } = await supabase
    .from("chat_members")
    .select("thread_id")
    .eq("user_id", userId);
  const threadIds = (memberships ?? []).map((m: any) => m.thread_id);
  if (threadIds.length === 0) return [];
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .in("thread_id", threadIds)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) return [];
  return (data ?? []).map((r: any) => ({
    id: r.id,
    senderId: r.sender_id,
    senderName: r.sender_name ?? "",
    receiverId: "",
    receiverName: "",
    content: r.body ?? "",
    read: false,
    createdAt: r.created_at,
    groupId: r.thread_id,
  }));
};

// Find an existing 1:1 DM thread between two users, or create one.
// Uses a SECURITY DEFINER RPC to bypass RLS that would otherwise hide
// other users' memberships from the caller.
export const findOrCreateDmThread = async (
  _myUserId: string,
  otherUserId: string,
): Promise<string | null> => {
  if (!otherUserId) return null;
  const { data, error } = await supabase.rpc("find_or_create_dm_thread", {
    _other_user_id: otherUserId,
  });
  if (error || !data) return null;
  return data as unknown as string;
};

export const sendMessage = async (
  message: Omit<Message, "id" | "createdAt" | "read">
): Promise<boolean> => {
  // Always derive senderId from the active Supabase session so RLS
  // (sender_id = auth.uid()) is satisfied regardless of legacy callers.
  const { data: userResp } = await supabase.auth.getUser();
  const authUid = userResp?.user?.id;
  if (!authUid) return false;

  let threadId = message.groupId;
  if (!threadId && message.receiverId) {
    threadId = (await findOrCreateDmThread(authUid, message.receiverId)) ?? undefined;
  }
  if (!threadId) return false;

  const { error } = await supabase.from("messages").insert({
    thread_id: threadId,
    sender_id: authUid,
    sender_name: message.senderName,
    body: message.content,
  });
  return !error;
};

export const markMessageRead = async (_messageId: string): Promise<boolean> => true;

// ============ GROUP CHATS (chat_threads) ============

export const fetchGroupChats = async (userId: string): Promise<GroupChat[]> => {
  if (!userId) return [];
  const { data: memberships } = await supabase
    .from("chat_members")
    .select("thread_id")
    .eq("user_id", userId);
  const threadIds = (memberships ?? []).map((m: any) => m.thread_id);
  if (threadIds.length === 0) return [];
  const { data: threads } = await supabase
    .from("chat_threads")
    .select("*")
    .in("id", threadIds);
  const { data: allMembers } = await supabase
    .from("chat_members")
    .select("thread_id, user_id")
    .in("thread_id", threadIds);

  const profileIds = Array.from(new Set((allMembers ?? []).map((m: any) => m.user_id)));
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, name")
    .in("id", profileIds.length ? profileIds : ["00000000-0000-0000-0000-000000000000"]);
  const nameById = new Map((profiles ?? []).map((p: any) => [p.id, p.name]));

  return (threads ?? []).map((t: any) => {
    const members = (allMembers ?? []).filter((m: any) => m.thread_id === t.id);
    return {
      id: t.id,
      name: t.name ?? "",
      createdBy: t.created_by ?? "",
      memberIds: members.map((m: any) => m.user_id),
      memberNames: members.map((m: any) => nameById.get(m.user_id) ?? ""),
      createdAt: t.created_at,
    };
  });
};

export const createGroupChat = async (
  group: Omit<GroupChat, "id" | "createdAt">
): Promise<{ success: boolean; groupId?: string }> => {
  const { data: thread, error } = await supabase
    .from("chat_threads")
    .insert({ name: group.name, created_by: group.createdBy, is_group: true })
    .select("id")
    .single();
  if (error || !thread) return { success: false };
  const memberRows = group.memberIds.map((id) => ({ thread_id: thread.id, user_id: id }));
  if (memberRows.length) await supabase.from("chat_members").insert(memberRows);
  return { success: true, groupId: thread.id };
};

export const fetchGroupMessages = async (groupId: string): Promise<Message[]> => {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("thread_id", groupId)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) return [];
  return (data ?? []).map((r: any) => ({
    id: r.id,
    senderId: r.sender_id,
    senderName: r.sender_name ?? "",
    receiverId: "",
    receiverName: "",
    content: r.body ?? "",
    read: false,
    createdAt: r.created_at,
    groupId: r.thread_id,
  }));
};

export const sendGroupMessage = async (
  groupId: string,
  senderId: string,
  senderName: string,
  content: string
): Promise<boolean> => {
  const { error } = await supabase.from("messages").insert({
    thread_id: groupId,
    sender_id: senderId,
    sender_name: senderName,
    body: content,
  });
  return !error;
};

export const addGroupMember = async (
  groupId: string,
  memberId: string,
  _memberName: string
): Promise<boolean> => {
  const { error } = await supabase
    .from("chat_members")
    .insert({ thread_id: groupId, user_id: memberId });
  return !error;
};

export const removeGroupMember = async (
  groupId: string,
  memberId: string
): Promise<boolean> => {
  const { error } = await supabase
    .from("chat_members")
    .delete()
    .eq("thread_id", groupId)
    .eq("user_id", memberId);
  return !error;
};

export const leaveGroupChat = (groupId: string, userId: string) =>
  removeGroupMember(groupId, userId);

// ============ TYPING ============

export const setTypingStatus = async (
  userId: string,
  conversationId: string,
  _isGroup: boolean
): Promise<boolean> => {
  const { error } = await supabase
    .from("typing_indicators")
    .upsert({ user_id: userId, thread_id: conversationId, updated_at: new Date().toISOString() }, { onConflict: "user_id,thread_id" });
  return !error;
};

export const getTypingStatus = async (
  conversationId: string,
  _isGroup: boolean
): Promise<{ userId: string; timestamp: string }[]> => {
  const { data, error } = await supabase
    .from("typing_indicators")
    .select("user_id, updated_at")
    .eq("thread_id", conversationId);
  if (error) return [];
  return (data ?? []).map((r: any) => ({ userId: r.user_id, timestamp: r.updated_at }));
};

export const clearTypingStatus = async (
  userId: string,
  conversationId: string
): Promise<boolean> => {
  const { error } = await supabase
    .from("typing_indicators")
    .delete()
    .eq("user_id", userId)
    .eq("thread_id", conversationId);
  return !error;
};

// ============ READ RECEIPTS ============

export const markGroupMessageRead = async (
  messageId: string,
  userId: string,
  _userName: string
): Promise<boolean> => {
  const { error } = await supabase
    .from("read_receipts")
    .insert({ message_id: messageId, user_id: userId });
  return !error;
};

export const getMessageReadReceipts = async (
  messageId: string
): Promise<ReadReceipt[]> => {
  const { data, error } = await supabase
    .from("read_receipts")
    .select("*")
    .eq("message_id", messageId);
  if (error) return [];
  return (data ?? []).map((r: any) => ({
    id: r.id,
    messageId: r.message_id,
    userId: r.user_id,
    userName: "",
    readAt: r.read_at,
  }));
};

export const getGroupMessageReadReceipts = async (
  groupId: string
): Promise<Record<string, ReadReceipt[]>> => {
  const { data: msgs } = await supabase
    .from("messages")
    .select("id")
    .eq("thread_id", groupId);
  const msgIds = (msgs ?? []).map((m: any) => m.id);
  if (msgIds.length === 0) return {};
  const { data, error } = await supabase
    .from("read_receipts")
    .select("*")
    .in("message_id", msgIds);
  if (error) return {};
  const out: Record<string, ReadReceipt[]> = {};
  for (const r of data ?? []) {
    const rr: ReadReceipt = {
      id: r.id,
      messageId: r.message_id,
      userId: r.user_id,
      userName: "",
      readAt: r.read_at,
    };
    (out[r.message_id] ||= []).push(rr);
  }
  return out;
};
