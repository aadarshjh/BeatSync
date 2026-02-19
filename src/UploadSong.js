import React, { useState } from "react";
import { supabase } from "./supabaseClient";

export default function UploadSong({ user, refreshSongs }) {
  const [songFile, setSongFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const uploadSong = async () => {
    if (!songFile) return alert("Please select a song!");

    setUploading(true);

    try {
      const fileExt = songFile.name.split(".").pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("songs")
        .upload(fileName, songFile);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("songs")
        .getPublicUrl(fileName);

      const songUrl = urlData.publicUrl;

      const { error: dbError } = await supabase.from("songs").insert([
        {
          user_id: user.id,
          song_name: songFile.name,
          song_url: songUrl,
        },
      ]);

      if (dbError) throw dbError;

      alert("Song Uploaded Successfully!");
      setSongFile(null);
      refreshSongs();
    } catch (err) {
      alert(err.message);
    }

    setUploading(false);
  };

  return (
    <div className="upload-box">
      <h3>📤 Upload Song</h3>

      <label className="file-upload-btn">
        🎵 Choose Song
        <input
          type="file"
          accept="audio/*"
          onChange={(e) => setSongFile(e.target.files[0])}
        />
      </label>

      {songFile && <p className="selected-file">Selected: {songFile.name}</p>}

      <button className="btn-green" onClick={uploadSong} disabled={uploading}>
        {uploading ? "Uploading..." : "Upload Song"}
      </button>
    </div>
  );
}
