import React, { useEffect, useRef, useState } from "react";
import YouTube from "react-youtube";
import { supabase } from "./supabaseClient";

export default function RoomYouTubePlayer({ room, session }) {
  const playerRef = useRef(null);
  const [ready, setReady] = useState(false);

  const [showVideo, setShowVideo] = useState(false);

  const isHost = room.host_id === session.user.id;

  const onReady = (event) => {
    playerRef.current = event.target;
    setReady(true);
  };

  // HOST sends sync updates every 2 sec
  useEffect(() => {
    if (!ready || !room.current_video_id) return;
    if (!isHost) return;

    const interval = setInterval(async () => {
      if (!playerRef.current) return;

      const time = await playerRef.current.getCurrentTime();
      const state = await playerRef.current.getPlayerState();

      const playing = state === 1;

      await supabase
        .from("rooms")
        .update({
          playback_time: time,
          is_playing: playing,
        })
        .eq("room_code", room.room_code);
    }, 2000);

    return () => clearInterval(interval);
  }, [ready, room, isHost]);

  // LISTENER applies sync
  useEffect(() => {
    if (!ready || !room.current_video_id) return;
    if (isHost) return;

    const sync = async () => {
      if (!playerRef.current) return;

      const localTime = await playerRef.current.getCurrentTime();
      const serverTime = room.playback_time || 0;

      const drift = Math.abs(localTime - serverTime);

      if (drift > 1) {
        playerRef.current.seekTo(serverTime, true);
      }

      if (room.is_playing) {
        playerRef.current.playVideo();
      } else {
        playerRef.current.pauseVideo();
      }
    };

    sync();
  }, [room.playback_time, room.is_playing, room.current_video_id, ready, isHost]);

  // HOST controls play/pause
  const togglePlayPause = async () => {
    if (!isHost) return;

    if (!playerRef.current) return;

    const state = await playerRef.current.getPlayerState();

    if (state === 1) {
      playerRef.current.pauseVideo();

      await supabase
        .from("rooms")
        .update({ is_playing: false })
        .eq("room_code", room.room_code);
    } else {
      playerRef.current.playVideo();

      await supabase
        .from("rooms")
        .update({ is_playing: true })
        .eq("room_code", room.room_code);
    }
  };

  return (
    <div className="yt-room-player">
      <h3>🎬 Room YouTube Player</h3>

      {!room.current_video_id ? (
        <p style={{ color: "gray" }}>
          Host has not selected any YouTube song yet.
        </p>
      ) : (
        <>
          <div className="yt-player-controls">
            <button
              className="btn-blue"
              onClick={() => setShowVideo(!showVideo)}
            >
              {showVideo ? "🎧 Audio Only" : "🎬 Show Video"}
            </button>

            {isHost && (
              <button className="btn-green" onClick={togglePlayPause}>
                ⏯ Play/Pause
              </button>
            )}
          </div>

          <div className="yt-video-box">
            <YouTube
              videoId={room.current_video_id}
              onReady={onReady}
              opts={{
                width: "100%",
                height: showVideo ? "350" : "0",
                playerVars: {
                  autoplay: 1,
                },
              }}
            />
          </div>

          {!isHost && (
            <p style={{ color: "#bbb", marginTop: "10px", fontSize: "13px" }}>
              ⚠️ If autoplay doesn’t start, click play once.
            </p>
          )}
        </>
      )}
    </div>
  );
}
