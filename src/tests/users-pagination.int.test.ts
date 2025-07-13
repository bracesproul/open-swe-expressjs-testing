import { describe, it, expect, beforeAll, afterAll, beforeEach } from "@jest/globals";
import request from "supertest";
import { app } from "../index.js";

describe("GET /users - Pagination Integration Tests", () => {
  // Helper function to create test users
  const createTestUser = async (name: string, email: string) => {
    const response = await request(app)
      .post("/users")
      .send({ name, email });
    return response.body;
  };

  // Note: Since we're using the actual app with in-memory storage,
  // tests may interfere with each other. In a real scenario, you'd want
  // to reset the database state between tests or use a test database.

  describe("Default pagination behavior", () => {
    it("should return default pagination (page=1, limit=10) when no query parameters provided", async () => {
      // Create 5 test users
      for (let i = 1; i <= 5; i++) {
        await createTestUser(`User ${i}`, `user${i}@example.com`);
      }

      const response = await request(app).get("/users");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("users");
      expect(response.body).toHaveProperty("totalCount", 5);
      expect(response.body).toHaveProperty("page", 1);
      expect(response.body).toHaveProperty("limit", 10);
      expect(response.body.users).toHaveLength(5);
    });

    it("should return empty users array when no users exist", async () => {
      const response = await request(app).get("/users");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        users: [],
        totalCount: 0,
        page: 1,
        limit: 10
      });
    });
  });

  describe("Custom pagination parameters", () => {
    beforeEach(async () => {
      // Create 15 test users for pagination testing
      for (let i = 1; i <= 15; i++) {
        await createTestUser(`User ${i}`, `user${i}@example.com`);
      }
    });

    it("should handle custom page parameter", async () => {
      const response = await request(app).get("/users?page=2");

      expect(response.status).toBe(200);
      expect(response.body.page).toBe(2);
      expect(response.body.limit).toBe(10);
      expect(response.body.totalCount).toBe(15);
      expect(response.body.users).toHaveLength(5); // Remaining users on page 2
    });

    it("should handle custom limit parameter", async () => {
      const response = await request(app).get("/users?limit=5");

      expect(response.status).toBe(200);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(5);
      expect(response.body.totalCount).toBe(15);
      expect(response.body.users).toHaveLength(5);
    });

    it("should handle both custom page and limit parameters", async () => {
      const response = await request(app).get("/users?page=3&limit=5");

      expect(response.status).toBe(200);
      expect(response.body.page).toBe(3);
      expect(response.body.limit).toBe(5);
      expect(response.body.totalCount).toBe(15);
      expect(response.body.users).toHaveLength(5);
    });
  });

  describe("Edge cases and invalid parameters", () => {
    beforeEach(async () => {
      // Create 10 test users
      for (let i = 1; i <= 10; i++) {
        await createTestUser(`User ${i}`, `user${i}@example.com`);
      }
    });

    it("should default to page=1 for invalid page parameter", async () => {
      const response = await request(app).get("/users?page=invalid");

      expect(response.status).toBe(200);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(10);
    });

    it("should default to page=1 for negative page parameter", async () => {
      const response = await request(app).get("/users?page=-1");

      expect(response.status).toBe(200);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(10);
    });

    it("should default to page=1 for zero page parameter", async () => {
      const response = await request(app).get("/users?page=0");

      expect(response.status).toBe(200);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(10);
    });

    it("should default to limit=10 for invalid limit parameter", async () => {
      const response = await request(app).get("/users?limit=invalid");

      expect(response.status).toBe(200);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(10);
    });

    it("should default to limit=10 for negative limit parameter", async () => {
      const response = await request(app).get("/users?limit=-5");

      expect(response.status).toBe(200);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(10);
    });

    it("should default to limit=10 for zero limit parameter", async () => {
      const response = await request(app).get("/users?limit=0");

      expect(response.status).toBe(200);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(10);
    });

    it("should return empty users array for out-of-range page", async () => {
      const response = await request(app).get("/users?page=999");

      expect(response.status).toBe(200);
      expect(response.body.page).toBe(999);
      expect(response.body.limit).toBe(10);
      expect(response.body.totalCount).toBe(10);
      expect(response.body.users).toHaveLength(0);
    });
  });

  describe("Response format validation", () => {
    it("should return response with correct structure and types", async () => {
      await createTestUser("Test User", "test@example.com");
      
      const response = await request(app).get("/users");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("users");
      expect(response.body).toHaveProperty("totalCount");
      expect(response.body).toHaveProperty("page");
      expect(response.body).toHaveProperty("limit");
      
      expect(Array.isArray(response.body.users)).toBe(true);
      expect(typeof response.body.totalCount).toBe("number");
      expect(typeof response.body.page).toBe("number");
      expect(typeof response.body.limit).toBe("number");
      
      // Verify user object structure
      if (response.body.users.length > 0) {
        const user = response.body.users[0];
        expect(user).toHaveProperty("id");
        expect(user).toHaveProperty("name");
        expect(user).toHaveProperty("email");
        expect(user).toHaveProperty("createdAt");
      }
    });
  });
});


