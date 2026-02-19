import React from "react";

export default function RoomPlaylist({
  roomSongs,
  roomCurrentIndex,
  setRoomCurrentIndex,
}) {
  return (
    <div className="playlist">
      <h3>🎧 Room Playlist</h3>

      {roomSongs.length === 0 ? (
        <p style={{ color: "gray" }}>No songs added in room yet.</p>
      ) : (
        roomSongs.map((song, index) => (
          <div
            key={song.id}
            className={`playlist-item ${
              index === roomCurrentIndex ? "active" : ""
            }`}
            onClick={() => setRoomCurrentIndex(index)}
          >
            <div className="song-title">{song.song_name}</div>
          </div>
        ))
      )}
    </div>
  );
}
