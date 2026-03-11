// tests/e2e/projects.spec.js
const { test, expect } = require("@playwright/test");
const { registerUser, createProject, API } = require("./helpers");

test.describe("Project CRUD", () => {
  let token;

  test.beforeAll(async ({ request }) => {
    const user = await registerUser(request, { name: "Project Tester" });
    token = user.token;
  });

  test("create project via API", async ({ request }) => {
    const res = await request.post(`${API}/api/projects`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { title: "My E2E Project", description: "Test description" },
    });

    expect(res.ok()).toBeTruthy();
    const project = await res.json();
    expect(project.title).toBe("My E2E Project");
    expect(project._id).toBeTruthy();
  });

  test("list projects returns created project", async ({ request }) => {
    // Create
    await request.post(`${API}/api/projects`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { title: "Listed Project" },
    });

    const res = await request.get(`${API}/api/projects`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.ok()).toBeTruthy();
    const projects = await res.json();
    const found = (Array.isArray(projects) ? projects : projects.projects || [])
      .find(p => p.title === "Listed Project");
    expect(found).toBeTruthy();
  });

  test("update project title", async ({ request }) => {
    const created = await createProject(request, token, { title: "Original Title" });

    const res = await request.put(`${API}/api/projects/${created._id}`, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      data: { title: "Updated Title" },
    });

    expect(res.ok()).toBeTruthy();
    const updated = await res.json();
    expect(updated.title).toBe("Updated Title");
  });

  test("delete project", async ({ request }) => {
    const created = await createProject(request, token, { title: "To Delete" });

    const res = await request.delete(`${API}/api/projects/${created._id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.ok()).toBeTruthy();

    // Verify deleted
    const getRes = await request.get(`${API}/api/projects/${created._id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(getRes.ok()).toBeFalsy();
  });

  test("save scene data to project", async ({ request }) => {
    const created = await createProject(request, token, { title: "Scene Project" });

    const sceneData = {
      objects: [
        { id: "box-1", type: "mesh", geometry: "BoxGeometry", position: [0, 1, 0] },
        { id: "light-1", type: "light", lightType: "directional", position: [5, 5, 5] },
      ],
      metadata: { objectCount: 2 },
    };

    const res = await request.put(`${API}/api/projects/${created._id}`, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      data: { data: sceneData },
    });

    expect(res.ok()).toBeTruthy();
  });

  test("cannot access other user's project", async ({ request }) => {
    const created = await createProject(request, token, { title: "Private Project" });

    // Register a different user
    const other = await registerUser(request, { name: "Other User" });

    const res = await request.get(`${API}/api/projects/${created._id}`, {
      headers: { Authorization: `Bearer ${other.token}` },
    });

    // Should be forbidden or not found
    expect([403, 404]).toContain(res.status());
  });
});
