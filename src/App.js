import React, { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "./supabaseClient";
import Auth from "./Auth";
import UploadSong from "./UploadSong";
import Playlist from "./Playlist";
import Room from "./Room";
import RoomPlaylist from "./RoomPlaylist";
import RoomChat from "./RoomChat";
import RoomMembers from "./RoomMembers";
import YouTubeLibrary from "./YouTubeLibrary";
import RoomYouTubePlayer from "./RoomYouTubePlayer";
import "./App.css";

export default function App() {
  const [session, setSession] = useState(null);

  // Pages
  const [page, setPage] = useState("player"); // player, library

  // Personal Songs
  const [songs, setSongs] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Room Songs
  const [roomSongs, setRoomSongs] = useState([]);
  const [roomCurrentIndex, setRoomCurrentIndex] = useState(0);

  // Player
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  // Player modes
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState("off"); // off, all, one

  // Room
  const [room, setRoom] = useState(null);

  const audioRef = useRef(null);

  // ---------------------------
  // SESSION
  // ---------------------------
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

  // ---------------------------
  // HOST CHECK
  // ---------------------------
  const isHost = room && session && room.host_id === session.user.id;
  const canControlPlayer = !room || isHost;

  // ---------------------------
  // FETCH PERSONAL SONGS
  // ---------------------------
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

    setSongs(data || []);

    if (data?.length > 0 && currentIndex >= data.length) {
      setCurrentIndex(0);
    }
  }, [session, currentIndex]);

  useEffect(() => {
    if (session) fetchSongs();
  }, [session, fetchSongs]);

  // ---------------------------
  // FETCH ROOM SONGS
  // ---------------------------
  const fetchRoomSongs = useCallback(async () => {
    if (!room) return;

    const { data, error } = await supabase
      .from("room_songs")
      .select("*")
      .eq("room_code", room.room_code)
      .order("created_at", { ascending: true });

    console.log("ROOM SONGS FETCHED:", data);
    console.log("ROOM SONGS ERROR:", error);

    if (error) {
      alert(error.message);
      return;
    }

    setRoomSongs(data || []);

    if (data?.length > 0 && roomCurrentIndex >= data.length) {
      setRoomCurrentIndex(0);
    }
  }, [room, roomCurrentIndex]);
  useEffect(() => {
    if (!room) return;

    const loadRoomSongs = async () => {
      const { data, error } = await supabase
        .from("room_songs")
        .select("*")
        .eq("room_code", room.room_code)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Room songs fetch error:", error);
        return;
      }

      console.log("Room songs loaded:", data);
      setRoomSongs(data || []);
    };

    loadRoomSongs();
  }, [room]);

  // ---------------------------
  // SYNC WHEN USER JOINS ROOM
  // ---------------------------

  useEffect(() => {
    if (!room) return;
    if (!roomSongs.length) return;
    if (!audioRef.current) return;

    const syncOnJoin = async () => {
      const { data, error } = await supabase
        .from("rooms")
        .select("*")
        .eq("room_code", room.room_code)
        .single();

      if (error || !data) return;

      const idx = roomSongs.findIndex(
        (s) => s.song_url === data.current_song_url
      );

      if (idx !== -1) {
        setRoomCurrentIndex(idx);
      }

      setTimeout(() => {
        if (!audioRef.current) return;

        audioRef.current.currentTime = data.playback_time || 0;

        if (data.is_playing) {
          audioRef.current.play().catch(() => {
            alert("Click play once to enable audio 🎧");
          });
          setIsPlaying(true);
        }
      }, 300);
    };

    syncOnJoin();

  }, [room, roomSongs, audioRef]);



  // ---------------------------
  // ACTIVE PLAYLIST SOURCE
  // ---------------------------
  const activePlaylist = room ? roomSongs : songs;
  const activeIndex = room ? roomCurrentIndex : currentIndex;

  // ---------------------------
  // LOAD SONG WHEN INDEX CHANGES
  // ---------------------------
  useEffect(() => {
    if (!activePlaylist.length) return;
    if (!audioRef.current) return;

    audioRef.current.src = activePlaylist[activeIndex]?.song_url;
    audioRef.current.load();
  }, [activeIndex, activePlaylist]);


  // ---------------------------
  // UPDATE ROOM (HOST ONLY)
  // ---------------------------
  const updateRoom = async (updates) => {
    if (!room || !isHost) return;

    await supabase
      .from("rooms")
      .update(updates)
      .eq("room_code", room.room_code);
  };

  // ---------------------------
  // ADD SONG TO ROOM
  // ---------------------------
  const addSongToRoom = async (song) => {
    if (!room) return;

    const { data, error } = await supabase
      .from("room_songs")
      .insert([
        {
          room_code: room.room_code,
          song_name: song.song_name,
          song_url: song.song_url,
          added_by: session.user.id,
        },
      ])
      .select();

    console.log("INSERTED ROOM SONG:", data);
    console.log("INSERT ERROR:", error);

    if (error) {
      alert("Insert Failed: " + error.message);
      return;
    }

    alert("Song added to Room Playlist!");
    fetchRoomSongs();
  };

  // ---------------------------
  // REALTIME ROOM SYNC (CLEAN VERSION)
  // ---------------------------
  useEffect(() => {
    if (!room) return;

    const channel = supabase
      .channel(`room-sync-${room.room_code}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rooms",
          filter: `room_code=eq.${room.room_code}`,
        },
        async (payload) => {
          const updatedRoom = payload.new;

          // Host should ignore its own updates
          if (session && updatedRoom.host_id === session.user.id) return;

          // Find correct song
          const idx = roomSongs.findIndex(
            (s) => s.song_url === updatedRoom.current_song_url
          );

          if (idx !== -1) {
            setRoomCurrentIndex(idx);
          }

          // Wait until audio exists
          setTimeout(() => {
            if (!audioRef.current) return;

            audioRef.current.currentTime = updatedRoom.playback_time || 0;

            if (updatedRoom.is_playing) {
              audioRef.current.play().catch(() => {
                console.log("Autoplay blocked");
              });
              setIsPlaying(true);
            } else {
              audioRef.current.pause();
              setIsPlaying(false);
            }
          }, 200);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room, roomSongs, session]);


  // ---------------------------
  // REALTIME ROOM PLAYER SYNC
  // ---------------------------
  useEffect(() => {
    if (!room) return;

    const channel = supabase
      .channel(`room-sync-${room.room_code}`)
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

          // Host ignore updates
          if (session && updatedRoom.host_id === session.user.id) return;

          // Sync MP3 song index (if host using MP3 mode)
          if (updatedRoom.current_song_url) {
            const idx = roomSongs.findIndex(
              (s) => s.song_url === updatedRoom.current_song_url
            );

            if (idx !== -1) {
              setRoomCurrentIndex(idx);
            }
          }

          // Drift correction for MP3 player
          if (audioRef.current && updatedRoom.playback_time !== null) {
            const serverTime = updatedRoom.playback_time || 0;
            const localTime = audioRef.current.currentTime;
            const drift = Math.abs(localTime - serverTime);

            if (drift > 0.7) {
              audioRef.current.currentTime = serverTime;
            }
          }

          // Play/Pause sync for MP3 player (Autoplay fix)
          if (audioRef.current) {
            if (updatedRoom.is_playing) {
              audioRef.current.play().catch(() => {
                alert("Click Play once to enable audio on this device 🎧");
              });
              setIsPlaying(true);
            } else {
              audioRef.current.pause();
              setIsPlaying(false);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room, roomSongs, session]);

  // ---------------------------
  // DRIFT SYNC TIMER (HOST MP3)
  // ---------------------------
  useEffect(() => {
    if (!room || !session || !isHost) return;
    if (!roomSongs.length) return;

    const interval = setInterval(async () => {
      if (!audioRef.current) return;

      await supabase
        .from("rooms")
        .update({
          playback_time: audioRef.current.currentTime,
          is_playing: !audioRef.current.paused,
          current_song_url: roomSongs[roomCurrentIndex]?.song_url,
          current_song_name: roomSongs[roomCurrentIndex]?.song_name,
        })
        .eq("room_code", room.room_code);
    }, 2000);

    return () => clearInterval(interval);
  }, [room, session, isHost, roomSongs, roomCurrentIndex]);

  // ---------------------------
  // DELETE PERSONAL SONG
  // ---------------------------
  const deleteSong = async (song) => {
    try {
      const { error } = await supabase.from("songs").delete().eq("id", song.id);

      if (error) throw error;

      alert("Song deleted!");
      fetchSongs();
    } catch (err) {
      alert(err.message);
    }
  };

  // ---------------------------
  // PLAYER CONTROLS
  // ---------------------------
  const togglePlay = async () => {
    if (!activePlaylist.length) return;
    if (!canControlPlayer) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      await audioRef.current.play();
      setIsPlaying(true);
    }

    await updateRoom({
      current_song_url: roomSongs[roomCurrentIndex]?.song_url,
      current_song_name: roomSongs[roomCurrentIndex]?.song_name,
      playback_time: audioRef.current.currentTime,
      is_playing: !isPlaying,
    });
  };

  const nextSong = async () => {
    if (!activePlaylist.length) return;
    if (!canControlPlayer) return;

    let nextIndex;

    if (shuffle) {
      nextIndex = Math.floor(Math.random() * activePlaylist.length);
    } else {
      nextIndex = (activeIndex + 1) % activePlaylist.length;
    }

    if (room) setRoomCurrentIndex(nextIndex);
    else setCurrentIndex(nextIndex);

    setIsPlaying(true);

    await updateRoom({
      current_song_url: roomSongs[nextIndex]?.song_url,
      current_song_name: roomSongs[nextIndex]?.song_name,
      playback_time: 0,
      is_playing: true,
    });
  };

  const prevSong = async () => {
    if (!activePlaylist.length) return;
    if (!canControlPlayer) return;

    let prevIndex;

    if (shuffle) {
      prevIndex = Math.floor(Math.random() * activePlaylist.length);
    } else {
      prevIndex =
        (activeIndex - 1 + activePlaylist.length) % activePlaylist.length;
    }

    if (room) setRoomCurrentIndex(prevIndex);
    else setCurrentIndex(prevIndex);

    setIsPlaying(true);

    await updateRoom({
      current_song_url: roomSongs[prevIndex]?.song_url,
      current_song_name: roomSongs[prevIndex]?.song_name,
      playback_time: 0,
      is_playing: true,
    });
  };

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

  const toggleRepeat = () => {
    if (!canControlPlayer) return;

    if (repeat === "off") setRepeat("all");
    else if (repeat === "all") setRepeat("one");
    else setRepeat("off");
  };

  const handleSeek = async (e) => {
    if (!canControlPlayer) return;

    const newTime = e.target.value;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);

    await updateRoom({
      playback_time: newTime,
    });
  };

  const handleTimeUpdate = () => {
    setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    setDuration(audioRef.current.duration);
  };

  const handleVolume = (e) => {
    const newVol = e.target.value;
    setVolume(newVol);
    audioRef.current.volume = newVol;
  };

  const formatTime = (time) => {
    if (!time) return "0:00";
    const min = Math.floor(time / 60);
    const sec = Math.floor(time % 60);
    return `${min}:${sec < 10 ? "0" : ""}${sec}`;
  };

  // ---------------------------
  // LOGOUT
  // ---------------------------
  const logout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setSongs([]);
    setRoomSongs([]);
    setCurrentIndex(0);
    setRoomCurrentIndex(0);
    setIsPlaying(false);
    setRoom(null);
  };

  return (
    <div className="spotify-app">
      <div className="top-header">
        <h2>🎵 BeatSync</h2>

        {session && (
          <div className="top-user">
            <span>{session.user.email}</span>
            <button onClick={logout}>Logout</button>
          </div>
        )}
      </div>

      {!session ? (
        <div className="auth-page">
          <Auth setSession={setSession} />
        </div>
      ) : (
        <div className="spotify-layout">
          {/* LEFT SIDEBAR */}
          <div className="sidebar-left">
            <h3 className="sidebar-title">Library</h3>

            <div className="sidebar-menu">
              <button
                className={page === "player" ? "menu-btn active-menu" : "menu-btn"}
                onClick={() => setPage("player")}
              >
                🎵 Player
              </button>

              <button
                className={page === "library" ? "menu-btn active-menu" : "menu-btn"}
                onClick={() => setPage("library")}
              >
                🌍 Online Library
              </button>
            </div>

            {page === "player" && (
              <>
                {!room ? (
                  <div className="sidebar-section">
                    <h4>🎶 Your Playlist</h4>
                    <Playlist
                      songs={songs}
                      currentIndex={currentIndex}
                      setCurrentIndex={setCurrentIndex}
                      deleteSong={deleteSong}
                    />
                  </div>
                ) : (
                  <div className="sidebar-section">
                    <h4>🎧 Room Playlist</h4>
                    <RoomPlaylist
                      roomSongs={roomSongs}
                      roomCurrentIndex={roomCurrentIndex}
                      setRoomCurrentIndex={setRoomCurrentIndex}
                    />
                  </div>
                )}
              </>
            )}
          </div>

          {/* CENTER MAIN */}
          <div className="main-center">
            {!room ? (
              <Room session={session} setRoom={setRoom} />
            ) : (
              <div className="room-banner">
                <h3>
                  Room Code: <span className="room-code">{room.room_code}</span>
                </h3>

                <p>{isHost ? "👑 You are Host" : "🎧 You are Listener"}</p>

                {!isHost && (
                  <p style={{ color: "#1db954", fontWeight: "bold" }}>
                    Host is controlling playback 🎧
                  </p>
                )}

                <button
                  className="leave-room-btn"
                  onClick={() => {
                    setRoom(null);
                    setRoomSongs([]);
                  }}
                >
                  Leave Room
                </button>
              </div>
            )}

            {/* PLAYER PAGE */}
            {page === "player" && (
              <>
                <UploadSong user={session.user} refreshSongs={fetchSongs} />

                {/* HOST ADD SONGS */}
                {room && isHost && (
                  <div className="add-room-song">
                    <h3>Add Songs to Room</h3>

                    {songs.length === 0 ? (
                      <p style={{ color: "gray" }}>
                        Upload songs first to add into room playlist.
                      </p>
                    ) : (
                      songs.map((song) => (
                        <button
                          key={song.id}
                          className="room-add-btn"
                          onClick={() => addSongToRoom(song)}
                        >
                          ➕ {song.song_name}
                        </button>
                      ))
                    )}
                  </div>
                )}

                {/* MAIN MP3 PLAYER */}
                {activePlaylist.length > 0 ? (
                  <div className="now-playing">
                    <h2>Now Playing</h2>
                    <p className="song-title-main">
                      {activePlaylist[activeIndex]?.song_name}
                    </p>

                    <audio
                      ref={audioRef}
                      onTimeUpdate={handleTimeUpdate}
                      onLoadedMetadata={handleLoadedMetadata}
                      onEnded={handleSongEnd}
                    >
                      <source
                        src={activePlaylist[activeIndex]?.song_url}
                        type="audio/mpeg"
                      />
                    </audio>
                  </div>
                ) : (
                  <p style={{ color: "gray" }}>No songs available.</p>
                )}
              </>
            )}

            {/* ONLINE LIBRARY PAGE */}
            {page === "library" && (
              <>
                <YouTubeLibrary session={session} room={room} />
                {room && <RoomYouTubePlayer room={room} session={session} />}
              </>
            )}
          </div>

          {/* RIGHT SIDEBAR */}
          <div className="sidebar-right">
            {room ? (
              <>
                <RoomChat room={room} session={session} />
                <RoomMembers room={room} session={session} />
              </>
            ) : (
              <p style={{ color: "gray" }}>Join a room to use chat & members.</p>
            )}
          </div>

          {/* BOTTOM PLAYER BAR */}
          {page === "player" && activePlaylist.length > 0 && (
            <div className="bottom-player">
              <div className="bottom-song">
                <p>{activePlaylist[activeIndex]?.song_name}</p>
              </div>

              <div className="bottom-controls">
                <button
                  onClick={() => setShuffle(!shuffle)}
                  className={shuffle ? "active-btn" : ""}
                  disabled={!canControlPlayer}
                >
                  🔀
                </button>

                <button onClick={prevSong} disabled={!canControlPlayer}>
                  ⏮
                </button>

                <button
                  onClick={togglePlay}
                  className="play-btn"
                  disabled={!canControlPlayer}
                >
                  {isPlaying ? "⏸" : "▶"}
                </button>

                <button onClick={nextSong} disabled={!canControlPlayer}>
                  ⏭
                </button>

                <button
                  onClick={toggleRepeat}
                  className={repeat !== "off" ? "active-btn" : ""}
                  disabled={!canControlPlayer}
                >
                  🔁
                </button>
              </div>

              <div className="bottom-seek">
                <span>{formatTime(currentTime)}</span>

                <input
                  type="range"
                  min="0"
                  max={duration || 0}
                  value={currentTime}
                  onChange={handleSeek}
                  disabled={!canControlPlayer}
                />

                <span>{formatTime(duration)}</span>
              </div>

              <div className="bottom-volume">
                <label>🔊</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}

                  onChange={handleVolume}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
