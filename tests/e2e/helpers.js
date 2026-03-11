// tests/e2e/helpers.js
// Shared utilities for E2E tests
const { expect } = require("@playwright/test");

const API = process.env.API_URL || "http://localhost:5000";

/** Generate a unique email for test isolation */
function testEmail(prefix = "e2e") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@test.local`;
}

/** Register a user via API and return { email, password, token } */
async function registerUser(request, overrides = {}) {
  const email = overrides.email || testEmail();
  const password = overrides.password || "TestPass123!";
  const name = overrides.name || "E2E User";

  const res = await request.post(`${API}/api/auth/register`, {
    data: { name, email, password },
  });
  const body = await res.json();
  return { email, password, name, token: body.token, user: body.user };
}

/** Login a user via API and return { token, user } */
async function loginUser(request, email, password) {
  const res = await request.post(`${API}/api/auth/login`, {
    data: { email, password },
  });
  const body = await res.json();
  return { token: body.token, user: body.user };
}

/** Create a project via API */
async function createProject(request, token, data = {}) {
  const res = await request.post(`${API}/api/projects`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { title: data.title || "E2E Test Project", description: data.description || "Created by E2E test" },
  });
  return res.json();
}

module.exports = { API, testEmail, registerUser, loginUser, createProject };
