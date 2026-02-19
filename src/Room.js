import React, { useState } from "react";
import { supabase } from "./supabaseClient";

export default function Room({ session, setRoom }) {
  const [roomCode, setRoomCode] = useState("");

  const createRoom = async () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();

    const { data, error } = await supabase
      .from("rooms")
      .insert([
        {
          room_code: code,
          host_id: session.user.id,
          is_playing: false,
          playback_time: 0,
        },
      ])
      .select()
      .single();

    if (error) return alert(error.message);

    setRoom(data);
  };

  const joinRoom = async () => {
    const { data, error } = await supabase
      .from("rooms")
      .select("*")
      .eq("room_code", roomCode)
      .single();

    if (error) return alert("Room not found!");

    setRoom(data);
  };

  return (
    <div className="room-box">
      <h2>🎧 Group Listening</h2>

      <button onClick={createRoom} className="room-btn">
        ➕ Create Room
      </button>

      <p style={{ margin: "15px 0", color: "#bbb" }}>OR</p>

      <input
        className="room-input"
        placeholder="Enter Room Code"
        value={roomCode}
        onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
      />

      <button onClick={joinRoom} className="room-btn">
        🔗 Join Room
      </button>
    </div>
  );
}
