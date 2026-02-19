import React, { useState } from "react";
import { supabase } from "./supabaseClient";

export default function Room({ session, setRoom }) {
  const [roomCode, setRoomCode] = useState("");

  const createRoom = async () => {
    const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const { data, error } = await supabase
      .from("rooms")
      .insert([
        {
          room_code: newCode,
          host_id: session.user.id,
          is_playing: false,
          playback_time: 0,
        },
      ])
      .select()
      .single();

    if (error) return alert(error.message);

    setRoom(data);
    alert("Room Created: " + newCode);
  };

  const joinRoom = async () => {
    if (!roomCode.trim()) return alert("Enter room code!");

    const { data, error } = await supabase
      .from("rooms")
      .select("*")
      .eq("room_code", roomCode.toUpperCase())
      .single();

    if (error) return alert("Room not found!");

    setRoom(data);
    alert("Joined Room: " + roomCode.toUpperCase());
  };

  return (
    <div className="room-box">
      <h2>🎧 Group Listening</h2>

      <button className="btn-green" onClick={createRoom}>
        ➕ Create Room
      </button>

      <p className="or-text">OR</p>

      <div className="join-room">
        <input
          className="input-box"
          type="text"
          placeholder="Enter Room Code"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value)}
        />

        <button className="btn-green" onClick={joinRoom}>
          🔗 Join Room
        </button>
      </div>
    </div>
  );
}
