import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import express from "express";
import request from "supertest";

// Import the app setup from index.ts
import "../index.js";

describe("GET /users - Pagination Integration Tests", () => {
  let app: express.Application;
  let server: any;

  beforeEach(async () => {
    // Create a fresh Express app for each test
    app = express();
    app.use(express.json());
    
    // Start server on a different port for testing
    server = app.listen(3001);
    
    // Clear any existing users and add test data
    await request(app).delete("/users/1").expect((res) => {
      // Ignore 404 errors for cleanup
    });
    
    // Add test users
    const testUsers = [
      { name: "User 1", email: "user1@example.com" },
      { name: "User 2", email: "user2@example.com" },
      { name: "User 3", email: "user3@example.com" },
      { name: "User 4", email: "user4@example.com" },
      { name: "User 5", email: "user5@example.com" },
      { name: "User 6", email: "user6@example.com" },
      { name: "User 7", email: "user7@example.com" },
      { name: "User 8", email: "user8@example.com" },
      { name: "User 9", email: "user9@example.com" },
      { name: "User 10", email: "user10@example.com" },
      { name: "User 11", email: "user11@example.com" },
      { name: "User 12", email: "user12@example.com" },
    ];

    for (const user of testUsers) {
      await request(app).post("/users").send(user);
    }
  });

  afterEach(() => {
    if (server) {
      server.close();
    }
  });

  describe("Default pagination behavior", () => {
    it("should return first page with default limit of 10 when no parameters provided", async () => {
      const response = await request(app)
        .get("/users")
        .expect(200);

      expect(response.body).toHaveProperty("users");
      expect(response.body).toHaveProperty("totalCount");
      expect(response.body).toHaveProperty("page");
      expect(response.body).toHaveProperty("limit");
      
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(10);
      expect(response.body.users).toHaveLength(10);
      expect(response.body.totalCount).toBe(12);
    });

    it("should return correct metadata structure", async () => {
      const response = await request(app)
        .get("/users")
        .expect(200);

      // Verify response structure
      expect(typeof response.body.users).toBe("object");
      expect(Array.isArray(response.body.users)).toBe(true);
      expect(typeof response.body.totalCount).toBe("number");
      expect(typeof response.body.page).toBe("number");
      expect(typeof response.body.limit).toBe("number");
      
      // Verify user objects have correct structure
      if (response.body.users.length > 0) {
        const user = response.body.users[0];
        expect(user).toHaveProperty("id");
        expect(user).toHaveProperty("name");
        expect(user).toHaveProperty("email");
        expect(user).toHaveProperty("createdAt");
      }
    });
  });

  describe("Custom pagination parameters", () => {
    it("should handle custom page parameter", async () => {
      const response = await request(app)
        .get("/users?page=2")
        .expect(200);

      expect(response.body.page).toBe(2);
      expect(response.body.limit).toBe(10);
      expect(response.body.users).toHaveLength(2); // Remaining users on page 2
      expect(response.body.totalCount).toBe(12);
    });

    it("should handle custom limit parameter", async () => {
      const response = await request(app)
        .get("/users?limit=5")
        .expect(200);

      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(5);
      expect(response.body.users).toHaveLength(5);
      expect(response.body.totalCount).toBe(12);
    });

    it("should handle both custom page and limit parameters", async () => {
      const response = await request(app)
        .get("/users?page=2&limit=3")
        .expect(200);

      expect(response.body.page).toBe(2);
      expect(response.body.limit).toBe(3);
      expect(response.body.users).toHaveLength(3);
      expect(response.body.totalCount).toBe(12);
    });

    it("should handle large limit parameter", async () => {
      const response = await request(app)
        .get("/users?limit=20")
        .expect(200);

      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(20);
      expect(response.body.users).toHaveLength(12); // All available users
      expect(response.body.totalCount).toBe(12);
    });
  });

  describe("Edge cases and boundary conditions", () => {
    it("should return empty array for page beyond available data", async () => {
      const response = await request(app)
        .get("/users?page=10")
        .expect(200);

      expect(response.body.page).toBe(10);
      expect(response.body.limit).toBe(10);
      expect(response.body.users).toHaveLength(0);
      expect(response.body.totalCount).toBe(12);
    });

    it("should handle page=1 explicitly", async () => {
      const response = await request(app)
        .get("/users?page=1")
        .expect(200);

      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(10);
      expect(response.body.users).toHaveLength(10);
      expect(response.body.totalCount).toBe(12);
    });

    it("should handle limit=1", async () => {
      const response = await request(app)
        .get("/users?limit=1")
        .expect(200);

      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(1);
      expect(response.body.users).toHaveLength(1);
      expect(response.body.totalCount).toBe(12);
    });
  });

  describe("Invalid parameter handling", () => {
    it("should return 400 for invalid page parameter (non-numeric)", async () => {
      const response = await request(app)
        .get("/users?page=invalid")
        .expect(400);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toContain("Invalid page parameter");
    });

    it("should return 400 for invalid limit parameter (non-numeric)", async () => {
      const response = await request(app)
        .get("/users?limit=invalid")
        .expect(400);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toContain("Invalid limit parameter");
    });

    it("should return 400 for zero page parameter", async () => {
      const response = await request(app)
        .get("/users?page=0")
        .expect(400);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toContain("Invalid page parameter");
    });

    it("should return 400 for negative page parameter", async () => {
      const response = await request(app)
        .get("/users?page=-1")
        .expect(400);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toContain("Invalid page parameter");
    });

    it("should return 400 for zero limit parameter", async () => {
      const response = await request(app)
        .get("/users?limit=0")
        .expect(400);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toContain("Invalid limit parameter");
    });

    it("should return 400 for negative limit parameter", async () => {
      const response = await request(app)
        .get("/users?limit=-5")
        .expect(400);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toContain("Invalid limit parameter");
    });

    it("should return 400 for decimal page parameter", async () => {
      const response = await request(app)
        .get("/users?page=1.5")
        .expect(400);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toContain("Invalid page parameter");
    });
  });
});

