// src/pages/Contact.jsx
import React from "react";

export default function Contact() {
  return (
    <div className="site-wrapper bg-gray-900 text-white">
      <main className="px-6 py-16 max-w-4xl mx-auto">
        <section className="text-center mb-12">
          <h1 className="text-5xl font-extrabold text-cyan-400 drop-shadow-[0_0_10px_#00ffff]">
            Contact Us
          </h1>
          <p className="mt-4 text-lg text-gray-300 max-w-2xl mx-auto">
            Have questions or feedback? Reach out to the OBJEKTA team — we’d love to hear from you!
          </p>
        </section>

        <section className="bg-gray-800 p-8 rounded-lg shadow-lg">
          <form className="space-y-6">
            <div>
              <label className="block text-gray-200 mb-2" htmlFor="name">Name</label>
              <input
                id="name"
                type="text"
                placeholder="Your Name"
                className="w-full p-3 rounded bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
              />
            </div>

            <div>
              <label className="block text-gray-200 mb-2" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                placeholder="Your Email"
                className="w-full p-3 rounded bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
              />
            </div>

            <div>
              <label className="block text-gray-200 mb-2" htmlFor="message">Message</label>
              <textarea
                id="message"
                placeholder="Your Message"
                rows={5}
                className="w-full p-3 rounded bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-cyan-400 text-gray-900 font-bold rounded hover:bg-cyan-500 transition-colors"
            >
              Send Message
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
