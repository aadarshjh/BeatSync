import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "./supabaseClient";

export default function RoomMembers({ room, session }) {
  const [members, setMembers] = useState([]);

  const fetchMembers = useCallback(async () => {
    if (!room) return;

    const { data, error } = await supabase
      .from("room_members")
      .select("*")
      .eq("room_code", room.room_code)
      .order("joined_at", { ascending: true });

    if (!error) setMembers(data);
  }, [room]);

  // Fetch members + realtime updates
  useEffect(() => {
    if (!room) return;

    fetchMembers();

    const channel = supabase
      .channel(`members-${room.room_code}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_members",
          filter: `room_code=eq.${room.room_code}`,
        },
        () => {
          fetchMembers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room, fetchMembers]);

  // Join room if not already joined
  useEffect(() => {
    if (!room || !session) return;

    const joinRoom = async () => {
      const { data } = await supabase
        .from("room_members")
        .select("*")
        .eq("room_code", room.room_code)
        .eq("user_id", session.user.id);

      if (data && data.length > 0) return;

      await supabase.from("room_members").insert([
        {
          room_code: room.room_code,
          user_id: session.user.id,
          user_email: session.user.email,
        },
      ]);
    };

    joinRoom();
  }, [room, session]);

  // Heartbeat update (last_seen every 10 sec)
  useEffect(() => {
    if (!room || !session) return;

    const interval = setInterval(async () => {
      await supabase
        .from("room_members")
        .update({ last_seen: new Date().toISOString() })
        .eq("room_code", room.room_code)
        .eq("user_id", session.user.id);
    }, 10000);

    return () => clearInterval(interval);
  }, [room, session]);

  // Online check (if last_seen within 20 sec)
  const isOnline = (lastSeen) => {
    const last = new Date(lastSeen).getTime();
    return Date.now() - last < 20000;
  };

  return (
    <div className="members-box">
      <h3>👥 Room Members</h3>

      {members.length === 0 ? (
        <p style={{ color: "gray" }}>No members yet.</p>
      ) : (
        members.map((m) => (
          <div key={m.id} className="member-item">
            <span>{m.user_email}</span>
            <span className={isOnline(m.last_seen) ? "online" : "offline"}>
              {isOnline(m.last_seen) ? "🟢 Online" : "⚫ Offline"}
            </span>
          </div>
        ))
      )}
    </div>
  );
}
