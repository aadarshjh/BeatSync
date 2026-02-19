import React, { useEffect, useState } from "react";
import axios from "axios";
import YouTube from "react-youtube";
import { supabase } from "./supabaseClient";

export default function YouTubeLibrary({ session, room }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [library, setLibrary] = useState([]);

  const [playingVideo, setPlayingVideo] = useState(null);
  const [playingTitle, setPlayingTitle] = useState("");
  const [playingThumb, setPlayingThumb] = useState("");

  const [showVideo, setShowVideo] = useState(false);

  const API_KEY = process.env.REACT_APP_YOUTUBE_API_KEY;

  const isHost = room && room.host_id === session.user.id;

  const fetchLibrary = async () => {
    const { data, error } = await supabase
      .from("youtube_library")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error) setLibrary(data);
  };

  useEffect(() => {
    fetchLibrary();
  }, []);

  const searchYouTube = async () => {
    if (!query.trim()) return alert("Enter search query!");

    try {
      const res = await axios.get(
        "https://www.googleapis.com/youtube/v3/search",
        {
          params: {
            part: "snippet",
            q: query,
            type: "video",
            maxResults: 10,
            key: API_KEY,
          },
        }
      );

      setResults(res.data.items);
    } catch (err) {
      alert("YouTube API Error: " + err.message);
    }
  };

  const addToLibrary = async (video) => {
    const videoId = video.id.videoId;

    const { error } = await supabase.from("youtube_library").insert([
      {
        video_id: videoId,
        title: video.snippet.title,
        thumbnail: video.snippet.thumbnails.medium.url,
        channel_title: video.snippet.channelTitle,
        added_by: session.user.id,
      },
    ]);

    if (error) {
      alert("Already exists or error: " + error.message);
      return;
    }

    alert("Added to Online Library!");
    fetchLibrary();
  };

  const deleteFromLibrary = async (song) => {
    const { error } = await supabase
      .from("youtube_library")
      .delete()
      .eq("id", song.id);

    if (error) alert(error.message);
    else fetchLibrary();
  };

  const playInRoom = async (song) => {
    if (!room) return alert("Join or create a room first!");
    if (!isHost) return alert("Only host can play songs in room!");

    const { error } = await supabase
      .from("rooms")
      .update({
        current_video_id: song.video_id,
        playback_time: 0,
        is_playing: true,
      })
      .eq("room_code", room.room_code);

    if (error) alert(error.message);
    else alert("Now playing in Room!");
  };

  const playSong = (song) => {
    setPlayingVideo(song.video_id);
    setPlayingTitle(song.title);
    setPlayingThumb(song.thumbnail);
  };

  return (
    <div className="yt-library">
      <h2>🌍 Online YouTube Library</h2>

      {/* Search */}
      <div className="yt-search">
        <input
          className="search-input"
          type="text"
          placeholder="Search YouTube songs..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <button className="btn-green" onClick={searchYouTube}>
          Search
        </button>
      </div>

      {/* Search Results */}
      <div className="yt-results">
        <h3>🔎 Results</h3>

        {results.length === 0 ? (
          <p style={{ color: "gray" }}>Search something to see results...</p>
        ) : (
          results.map((video) => (
            <div key={video.id.videoId} className="yt-item">
              <img
                src={video.snippet.thumbnails.medium.url}
                alt="thumb"
                className="yt-thumb"
              />

              <div className="yt-info">
                <p className="yt-title">{video.snippet.title}</p>
                <p className="yt-channel">{video.snippet.channelTitle}</p>
              </div>

              <button className="btn-green" onClick={() => addToLibrary(video)}>
                ➕ Add
              </button>
            </div>
          ))
        )}
      </div>

      {/* Library */}
      <div className="yt-results">
        <h3>📚 Library Songs</h3>

        {library.length === 0 ? (
          <p style={{ color: "gray" }}>No songs in library yet.</p>
        ) : (
          library.map((song) => (
            <div key={song.id} className="yt-item">
              <img src={song.thumbnail} alt="thumb" className="yt-thumb" />

              <div className="yt-info">
                <p className="yt-title">{song.title}</p>
                <p className="yt-channel">{song.channel_title}</p>
              </div>

              <button className="btn-green" onClick={() => playSong(song)}>
                ▶ Play
              </button>

              {room && isHost && (
                <button className="btn-blue" onClick={() => playInRoom(song)}>
                  🎧 Room
                </button>
              )}

              {song.added_by === session.user.id && (
                <button
                  className="btn-red"
                  onClick={() => deleteFromLibrary(song)}
                >
                  ❌
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Player */}
      {playingVideo && (
        <div className="yt-player">
          <div className="yt-nowplaying">
            <img src={playingThumb} alt="thumb" className="yt-now-thumb" />
            <div>
              <h3 style={{ margin: 0 }}>🎶 Now Playing</h3>
              <p style={{ margin: 0, color: "gray", fontSize: "13px" }}>
                {playingTitle}
              </p>
            </div>
          </div>

          <div className="yt-player-controls">
            <button
              className="btn-blue"
              onClick={() => setShowVideo(!showVideo)}
            >
              {showVideo ? "🎧 Audio Only" : "🎬 Show Video"}
            </button>

            <button className="btn-red" onClick={() => setPlayingVideo(null)}>
              Stop
            </button>
          </div>

          <div className="yt-video-box">
            <YouTube
              videoId={playingVideo}
              opts={{
                width: "100%",
                height: showVideo ? "320" : "0",
                playerVars: {
                  autoplay: 1,
                },
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
