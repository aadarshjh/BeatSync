import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "./supabaseClient";

export default function RoomChat({ room, session }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");

  const fetchMessages = useCallback(async () => {
    if (!room) return;

    const last2Min = new Date(Date.now() - 2 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("room_messages")
      .select("*")
      .eq("room_code", room.room_code)
      .gte("created_at", last2Min)
      .order("created_at", { ascending: true });

    if (!error) setMessages(data);
  }, [room]);

  // Fetch + realtime insert listener
  useEffect(() => {
    if (!room) return;

    fetchMessages();

    const channel = supabase
      .channel(`chat-${room.room_code}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "room_messages",
          filter: `room_code=eq.${room.room_code}`,
        },
        (payload) => {
          const newMsg = payload.new;

          const cutoff = Date.now() - 2 * 60 * 1000;
          const msgTime = new Date(newMsg.created_at).getTime();

          if (msgTime >= cutoff) {
            setMessages((prev) => [...prev, newMsg]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room, fetchMessages]);

  // Auto delete old messages every 30 sec
  useEffect(() => {
    if (!room) return;

    const interval = setInterval(async () => {
      const cutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString();

      await supabase
        .from("room_messages")
        .delete()
        .eq("room_code", room.room_code)
        .lt("created_at", cutoff);

      fetchMessages();
    }, 30000);

    return () => clearInterval(interval);
  }, [room, fetchMessages]);

  const sendMessage = async () => {
    if (!text.trim()) return;

    const { error } = await supabase.from("room_messages").insert([
      {
        room_code: room.room_code,
        user_id: session.user.id,
        message: text,
      },
    ]);

    if (error) alert(error.message);
    else setText("");
  };

  return (
    <div className="chat-box">
      <h3>💬 Room Chat (Auto Deletes in 2 min)</h3>

      <div className="chat-messages">
        {messages.length === 0 ? (
          <p style={{ color: "gray" }}>No messages yet...</p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`chat-message ${
                msg.user_id === session.user.id ? "me" : "other"
              }`}
            >
              <span>{msg.message}</span>
            </div>
          ))
        )}
      </div>

      <div className="chat-input">
        <input
          value={text}
          placeholder="Type message..."
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
}
