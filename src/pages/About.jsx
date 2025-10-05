// src/pages/About.jsx
import React from "react";

export default function About() {
  return (
    <div className="site-wrapper bg-gray-900 text-white">
      {/* Page container inside main */}
      <main className="px-6 py-16 max-w-6xl mx-auto">
        {/* Hero Section */}
        <section className="text-center mb-16">
          <h1 className="text-5xl font-extrabold text-cyan-400 drop-shadow-[0_0_10px_#00ffff]">
            About OBJEKTA
          </h1>
          <p className="mt-4 text-lg text-gray-300 max-w-2xl mx-auto">
            OBJEKTA is an interactive 3D object editor built for creators,
            developers, and designers. Craft, customize, and visualize 3D
            models directly in your browser — no heavy software needed.
          </p>
        </section>

        {/* Mission Section */}
        <section className="mb-16">
          <h2 className="text-3xl font-semibold text-cyan-300 mb-4 text-center">
            Our Mission
          </h2>
          <p className="text-gray-300 text-center max-w-3xl mx-auto">
            We aim to make 3D design accessible to everyone. Whether you’re a
            hobbyist, a student learning graphics, or a developer prototyping
            scenes — OBJEKTA empowers you to create and experiment with ease.
          </p>
        </section>

        {/* Features Section */}
        <section>
          <h2 className="text-3xl font-semibold text-cyan-300 mb-8 text-center">
            Why Choose OBJEKTA
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="feature-card bg-gray-800 p-6 rounded-lg shadow-lg">
              <h3 className="text-xl font-bold text-cyan-400 mb-2">🚀 Lightweight</h3>
              <p className="text-gray-300">
                No bulky installs. Everything runs right in your browser with blazing speed.
              </p>
            </div>
            <div className="feature-card bg-gray-800 p-6 rounded-lg shadow-lg">
              <h3 className="text-xl font-bold text-cyan-400 mb-2">🎨 Interactive Editing</h3>
              <p className="text-gray-300">
                Drag, rotate, scale, and customize objects with a smooth UI.
              </p>
            </div>
            <div className="feature-card bg-gray-800 p-6 rounded-lg shadow-lg">
              <h3 className="text-xl font-bold text-cyan-400 mb-2">🌍 Web-Based</h3>
              <p className="text-gray-300">
                Access your projects anywhere, anytime. All you need is a browser.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
