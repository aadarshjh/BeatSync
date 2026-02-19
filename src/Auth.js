import React, { useState } from "react";
import { supabase } from "./supabaseClient";

export default function Auth({ setSession }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const signUp = async () => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) alert(error.message);
    else alert("Signup successful! Now login.");
  };

  const login = async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) alert(error.message);
    else setSession(data.session);
  };

  return (
    <div className="auth-box">
      <h2>Login / Signup</h2>

      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <div className="auth-buttons">
        <button onClick={login}>Login</button>
        <button onClick={signUp}>Signup</button>
      </div>
    </div>
  );
}
