import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import request from "supertest";
import { app, resetUsersForTesting } from "../index.js";

describe("Users Pagination", () => {
  // Helper function to create test users
  const createTestUser = async (name: string, email: string) => {
    const response = await request(app)
      .post("/users")
      .send({ name, email });
    return response.body;
  };

  // Reset users data before and after each test
  beforeEach(() => {
    resetUsersForTesting();
  });

  afterEach(() => {
    resetUsersForTesting();
  });

  describe("Default Pagination Behavior", () => {
    it("should return empty users array with correct metadata when no users exist", async () => {
      const response = await request(app).get("/users");
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        users: [],
        totalCount: 0,
        page: 1,
        limit: 10
      });
    });

    it("should return first page with default limit of 10 when no query parameters provided", async () => {
      // Create 5 test users
      for (let i = 1; i <= 5; i++) {
        await createTestUser(`User ${i}`, `user${i}@example.com`);
      }

      const response = await request(app).get("/users");
      
      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(5);
      expect(response.body.totalCount).toBe(5);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(10);
      expect(response.body.users[0].name).toBe("User 1");
      expect(response.body.users[4].name).toBe("User 5");
    });

    it("should return first 10 users when more than 10 users exist", async () => {
      // Create 15 test users
      for (let i = 1; i <= 15; i++) {
        await createTestUser(`User ${i}`, `user${i}@example.com`);
      }

      const response = await request(app).get("/users");
      
      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(10);
      expect(response.body.totalCount).toBe(15);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(10);
    });
  });

  describe("Custom Page and Limit Parameters", () => {
    beforeEach(async () => {
      // Create 25 test users for pagination testing
      for (let i = 1; i <= 25; i++) {
        await createTestUser(`User ${i}`, `user${i}@example.com`);
      }
    });

    it("should return correct page with custom limit", async () => {
      const response = await request(app).get("/users?page=2&limit=5");
      
      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(5);
      expect(response.body.totalCount).toBe(25);
      expect(response.body.page).toBe(2);
      expect(response.body.limit).toBe(5);
      // Should contain users 6-10 (second page with limit 5)
      expect(response.body.users[0].name).toBe("User 6");
      expect(response.body.users[4].name).toBe("User 10");
    });

    it("should return correct page with default limit when only page specified", async () => {
      const response = await request(app).get("/users?page=3");
      
      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(5); // 25 total - 20 from first 2 pages = 5 remaining
      expect(response.body.totalCount).toBe(25);
      expect(response.body.page).toBe(3);
      expect(response.body.limit).toBe(10);
      // Should contain users 21-25 (third page with default limit 10)
      expect(response.body.users[0].name).toBe("User 21");
      expect(response.body.users[4].name).toBe("User 25");
    });

    it("should return correct users with custom limit and default page", async () => {
      const response = await request(app).get("/users?limit=3");
      
      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(3);
      expect(response.body.totalCount).toBe(25);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(3);
      expect(response.body.users[0].name).toBe("User 1");
      expect(response.body.users[2].name).toBe("User 3");
    });

    it("should handle large limit values correctly", async () => {
      const response = await request(app).get("/users?limit=100");
      
      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(25); // All users returned
      expect(response.body.totalCount).toBe(25);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(100);
    });
  });

  describe("Edge Cases and Error Handling", () => {
    beforeEach(async () => {
      // Create 10 test users
      for (let i = 1; i <= 10; i++) {
        await createTestUser(`User ${i}`, `user${i}@example.com`);
      }
    });

    it("should return 400 error for invalid page parameter (less than 1)", async () => {
      const response = await request(app).get("/users?page=0");
      
      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: "Page must be greater than 0"
      });
    });

    it("should return 400 error for negative page parameter", async () => {
      const response = await request(app).get("/users?page=-1");
      
      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: "Page must be greater than 0"
      });
    });

    it("should return 400 error for invalid limit parameter (less than 1)", async () => {
      const response = await request(app).get("/users?limit=0");
      
      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: "Limit must be greater than 0"
      });
    });

    it("should return 400 error for negative limit parameter", async () => {
      const response = await request(app).get("/users?limit=-5");
      
      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: "Limit must be greater than 0"
      });
    });

    it("should handle non-numeric page parameter by defaulting to 1", async () => {
      const response = await request(app).get("/users?page=abc");
      
      expect(response.status).toBe(200);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(10);
    });

    it("should handle non-numeric limit parameter by defaulting to 10", async () => {
      const response = await request(app).get("/users?limit=xyz");
      
      expect(response.status).toBe(200);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(10);
    });

    it("should return empty users array for out of range page", async () => {
      const response = await request(app).get("/users?page=999&limit=5");
      
      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(0);
      expect(response.body.totalCount).toBe(10);
      expect(response.body.page).toBe(999);
      expect(response.body.limit).toBe(5);
    });
  });

  describe("Response Format Structure", () => {
    it("should always return response with correct structure and types", async () => {
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
        expect(typeof user.id).toBe("number");
        expect(typeof user.name).toBe("string");
        expect(typeof user.email).toBe("string");
      }
    });
  });
});


