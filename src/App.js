import React, { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "./supabaseClient";
import Auth from "./Auth";
import UploadSong from "./UploadSong";
import Playlist from "./Playlist";
import Room from "./Room";
import "./App.css";

export default function App() {
  const [session, setSession] = useState(null);

  const [songs, setSongs] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const [volume, setVolume] = useState(1);

  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState("off"); // off, all, one

  const [room, setRoom] = useState(null);

  const audioRef = useRef(null);

  // Get session
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  // Fetch songs from Supabase DB
  const fetchSongs = useCallback(async () => {
    if (!session) return;

    const { data, error } = await supabase
      .from("songs")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setSongs(data);

    if (data.length > 0 && currentIndex >= data.length) {
      setCurrentIndex(0);
    }
  }, [session, currentIndex]);

  // Fetch songs after login
  useEffect(() => {
    if (session) fetchSongs();
  }, [session, fetchSongs]);

  // Load song when index changes
  useEffect(() => {
    if (!songs.length) return;

    audioRef.current.load();

    if (isPlaying) {
      audioRef.current.play();
    }
  }, [currentIndex, songs, isPlaying]);

  // -------------------------
  // GROUP LISTENING REALTIME
  // -------------------------
  useEffect(() => {
    if (!room) return;

    const channel = supabase
      .channel("room-sync")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rooms",
          filter: `room_code=eq.${room.room_code}`,
        },
        (payload) => {
          const updatedRoom = payload.new;
          setRoom(updatedRoom);

          // Sync song
          if (updatedRoom.current_song_url) {
            const songIndex = songs.findIndex(
              (s) => s.song_url === updatedRoom.current_song_url
            );

            if (songIndex !== -1) {
              setCurrentIndex(songIndex);
            }
          }

          // Sync time
          if (audioRef.current) {
            audioRef.current.currentTime = updatedRoom.playback_time || 0;
          }

          // Sync play/pause
          if (updatedRoom.is_playing) {
            audioRef.current.play();
            setIsPlaying(true);
          } else {
            audioRef.current.pause();
            setIsPlaying(false);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room, songs]);

  // Check if current user is host
  const isHost = room && session && room.host_id === session.user.id;

  // Update room (only host can update)
  const updateRoom = async (updates) => {
    if (!room || !isHost) return;

    await supabase
      .from("rooms")
      .update(updates)
      .eq("room_code", room.room_code);
  };

  // Delete Song (DB only)
  const deleteSong = async (song) => {
    try {
      const { error } = await supabase.from("songs").delete().eq("id", song.id);

      if (error) throw error;

      alert("Song deleted from database!");
      fetchSongs();
    } catch (err) {
      alert(err.message);
    }
  };

  // Play/Pause
  const togglePlay = async () => {
    if (!songs.length) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);

      await updateRoom({
        current_song_url: songs[currentIndex].song_url,
        current_song_name: songs[currentIndex].song_name,
        playback_time: audioRef.current.currentTime,
        is_playing: false,
      });
    } else {
      audioRef.current.play();
      setIsPlaying(true);

      await updateRoom({
        current_song_url: songs[currentIndex].song_url,
        current_song_name: songs[currentIndex].song_name,
        playback_time: audioRef.current.currentTime,
        is_playing: true,
      });
    }
  };

  // Next Song
  const nextSong = async () => {
    if (!songs.length) return;

    let nextIndex;

    if (shuffle) {
      nextIndex = Math.floor(Math.random() * songs.length);
    } else {
      nextIndex = (currentIndex + 1) % songs.length;
    }

    if (repeat === "off" && currentIndex === songs.length - 1 && !shuffle) {
      setIsPlaying(false);
      return;
    }

    setCurrentIndex(nextIndex);
    setIsPlaying(true);

    await updateRoom({
      current_song_url: songs[nextIndex].song_url,
      current_song_name: songs[nextIndex].song_name,
      playback_time: 0,
      is_playing: true,
    });
  };

  // Previous Song
  const prevSong = async () => {
    if (!songs.length) return;

    let prevIndex;

    if (shuffle) {
      prevIndex = Math.floor(Math.random() * songs.length);
    } else {
      prevIndex = (currentIndex - 1 + songs.length) % songs.length;
    }

    setCurrentIndex(prevIndex);
    setIsPlaying(true);

    await updateRoom({
      current_song_url: songs[prevIndex].song_url,
      current_song_name: songs[prevIndex].song_name,
      playback_time: 0,
      is_playing: true,
    });
  };

  // Song End
  const handleSongEnd = async () => {
    if (repeat === "one") {
      audioRef.current.currentTime = 0;
      audioRef.current.play();

      await updateRoom({
        playback_time: 0,
        is_playing: true,
      });

      return;
    }

    nextSong();
  };

  // Repeat Toggle
  const toggleRepeat = () => {
    if (repeat === "off") setRepeat("all");
    else if (repeat === "all") setRepeat("one");
    else setRepeat("off");
  };

  // Seek
  const handleSeek = async (e) => {
    const newTime = e.target.value;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);

    await updateRoom({
      playback_time: newTime,
    });
  };

  // Time Update
  const handleTimeUpdate = () => {
    setCurrentTime(audioRef.current.currentTime);
  };

  // Duration Update
  const handleLoadedMetadata = () => {
    setDuration(audioRef.current.duration);
  };

  // Volume
  const handleVolume = (e) => {
    const newVol = e.target.value;
    setVolume(newVol);
    audioRef.current.volume = newVol;
  };

  // Format Time
  const formatTime = (time) => {
    if (!time) return "0:00";
    const min = Math.floor(time / 60);
    const sec = Math.floor(time % 60);
    return `${min}:${sec < 10 ? "0" : ""}${sec}`;
  };

  // Logout
  const logout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setSongs([]);
    setCurrentIndex(0);
    setIsPlaying(false);
    setRoom(null);
  };

  return (
    <div className="app">
      <h1>🎵 BeatSync Music Player</h1>

      {!session ? (
        <Auth setSession={setSession} />
      ) : (
        <div className="dashboard">
          <div className="top-bar">
            <p>Logged in as: {session.user.email}</p>
            <button onClick={logout}>Logout</button>
          </div>

          {!room ? (
            <Room session={session} setRoom={setRoom} />
          ) : (
            <div className="room-info">
              <h3>
                Room Code:{" "}
                <span style={{ color: "#1db954" }}>{room.room_code}</span>
              </h3>

              <p style={{ color: "#bbb" }}>
                {isHost ? "👑 You are Host" : "🎧 You are Listener"}
              </p>

              <button onClick={() => setRoom(null)}>❌ Leave Room</button>
            </div>
          )}

          <UploadSong user={session.user} refreshSongs={fetchSongs} />

          {songs.length > 0 ? (
            <div className="player">
              <h2>Now Playing:</h2>
              <p className="song-name">{songs[currentIndex]?.song_name}</p>

              <audio
                ref={audioRef}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={handleSongEnd}
              >
                <source src={songs[currentIndex]?.song_url} type="audio/mpeg" />
              </audio>

              <div className="controls">
                <button
                  onClick={() => setShuffle(!shuffle)}
                  className={shuffle ? "active-btn" : ""}
                >
                  🔀 Shuffle
                </button>

                <button onClick={prevSong}>⏮ Prev</button>

                <button onClick={togglePlay}>
                  {isPlaying ? "⏸ Pause" : "▶ Play"}
                </button>

                <button onClick={nextSong}>Next ⏭</button>

                <button
                  onClick={toggleRepeat}
                  className={repeat !== "off" ? "active-btn" : ""}
                >
                  🔁 Repeat: {repeat}
                </button>
              </div>

              <div className="seek-bar">
                <span>{formatTime(currentTime)}</span>

                <input
                  type="range"
                  min="0"
                  max={duration || 0}
                  value={currentTime}
                  onChange={handleSeek}
                />

                <span>{formatTime(duration)}</span>
              </div>

              <div className="volume">
                <label>🔊 Volume:</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={handleVolume}
                />
              </div>

              <Playlist
                songs={songs}
                currentIndex={currentIndex}
                setCurrentIndex={setCurrentIndex}
                deleteSong={deleteSong}
              />
            </div>
          ) : (
            <p style={{ color: "gray", marginTop: "20px" }}>
              No songs uploaded yet. Upload some MP3 files 🎶
            </p>
          )}
        </div>
      )}
    </div>
  );
}
