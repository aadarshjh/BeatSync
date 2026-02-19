import React, { useEffect, useRef, useState } from "react";
import YouTube from "react-youtube";
import { supabase } from "./supabaseClient";

export default function YouTubeMiniPlayer({ room, session }) {
  const playerRef = useRef(null);

  const [songInfo, setSongInfo] = useState(null);
  const [showVideo, setShowVideo] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const isHost = room && session && room.host_id === session.user.id;

  // Fetch title + thumbnail from youtube_library
  useEffect(() => {
    if (!room?.current_video_id) return;

    const fetchVideoInfo = async () => {
      const { data, error } = await supabase
        .from("youtube_library")
        .select("*")
        .eq("video_id", room.current_video_id)
        .single();

      if (!error) setSongInfo(data);
    };

    fetchVideoInfo();
  }, [room?.current_video_id]);

  // On ready
  const onReady = (event) => {
    playerRef.current = event.target;
    setIsReady(true);
  };

  // LISTENER sync play/pause + time
  useEffect(() => {
    if (!room?.current_video_id) return;
    if (!isReady) return;
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
  }, [room.playback_time, room.is_playing, room.current_video_id, isReady, isHost]);

  // HOST sends time updates every 2 sec
  useEffect(() => {
    if (!room?.current_video_id) return;
    if (!isReady) return;
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
  }, [room, isReady, isHost]);

  // HOST play/pause
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

  if (!room?.current_video_id) return null;

  return (
    <div className="yt-mini-player">
      {/* LEFT */}
      <div className="yt-mini-left">
        <img
          src={songInfo?.thumbnail || "https://via.placeholder.com/60"}
          alt="thumb"
          className="yt-mini-thumb"
        />

        <div className="yt-mini-text">
          <p className="yt-mini-title">
            {songInfo?.title || "Playing YouTube Song"}
          </p>
          <p className="yt-mini-channel">
            {songInfo?.channel_title || "BeatSync Room"}
          </p>
        </div>
      </div>

      {/* CENTER */}
      <div className="yt-mini-center">
        {isHost ? (
          <button className="yt-mini-btn" onClick={togglePlayPause}>
            {room.is_playing ? "⏸" : "▶"}
          </button>
        ) : (
          <p className="yt-mini-note">🎧 Host controlling</p>
        )}
      </div>

      {/* RIGHT */}
      <div className="yt-mini-right">
        <button className="yt-mini-btn" onClick={() => setShowVideo(!showVideo)}>
          {showVideo ? "🎧" : "🎬"}
        </button>
      </div>

      {/* Hidden / Visible YouTube */}
      <div className="yt-mini-video-box">
        <YouTube
          videoId={room.current_video_id}
          onReady={onReady}
          opts={{
            width: "100%",
            height: showVideo ? "280" : "0",
            playerVars: {
              autoplay: 1,
            },
          }}
        />
      </div>
    </div>
  );
}
