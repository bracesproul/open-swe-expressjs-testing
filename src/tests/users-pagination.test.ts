import { describe, it, expect, beforeEach } from "@jest/globals";
import request from "supertest";
import { app, users } from "../index.js";

// Set NODE_ENV to test to prevent server from starting
process.env.NODE_ENV = "test";

describe("GET /users - Pagination Tests", () => {
  beforeEach(() => {
    clearUsers();
  });

  describe("Default pagination behavior", () => {
    it("should return default pagination (page=1, limit=10) when no query parameters provided", async () => {
      // Create 5 test users
      for (let i = 1; i <= 5; i++) {
        await request(app)
          .post("/users")
          .send({
            name: `User ${i}`,
            email: `user${i}@example.com`,
          });
      }

      const response = await request(app).get("/users");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("users");
      expect(response.body).toHaveProperty("totalCount", 5);
      for (let i = 1; i <= 5; i++) {
        createTestUser(`User ${i}`, `user${i}@example.com`);
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
        limit: 10,
      });
    });
  });

  describe("Custom page and limit parameters", () => {
    beforeEach(() => {
      // Create 25 test users for pagination testing
      for (let i = 1; i <= 25; i++) {
        createTestUser(`User ${i}`, `user${i}@example.com`);
      }
    });

    it("should return correct page with custom limit", async () => {
      const response = await request(app).get("/users?page=2&limit=5");

      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(5);
      expect(response.body.totalCount).toBe(25);
      expect(response.body.page).toBe(2);
      expect(response.body.limit).toBe(5);
      
      // Check that we get users 6-10 (second page with limit 5)
      expect(response.body.users[0].name).toBe("User 6");
      expect(response.body.users[4].name).toBe("User 10");
    });

    it("should handle large limit values", async () => {
      const response = await request(app).get("/users?limit=100");

      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(25); // All users returned
      expect(response.body.totalCount).toBe(25);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(100);
    });

    it("should handle custom page with default limit", async () => {
      const response = await request(app).get("/users?page=3");

      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(5); // Users 21-25 (page 3 of 10 per page)
      expect(response.body.totalCount).toBe(25);
      expect(response.body.page).toBe(3);
      expect(response.body.limit).toBe(10);
    });
  });

  describe("Edge cases and error handling", () => {
    beforeEach(() => {
      // Create 15 test users
      for (let i = 1; i <= 15; i++) {
        createTestUser(`User ${i}`, `user${i}@example.com`);
      }
    });

    it("should return 400 error for invalid page parameter (page < 1)", async () => {
      const response = await request(app).get("/users?page=0");

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: "Page must be greater than 0",
      });
    });

    it("should return 400 error for invalid limit parameter (limit < 1)", async () => {
      const response = await request(app).get("/users?limit=0");

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: "Limit must be greater than 0",
      });
    });

    it("should handle non-numeric page parameter (fallback to default)", async () => {
      const response = await request(app).get("/users?page=invalid");

      expect(response.status).toBe(200);
      expect(response.body.page).toBe(1); // Falls back to default
      expect(response.body.limit).toBe(10);
    });

    it("should handle non-numeric limit parameter (fallback to default)", async () => {
      const response = await request(app).get("/users?limit=invalid");

      expect(response.status).toBe(200);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(10); // Falls back to default
    });

    it("should return empty users array for out-of-range page", async () => {
      const response = await request(app).get("/users?page=10&limit=5");

      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(0);
      expect(response.body.totalCount).toBe(15);
      expect(response.body.page).toBe(10);
      expect(response.body.limit).toBe(5);
    });
  });

  describe("Response format validation", () => {
    it("should always return the correct response structure", async () => {
      createTestUser("Test User", "test@example.com");

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
    });

    it("should return users with correct structure", async () => {
      const testUser = createTestUser("John Doe", "john@example.com");

      const response = await request(app).get("/users");

      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(1);
      
      const returnedUser = response.body.users[0];
      expect(returnedUser).toHaveProperty("id", testUser.id);
      expect(returnedUser).toHaveProperty("name", testUser.name);
      expect(returnedUser).toHaveProperty("email", testUser.email);
      expect(returnedUser).toHaveProperty("createdAt");
    });
  });
});


