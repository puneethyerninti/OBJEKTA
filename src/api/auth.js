import { apiUrl } from "../utils/api";

const API_URL = apiUrl("api/auth");

export const signup = async (name, email, password) => {
  try {
    const res = await fetch(`${API_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    return data;
  } catch (err) {
    console.error("Signup error:", err);
    return { error: "Network error" };
  }
};

export const login = async (email, password) => {
  try {
    const res = await fetch(`${API_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    return data;
  } catch (err) {
    console.error("Login error:", err);
    return { error: "Network error" };
  }
};

export const getMe = async (token) => {
  try {
    const res = await fetch(`${API_URL}/me`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${token}` },
    });
    const data = await res.json();
    return data;
  } catch (err) {
    console.error("getMe error:", err);
    return { error: "Network error" };
  }
};
