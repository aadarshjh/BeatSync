import React, { useState } from "react";
import { supabase } from "./supabaseClient";

export default function UploadSong({ user, refreshSongs }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const uploadSong = async () => {
    if (!file) return alert("Please select a song!");

    try {
      setUploading(true);

      const fileName = `${user.id}/${Date.now()}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("songs")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("songs").getPublicUrl(fileName);
      const songUrl = data.publicUrl;

      const { error: dbError } = await supabase.from("songs").insert([
        {
          user_id: user.id,
          song_name: file.name,
          song_url: songUrl,
        },
      ]);

      if (dbError) throw dbError;

      alert("Song uploaded successfully!");
      setFile(null);
      refreshSongs();
    } catch (err) {
      alert(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="upload-box">
      <h3>📤 Upload Song</h3>

      <label className="custom-file-upload">
        🎵 Choose Song
        <input
          type="file"
          accept="audio/*"
          onChange={(e) => setFile(e.target.files[0])}
        />
      </label>

      {file && <p className="selected-file">Selected: {file.name}</p>}

      <button onClick={uploadSong} disabled={uploading}>
        {uploading ? "Uploading..." : "Upload Song"}
      </button>
    </div>
  );
}
