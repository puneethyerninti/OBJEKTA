const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "OBJEKTA API",
      version: "1.0.0",
      description: "REST API for OBJEKTA 3D Design Studio — authentication, projects, scenes, marketplace, collaboration, and AI endpoints.",
      contact: { name: "OBJEKTA Team" },
      license: { name: "MIT" },
    },
    servers: [
      { url: "/api", description: "Relative API base" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            message: { type: "string" },
            error: { type: "string" },
          },
        },
        User: {
          type: "object",
          properties: {
            _id: { type: "string" },
            name: { type: "string" },
            email: { type: "string", format: "email" },
            role: { type: "string", enum: ["buyer", "seller", "admin"] },
            emailVerified: { type: "boolean" },
            twoFactorEnabled: { type: "boolean" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        Project: {
          type: "object",
          properties: {
            _id: { type: "string" },
            title: { type: "string" },
            description: { type: "string" },
            thumbnail: { type: "string" },
            progress: { type: "number", minimum: 0, maximum: 100 },
            data: { type: "object", description: "Scene JSON data" },
            sceneStorageType: { type: "string", enum: ["inline", "disk", "s3"] },
            createdAt: { type: "string", format: "date-time" },
            lastSavedAt: { type: "string", format: "date-time" },
          },
        },
        Product: {
          type: "object",
          properties: {
            _id: { type: "string" },
            title: { type: "string" },
            slug: { type: "string" },
            description: { type: "string" },
            price: { type: "number" },
            category: { type: "string" },
            format: { type: "string" },
            thumbnail: { type: "string" },
            seller: { type: "string" },
            status: { type: "string", enum: ["draft", "active", "removed"] },
          },
        },
        Order: {
          type: "object",
          properties: {
            _id: { type: "string" },
            buyer: { type: "string" },
            items: { type: "array", items: { type: "object" } },
            total: { type: "number" },
            paymentStatus: { type: "string", enum: ["pending", "completed", "failed", "refunded"] },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        Version: {
          type: "object",
          properties: {
            versionNumber: { type: "integer" },
            author: { type: "string" },
            message: { type: "string" },
            isSnapshot: { type: "boolean" },
            objectCount: { type: "integer" },
            addedObjects: { type: "array", items: { type: "string" } },
            removedObjects: { type: "array", items: { type: "string" } },
            modifiedObjects: { type: "array", items: { type: "string" } },
            createdAt: { type: "string", format: "date-time" },
          },
        },
      },
    },
    tags: [
      { name: "Auth", description: "Authentication & user management" },
      { name: "Projects", description: "Project CRUD & scene storage" },
      { name: "Scenes", description: "Scene save/load" },
      { name: "Uploads", description: "File upload & S3 presigning" },
      { name: "Versions", description: "Scene version history" },
      { name: "Marketplace", description: "Product catalog & commerce" },
      { name: "Cart", description: "Shopping cart" },
      { name: "Orders", description: "Order management" },
      { name: "Reviews", description: "Product reviews" },
      { name: "Seller", description: "Seller dashboard & products" },
      { name: "Downloads", description: "Signed asset downloads" },
      { name: "Payments", description: "Payment processing" },
      { name: "AI", description: "AI-powered features" },
      { name: "Activity", description: "Activity feed" },
      { name: "Collaborators", description: "Project collaborators" },
    ],
    // Inline path definitions for all 57 routes
    paths: {
      // ─── Auth ──────────────────────────────────────
      "/auth/register": {
        post: {
          tags: ["Auth"], summary: "Register a new user",
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["name", "email", "password"], properties: { name: { type: "string" }, email: { type: "string", format: "email" }, password: { type: "string", minLength: 6 } } } } } },
          responses: { "201": { description: "User created, token returned" }, "400": { description: "Validation error" } },
        },
      },
      "/auth/login": {
        post: {
          tags: ["Auth"], summary: "Login with email and password",
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["email", "password"], properties: { email: { type: "string" }, password: { type: "string" }, twoFactorCode: { type: "string" } } } } } },
          responses: { "200": { description: "Token returned" }, "401": { description: "Invalid credentials" } },
        },
      },
      "/auth/oauth": {
        post: { tags: ["Auth"], summary: "OAuth login (Google, etc.)", responses: { "200": { description: "Token returned" } } },
      },
      "/auth/refresh": {
        post: { tags: ["Auth"], summary: "Refresh access token using httpOnly cookie", responses: { "200": { description: "New access token" }, "401": { description: "Invalid refresh token" } } },
      },
      "/auth/verify-email": {
        get: { tags: ["Auth"], summary: "Verify email address via token", parameters: [{ name: "token", in: "query", required: true, schema: { type: "string" } }], responses: { "200": { description: "Email verified" } } },
      },
      "/auth/forgot-password": {
        post: {
          tags: ["Auth"], summary: "Request password reset email",
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { email: { type: "string" } } } } } },
          responses: { "200": { description: "Instructions sent (same response regardless of email existence)" } },
        },
      },
      "/auth/reset-password": {
        post: {
          tags: ["Auth"], summary: "Reset password with token",
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["token", "password"], properties: { token: { type: "string" }, password: { type: "string" } } } } } },
          responses: { "200": { description: "Password reset" } },
        },
      },
      "/auth/me": {
        get: { tags: ["Auth"], summary: "Get current user profile", security: [{ bearerAuth: [] }], responses: { "200": { description: "User object", content: { "application/json": { schema: { "$ref": "#/components/schemas/User" } } } } } },
      },
      "/auth/resend-verification": {
        post: { tags: ["Auth"], summary: "Resend email verification", security: [{ bearerAuth: [] }], responses: { "200": { description: "Verification email sent" } } },
      },
      "/auth/2fa/setup": {
        post: { tags: ["Auth"], summary: "Start 2FA setup (get secret + QR code)", security: [{ bearerAuth: [] }], responses: { "200": { description: "QR code and secret returned" } } },
      },
      "/auth/2fa/verify": {
        post: { tags: ["Auth"], summary: "Verify 2FA code to enable it", security: [{ bearerAuth: [] }], requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { code: { type: "string" } } } } } }, responses: { "200": { description: "2FA enabled, backup codes returned" } } },
      },
      "/auth/2fa/disable": {
        post: { tags: ["Auth"], summary: "Disable 2FA", security: [{ bearerAuth: [] }], requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { password: { type: "string" } } } } } }, responses: { "200": { description: "2FA disabled" } } },
      },
      "/auth/admin/users": {
        get: { tags: ["Auth"], summary: "List all users (admin)", security: [{ bearerAuth: [] }], parameters: [{ name: "page", in: "query", schema: { type: "integer" } }, { name: "search", in: "query", schema: { type: "string" } }, { name: "role", in: "query", schema: { type: "string" } }], responses: { "200": { description: "Paginated user list" } } },
      },
      "/auth/admin/stats": {
        get: { tags: ["Auth"], summary: "Platform stats (admin)", security: [{ bearerAuth: [] }], responses: { "200": { description: "Stats object" } } },
      },
      "/auth/admin/users/{id}/role": {
        put: { tags: ["Auth"], summary: "Change user role (admin)", security: [{ bearerAuth: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { role: { type: "string", enum: ["buyer", "seller", "admin"] } } } } } }, responses: { "200": { description: "Role updated" } } },
      },
      "/auth/admin/users/{id}/suspend": {
        put: { tags: ["Auth"], summary: "Suspend/unsuspend user (admin)", security: [{ bearerAuth: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Suspension toggled" } } },
      },

      // ─── Projects ──────────────────────────────────
      "/projects": {
        get: { tags: ["Projects"], summary: "List user's projects", security: [{ bearerAuth: [] }], responses: { "200": { description: "Array of projects" } } },
        post: { tags: ["Projects"], summary: "Create a new project", security: [{ bearerAuth: [] }], requestBody: { content: { "multipart/form-data": { schema: { type: "object", properties: { title: { type: "string" }, description: { type: "string" }, scene: { type: "string", format: "binary" }, thumbnail: { type: "string", format: "binary" } } } } } }, responses: { "201": { description: "Project created" } } },
      },
      "/projects/{id}": {
        get: { tags: ["Projects"], summary: "Get project by ID", security: [{ bearerAuth: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Project object" } } },
        put: { tags: ["Projects"], summary: "Update project", security: [{ bearerAuth: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Updated project" } } },
        delete: { tags: ["Projects"], summary: "Delete project", security: [{ bearerAuth: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Project deleted" } } },
      },
      "/projects/{id}/assets": {
        post: { tags: ["Projects"], summary: "Upload asset file to project", security: [{ bearerAuth: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "201": { description: "Asset uploaded" } } },
      },
      "/projects/{id}/assets/s3": {
        post: { tags: ["Projects"], summary: "Register S3/external asset", security: [{ bearerAuth: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Asset registered" } } },
      },

      // ─── Uploads ───────────────────────────────────
      "/uploads/presign": {
        post: { tags: ["Uploads"], summary: "Get presigned S3 URL", security: [{ bearerAuth: [] }], responses: { "200": { description: "Presigned URL" } } },
      },
      "/uploads/multipart/start": {
        post: { tags: ["Uploads"], summary: "Start multipart upload", security: [{ bearerAuth: [] }], responses: { "200": { description: "Upload ID" } } },
      },
      "/uploads/multipart/sign": {
        post: { tags: ["Uploads"], summary: "Sign multipart part", security: [{ bearerAuth: [] }], responses: { "200": { description: "Part presigned URL" } } },
      },
      "/uploads/multipart/complete": {
        post: { tags: ["Uploads"], summary: "Complete multipart upload", security: [{ bearerAuth: [] }], responses: { "200": { description: "Upload complete" } } },
      },
      "/uploads/tus/finalize": {
        post: { tags: ["Uploads"], summary: "Finalize TUS upload to S3", security: [{ bearerAuth: [] }], responses: { "200": { description: "Asset key" } } },
      },

      // ─── Scenes ────────────────────────────────────
      "/scenes/save": {
        post: { tags: ["Scenes"], summary: "Save a new scene", security: [{ bearerAuth: [] }], responses: { "201": { description: "Scene saved" } } },
      },
      "/scenes": {
        get: { tags: ["Scenes"], summary: "List user scenes", security: [{ bearerAuth: [] }], responses: { "200": { description: "Array of scenes" } } },
      },
      "/scenes/{id}": {
        get: { tags: ["Scenes"], summary: "Get scene by ID", security: [{ bearerAuth: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Scene data" } } },
      },
      "/scenes/{id}/update": {
        post: { tags: ["Scenes"], summary: "Update scene metadata/effects", security: [{ bearerAuth: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Scene updated" } } },
      },

      // ─── Activity ──────────────────────────────────
      "/activity": {
        get: { tags: ["Activity"], summary: "Get recent activity feed", security: [{ bearerAuth: [] }], responses: { "200": { description: "Activity items" } } },
      },

      // ─── Collaborators ─────────────────────────────
      "/collaborators": {
        get: { tags: ["Collaborators"], summary: "List all collaborators", security: [{ bearerAuth: [] }], responses: { "200": { description: "Collaborator list" } } },
      },

      // ─── AI ────────────────────────────────────────
      "/ai/chat": {
        post: { tags: ["AI"], summary: "AI chat (scene-aware)", requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { message: { type: "string" }, context: { type: "object" } } } } } }, responses: { "200": { description: "AI response" } } },
      },
      "/ai/describe": {
        post: { tags: ["AI"], summary: "AI scene description", responses: { "200": { description: "Description text" } } },
      },
      "/ai/suggest-material": {
        post: { tags: ["AI"], summary: "AI material suggestions", responses: { "200": { description: "Material suggestions" } } },
      },
      "/ai/suggest-names": {
        post: { tags: ["AI"], summary: "AI name suggestions", responses: { "200": { description: "Name suggestions" } } },
      },
      "/ai/optimize": {
        post: { tags: ["AI"], summary: "AI optimization recommendations", responses: { "200": { description: "Optimization tips" } } },
      },
      "/ai/status": {
        get: { tags: ["AI"], summary: "Check AI provider status", responses: { "200": { description: "Provider availability" } } },
      },

      // ─── Versions ──────────────────────────────────
      "/versions/{projectId}": {
        get: { tags: ["Versions"], summary: "List version history", security: [{ bearerAuth: [] }], parameters: [{ name: "projectId", in: "path", required: true, schema: { type: "string" } }, { name: "page", in: "query", schema: { type: "integer" } }, { name: "limit", in: "query", schema: { type: "integer" } }], responses: { "200": { description: "Paginated versions" } } },
      },
      "/versions/{projectId}/{versionNumber}": {
        get: { tags: ["Versions"], summary: "Get scene data at version", security: [{ bearerAuth: [] }], parameters: [{ name: "projectId", in: "path", required: true, schema: { type: "string" } }, { name: "versionNumber", in: "path", required: true, schema: { type: "integer" } }], responses: { "200": { description: "Reconstructed scene data" } } },
      },
      "/versions/{projectId}/diff/{from}/{to}": {
        get: { tags: ["Versions"], summary: "Diff between two versions", security: [{ bearerAuth: [] }], parameters: [{ name: "projectId", in: "path", required: true, schema: { type: "string" } }, { name: "from", in: "path", required: true, schema: { type: "integer" } }, { name: "to", in: "path", required: true, schema: { type: "integer" } }], responses: { "200": { description: "Diff object" } } },
      },
      "/versions/{projectId}/restore/{versionNumber}": {
        post: { tags: ["Versions"], summary: "Restore project to version", security: [{ bearerAuth: [] }], parameters: [{ name: "projectId", in: "path", required: true, schema: { type: "string" } }, { name: "versionNumber", in: "path", required: true, schema: { type: "integer" } }], responses: { "200": { description: "Project restored" } } },
      },

      // ─── Marketplace Products ──────────────────────
      "/marketplace/products": {
        get: { tags: ["Marketplace"], summary: "List products (search, filter, paginate)", parameters: [{ name: "q", in: "query", schema: { type: "string" } }, { name: "category", in: "query", schema: { type: "string" } }, { name: "sort", in: "query", schema: { type: "string" } }, { name: "page", in: "query", schema: { type: "integer" } }], responses: { "200": { description: "Product list" } } },
      },
      "/marketplace/products/categories": {
        get: { tags: ["Marketplace"], summary: "Get product categories", responses: { "200": { description: "Category counts" } } },
      },
      "/marketplace/products/{idOrSlug}": {
        get: { tags: ["Marketplace"], summary: "Get product detail", parameters: [{ name: "idOrSlug", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Product object" } } },
      },

      // ─── Cart ──────────────────────────────────────
      "/marketplace/cart": {
        get: { tags: ["Cart"], summary: "Get cart", security: [{ bearerAuth: [] }], responses: { "200": { description: "Cart items" } } },
        delete: { tags: ["Cart"], summary: "Clear entire cart", security: [{ bearerAuth: [] }], responses: { "200": { description: "Cart cleared" } } },
      },
      "/marketplace/cart/add": {
        post: { tags: ["Cart"], summary: "Add item to cart", security: [{ bearerAuth: [] }], requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { productId: { type: "string" }, quantity: { type: "integer" } } } } } }, responses: { "200": { description: "Item added" } } },
      },
      "/marketplace/cart/update": {
        put: { tags: ["Cart"], summary: "Update cart item quantity", security: [{ bearerAuth: [] }], responses: { "200": { description: "Updated" } } },
      },
      "/marketplace/cart/remove/{productId}": {
        delete: { tags: ["Cart"], summary: "Remove item from cart", security: [{ bearerAuth: [] }], parameters: [{ name: "productId", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Removed" } } },
      },

      // ─── Orders ────────────────────────────────────
      "/marketplace/orders": {
        get: { tags: ["Orders"], summary: "List buyer orders", security: [{ bearerAuth: [] }], parameters: [{ name: "page", in: "query", schema: { type: "integer" } }, { name: "status", in: "query", schema: { type: "string" } }], responses: { "200": { description: "Order list" } } },
        post: { tags: ["Orders"], summary: "Create order from cart", security: [{ bearerAuth: [] }], responses: { "201": { description: "Order created" } } },
      },
      "/marketplace/orders/{id}": {
        get: { tags: ["Orders"], summary: "Get order detail", security: [{ bearerAuth: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Order object" } } },
      },
      "/marketplace/orders/{id}/confirm": {
        post: { tags: ["Orders"], summary: "Confirm order payment", security: [{ bearerAuth: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Order confirmed with download links" } } },
      },

      // ─── Reviews ───────────────────────────────────
      "/marketplace/reviews/{productId}": {
        get: { tags: ["Reviews"], summary: "List product reviews", parameters: [{ name: "productId", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Reviews with rating distribution" } } },
      },
      "/marketplace/reviews": {
        post: { tags: ["Reviews"], summary: "Create a review", security: [{ bearerAuth: [] }], requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { productId: { type: "string" }, rating: { type: "integer", minimum: 1, maximum: 5 }, comment: { type: "string" } } } } } }, responses: { "201": { description: "Review created" } } },
      },
      "/marketplace/reviews/{id}": {
        delete: { tags: ["Reviews"], summary: "Delete own review", security: [{ bearerAuth: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Review deleted" } } },
      },

      // ─── Seller ────────────────────────────────────
      "/marketplace/seller/products": {
        get: { tags: ["Seller"], summary: "List seller's products", security: [{ bearerAuth: [] }], responses: { "200": { description: "Product list" } } },
        post: { tags: ["Seller"], summary: "Create product listing", security: [{ bearerAuth: [] }], responses: { "201": { description: "Product created" } } },
      },
      "/marketplace/seller/products/{id}": {
        put: { tags: ["Seller"], summary: "Update product listing", security: [{ bearerAuth: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Product updated" } } },
        delete: { tags: ["Seller"], summary: "Remove product listing", security: [{ bearerAuth: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Product removed" } } },
      },
      "/marketplace/seller/stats": {
        get: { tags: ["Seller"], summary: "Seller dashboard stats", security: [{ bearerAuth: [] }], responses: { "200": { description: "Revenue, orders, sold count" } } },
      },
      "/marketplace/seller/orders": {
        get: { tags: ["Seller"], summary: "Orders containing seller's products", security: [{ bearerAuth: [] }], responses: { "200": { description: "Order list" } } },
      },

      // ─── Downloads ─────────────────────────────────
      "/marketplace/downloads/{token}": {
        get: { tags: ["Downloads"], summary: "Download asset via signed token", parameters: [{ name: "token", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "File stream" }, "403": { description: "Token expired or limit reached" } } },
      },
      "/marketplace/downloads/refresh/{orderId}/{productId}": {
        post: { tags: ["Downloads"], summary: "Regenerate download URL", security: [{ bearerAuth: [] }], parameters: [{ name: "orderId", in: "path", required: true, schema: { type: "string" } }, { name: "productId", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "New signed URL" } } },
      },

      // ─── Payments ──────────────────────────────────
      "/marketplace/payments/provider": {
        get: { tags: ["Payments"], summary: "Get active payment provider", responses: { "200": { description: "Provider name" } } },
      },
      "/marketplace/payments/create-intent": {
        post: { tags: ["Payments"], summary: "Create payment intent", security: [{ bearerAuth: [] }], responses: { "200": { description: "Payment intent / client secret" } } },
      },
      "/marketplace/payments/refund": {
        post: { tags: ["Payments"], summary: "Refund a payment", security: [{ bearerAuth: [] }], responses: { "200": { description: "Refund processed" } } },
      },
      "/marketplace/payments/webhook": {
        post: { tags: ["Payments"], summary: "Stripe webhook (signature-verified)", responses: { "200": { description: "Webhook processed" } } },
      },
    },
  },
  apis: [], // All paths defined inline above
};

const swaggerSpec = swaggerJsdoc(options);
module.exports = swaggerSpec;
