// src/pages/Login.jsx
import React, { useState } from "react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    alert(`Logging in with email: ${email}`);
  };

  return (
    <div className="site-wrapper bg-gray-900 text-white">
      <main className="px-6 py-16 max-w-md mx-auto">
        <section className="text-center mb-12">
          <h1 className="text-5xl font-extrabold text-cyan-400 drop-shadow-[0_0_10px_#00ffff]">
            Login
          </h1>
          <p className="mt-4 text-gray-300">Access your OBJEKTA account and continue creating.</p>
        </section>

        <section className="bg-gray-800 p-8 rounded-lg shadow-lg">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className="block text-gray-200 mb-2" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your Email"
                className="w-full p-3 rounded bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
              />
            </div>

            <div>
              <label className="block text-gray-200 mb-2" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your Password"
                className="w-full p-3 rounded bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-cyan-400 text-gray-900 font-bold rounded hover:bg-cyan-500 transition-colors"
            >
              Login
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
