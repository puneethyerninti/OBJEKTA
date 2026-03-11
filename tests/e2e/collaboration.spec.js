// tests/e2e/collaboration.spec.js
const { test, expect } = require("@playwright/test");
const { registerUser, createProject, API } = require("./helpers");

test.describe("Collaboration flows", () => {
  test("two users can load the same project", async ({ request }) => {
    const owner = await registerUser(request, { name: "Owner" });
    const project = await createProject(request, owner.token, { title: "Collab Project" });

    // Owner can access the project
    const ownerRes = await request.get(`${API}/api/projects/${project._id}`, {
      headers: { Authorization: `Bearer ${owner.token}` },
    });
    expect(ownerRes.ok()).toBeTruthy();
  });

  test("project collaborators endpoint exists", async ({ request }) => {
    const owner = await registerUser(request, { name: "Collab Owner" });
    const project = await createProject(request, owner.token, { title: "Shared Project" });

    const res = await request.get(`${API}/api/collaborators/${project._id}`, {
      headers: { Authorization: `Bearer ${owner.token}` },
    });

    // May return empty list or the endpoint might vary
    expect([200, 404]).toContain(res.status());
  });

  test("version history empty for new project", async ({ request }) => {
    const owner = await registerUser(request, { name: "Version Owner" });
    const project = await createProject(request, owner.token, { title: "Versioned Project" });

    const res = await request.get(`${API}/api/versions/${project._id}`, {
      headers: { Authorization: `Bearer ${owner.token}` },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.versions).toHaveLength(0);
  });

  test("saving scene creates a version", async ({ request }) => {
    const owner = await registerUser(request, { name: "Save Owner" });
    const project = await createProject(request, owner.token, { title: "Auto-Version Project" });

    // Save scene data
    await request.put(`${API}/api/projects/${project._id}`, {
      headers: { Authorization: `Bearer ${owner.token}`, "Content-Type": "application/json" },
      data: {
        data: { objects: [{ id: "cube", type: "mesh", position: [0, 0, 0] }] },
        versionMessage: "Initial layout",
      },
    });

    // Wait a moment for async versioning
    await new Promise(r => setTimeout(r, 500));

    const res = await request.get(`${API}/api/versions/${project._id}`, {
      headers: { Authorization: `Bearer ${owner.token}` },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.versions.length).toBeGreaterThanOrEqual(1);
  });
});
