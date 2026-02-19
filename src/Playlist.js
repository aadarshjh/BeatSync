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
      <div className="playlist-search">
        <input
          type="text"
          placeholder="🔍 Search songs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
      </div>

      {filteredSongs.length === 0 ? (
        <p style={{ color: "gray", marginTop: "10px" }}>No songs found.</p>
      ) : (
        filteredSongs.map((song, index) => (
          <div
            key={song.id}
            className={`playlist-item ${
              index === currentIndex ? "active" : ""
            }`}
          >
            <span
              className="playlist-song"
              onClick={() => setCurrentIndex(index)}
            >
              🎵 {song.song_name}
            </span>

            <button className="delete-btn" onClick={() => deleteSong(song)}>
              ❌
            </button>
          </div>
        ))
      )}
    </div>
  );
}
