#!/usr/bin/env node
// backend/scripts/seed-marketplace.js
// Seeds the marketplace with the REAL .glb models from public/models/
// Usage: node backend/scripts/seed-marketplace.js

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const connectDB = require("../config/db");
const Product = require("../models/Product");
const User = require("../models/User");

// ─── Real .glb models living in public/models/ ─────────────
// Prices in INR — set to ₹50 each for testing (Stripe minimum ~₹50)
const REAL_PRODUCTS = [
  {
    title: "Porsche 911 GT3",
    description:
      "High-fidelity Porsche 911 GT3 sports car model with detailed interior, PBR materials, and realistic proportions. Perfect for automotive visualization, games, and product showcases.",
    price: 50,
    category: "vehicles",
    tags: ["porsche", "car", "sports-car", "automotive", "realistic", "pbr"],
    format: "glb",
    fileName: "porsche.glb",
    polyCount: 120000,
    textured: true,
    rigged: false,
    animated: false,
    featured: true,
    license: "standard",
  },
  {
    title: "MacBook Pro Laptop",
    description:
      "Photorealistic laptop model with open lid, keyboard detail, and screen. Ideal for product mockups, tech scenes, and UI/UX presentations.",
    price: 50,
    category: "props",
    tags: ["laptop", "macbook", "tech", "computer", "product-mockup"],
    format: "glb",
    fileName: "laptop_free.glb",
    polyCount: 35000,
    textured: true,
    rigged: false,
    animated: false,
    featured: false,
    license: "standard",
  },
  {
    title: "iPhone 17 Pro",
    description:
      "Detailed iPhone 17 Pro model with realistic materials, camera module, and screen. Great for app mockups, product renders, and marketing assets.",
    price: 50,
    category: "props",
    tags: ["iphone", "phone", "apple", "smartphone", "product-mockup"],
    format: "glb",
    fileName: "iphone_17_pro.glb",
    polyCount: 42000,
    textured: true,
    rigged: false,
    animated: false,
    featured: true,
    license: "standard",
  },
  {
    title: "Gipsy Avenger — Pacific Rim Jaeger",
    description:
      "Massive Pacific Rim Gipsy Avenger Jaeger mech with full articulation points. Highly detailed armor plates, weapons, and cockpit. Ready for action scenes and cinematic renders.",
    price: 50,
    category: "characters",
    tags: ["mech", "jaeger", "pacific-rim", "robot", "sci-fi", "action"],
    format: "glb",
    fileName: "gipsy_avenger_-_pacific_rim.glb",
    polyCount: 250000,
    textured: true,
    rigged: true,
    animated: false,
    featured: true,
    license: "extended",
  },
  {
    title: "Flynn's Arcade — Tron",
    description:
      "Retro-futuristic Flynn's Arcade environment from Tron universe. Complete interior with arcade machines, neon lighting, and atmospheric glow effects. Perfect for VR experiences and game environments.",
    price: 50,
    category: "environments",
    tags: ["arcade", "tron", "retro", "neon", "environment", "cyberpunk"],
    format: "glb",
    fileName: "flynns_arcade.glb",
    polyCount: 180000,
    textured: true,
    rigged: false,
    animated: false,
    featured: true,
    license: "standard",
  },
  {
    title: "Cyberpunk Desk Setup",
    description:
      "Futuristic cyberpunk desk with monitors, holographic displays, RGB lighting, and scattered tech accessories. Ideal for interior scenes, game environments, and sci-fi projects.",
    price: 50,
    category: "furniture",
    tags: ["desk", "cyberpunk", "furniture", "interior", "sci-fi", "tech"],
    format: "glb",
    fileName: "cyberpunk_desk.glb",
    polyCount: 65000,
    textured: true,
    rigged: false,
    animated: false,
    featured: false,
    license: "standard",
  },
  {
    title: "Black Dragon — Animated",
    description:
      "Menacing black dragon with idle breathing animation, detailed scales, wing membranes, and glowing eyes. Fully rigged with blend shapes. Game-engine ready with optimized LODs.",
    price: 50,
    category: "characters",
    tags: ["dragon", "animated", "fantasy", "creature", "rigged", "game-ready"],
    format: "glb",
    fileName: "black_dragon_with_idle_animation.glb",
    polyCount: 95000,
    textured: true,
    rigged: true,
    animated: true,
    featured: true,
    license: "extended",
  },
];

const SAMPLE_REVIEWS = [
  { rating: 5, title: "Excellent quality!", body: "The detail on this model is amazing. PBR materials look great in Unity." },
  { rating: 4, title: "Good value", body: "Nice model, textures could be slightly higher resolution but overall happy." },
  { rating: 5, title: "Perfect for my project", body: "Exactly what I needed. Clean topology and well-organized materials." },
  { rating: 3, title: "Decent", body: "Works as described. Nothing extraordinary but functional." },
  { rating: 4, title: "Recommended", body: "Great asset for the price. Seller was helpful with questions." },
  { rating: 5, title: "Stunning work", body: "The animations are buttery smooth and the rig is very well done." },
];

async function seed() {
  try {
    await connectDB();
    console.log("🌱 Connected to MongoDB. Starting marketplace seed...");

    // Create seed seller user (or reuse first existing user)
    let seller = await User.findOne({});
    if (!seller) {
      seller = await User.create({
        name: "Objekta Store",
        email: "store@objekta.dev",
        password: "testpassword123",
        role: "seller",
      });
      console.log("  ✅ Created seed seller:", seller.email);
    } else {
      // Ensure seller role
      if (seller.role !== "seller") {
        seller.role = "seller";
        await seller.save();
      }
      console.log("  ℹ️  Using existing user as seller:", seller.email);
    }

    // Clean existing seed data
    await Product.deleteMany({});
    console.log("  🗑️  Cleared existing products");

    // Build products from the real .glb files
    const publicModelsDir = path.join(__dirname, "../../public/models");
    const products = [];

    for (const p of REAL_PRODUCTS) {
      // Resolve actual file for size
      const filePath = path.join(publicModelsDir, p.fileName);
      let fileSize = 0;
      try {
        const stat = fs.statSync(filePath);
        fileSize = stat.size;
      } catch {
        console.warn(`  ⚠️  Could not stat ${p.fileName}, setting fileSize=0`);
      }

      // Publicly accessible URL for the model (served via Vite dev / static hosting)
      const fileUrl = `/models/${p.fileName}`;

      const product = await Product.create({
        title: p.title,
        slug: undefined, // auto-generated
        description: p.description,
        price: p.price,
        category: p.category,
        tags: p.tags,
        format: p.format,
        fileUrl,
        fileSize,
        polyCount: p.polyCount,
        textured: p.textured,
        rigged: p.rigged,
        animated: p.animated,
        // Use the .glb itself as thumbnail placeholder (frontends show 3D preview)
        thumbnail: fileUrl,
        images: [fileUrl],
        previewUrl: fileUrl,
        seller: seller._id,
        featured: p.featured,
        license: p.license,
        currency: "INR",
        status: "active",
        stock: -1, // digital, unlimited
      });
      products.push(product);
      console.log(`  ✅ ${product.title} → ${fileUrl} (${(fileSize / 1024 / 1024).toFixed(1)} MB)`);
    }

    console.log(`\n🎉 Seeded ${products.length} real 3D model products!`);
    console.log("   Seller:", seller.email);
    console.log("   Browse at: /marketplace\n");

    process.exit(0);
  } catch (err) {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  }
}

seed();
