import React, { useState } from "react";

export default function Playlist({
  songs,
  currentIndex,
  setCurrentIndex,
  deleteSong,
}) {
  const [search, setSearch] = useState("");

  const filteredSongs = songs.filter((song) =>
    song.song_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="playlist">
      <h3>🎶 Playlist</h3>

      <input
        className="search-box"
        type="text"
        placeholder="🔍 Search songs..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {filteredSongs.length === 0 ? (
        <p style={{ color: "gray" }}>No songs found.</p>
      ) : (
        filteredSongs.map((song) => {
          const originalIndex = songs.findIndex((s) => s.id === song.id);

          return (
            <div
              key={song.id}
              className={`playlist-item ${
                originalIndex === currentIndex ? "active" : ""
              }`}
            >
              <div
                className="song-title"
                onClick={() => setCurrentIndex(originalIndex)}
              >
                {song.song_name}
              </div>

              <button
                className="delete-btn"
                onClick={() => deleteSong(song)}
              >
                🗑
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}
