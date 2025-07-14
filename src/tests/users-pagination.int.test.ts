import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import request from "supertest";
import express, { Request, Response } from "express";

// User interface definition (copied from main app for testing)
interface User {
  id: number;
  name: string;
  email: string;
  createdAt: Date;
}

// Create a test app instance
function createTestApp() {
  const app = express();
  const users: { [key: number]: User } = {};
  let nextId = 1;

  app.use(express.json());

  // Helper function to validate user data
  function validateUserData(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (
      !data.name ||
      typeof data.name !== "string" ||
      data.name.trim() === ""
    ) {
      errors.push("Name is required and must be a non-empty string");
    }

    if (
      !data.email ||
      typeof data.email !== "string" ||
      data.email.trim() === ""
    ) {
      errors.push("Email is required and must be a non-empty string");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      errors.push("Email must be a valid email address");
    }

    return { isValid: errors.length === 0, errors };
  }

  // GET /users - Get all users with pagination
  app.get("/users", (req: Request, res: Response) => {
    // Parse query parameters with defaults
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    // Validate pagination parameters
    if (page < 1 || limit < 1) {
      return res.status(400).json({
        error: "Page and limit must be positive integers",
      });
    }

    // Get all users and calculate pagination
    const allUsers = Object.values(users);
    const totalCount = allUsers.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedUsers = allUsers.slice(startIndex, endIndex);

    // Return paginated response with metadata
    return res.json({
      users: paginatedUsers,
      totalCount,
      page,
      limit,
    });
  });

  // POST /users - Create new user (for test data setup)
  app.post("/users", (req: Request, res: Response) => {
    const { isValid, errors } = validateUserData(req.body);

    if (!isValid) {
      return res
        .status(400)
        .json({ error: "Validation failed", details: errors });
    }

    const newUser: User = {
      id: nextId++,
      name: req.body.name.trim(),
      email: req.body.email.trim(),
      createdAt: new Date(),
    };

    users[newUser.id] = newUser;
    return res.status(201).json(newUser);
  });

  return app;
}

describe("Users Pagination Integration Tests", () => {
  let app: express.Application;

  beforeEach(() => {
    app = createTestApp();
  });

  afterEach(() => {
    // Clean up is handled by creating a new app instance each test
  });

  describe("Default pagination behavior", () => {
    it("should return default pagination (page=1, limit=10) when no query parameters provided", async () => {
      const response = await request(app).get("/users");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("users");
      expect(response.body).toHaveProperty("totalCount", 0);
      expect(response.body).toHaveProperty("page", 1);
      expect(response.body).toHaveProperty("limit", 10);
      expect(Array.isArray(response.body.users)).toBe(true);
      expect(response.body.users).toHaveLength(0);
    });

    it("should return first 10 users by default when users exist", async () => {
      // Create 15 test users
      for (let i = 1; i <= 15; i++) {
        await request(app)
          .post("/users")
          .send({
            name: `User ${i}`,
            email: `user${i}@example.com`,
          });
      }

      const response = await request(app).get("/users");

      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(10);
      expect(response.body.totalCount).toBe(15);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(10);
    });
  });

  describe("Custom page and limit parameters", () => {
    beforeEach(async () => {
      // Create 25 test users for pagination testing
      for (let i = 1; i <= 25; i++) {
        await request(app)
          .post("/users")
          .send({
            name: `User ${i}`,
            email: `user${i}@example.com`,
          });
      }
    });

    it("should return correct page with custom limit", async () => {
      const response = await request(app).get("/users?page=2&limit=5");

      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(5);
      expect(response.body.totalCount).toBe(25);
      expect(response.body.page).toBe(2);
      expect(response.body.limit).toBe(5);
    });

    it("should return correct users for different pages", async () => {
      const page1Response = await request(app).get("/users?page=1&limit=3");
      const page2Response = await request(app).get("/users?page=2&limit=3");

      expect(page1Response.body.users).toHaveLength(3);
      expect(page2Response.body.users).toHaveLength(3);

      // Ensure different users are returned for different pages
      const page1Ids = page1Response.body.users.map((user: User) => user.id);
      const page2Ids = page2Response.body.users.map((user: User) => user.id);

      expect(page1Ids).not.toEqual(page2Ids);
    });

    it("should handle large limit values", async () => {
      const response = await request(app).get("/users?limit=100");

      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(25); // All available users
      expect(response.body.totalCount).toBe(25);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(100);
    });
  });

  describe("Edge cases and error handling", () => {
    it("should return 400 for invalid page parameter", async () => {
      const response = await request(app).get("/users?page=0");

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty(
        "error",
        "Page and limit must be positive integers",
      );
    });

    it("should return 400 for invalid limit parameter", async () => {
      const response = await request(app).get("/users?limit=-1");

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty(
        "error",
        "Page and limit must be positive integers",
      );
    });

    it("should return 400 for both invalid page and limit", async () => {
      const response = await request(app).get("/users?page=0&limit=0");

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty(
        "error",
        "Page and limit must be positive integers",
      );
    });

    it("should handle non-numeric page parameter gracefully", async () => {
      const response = await request(app).get("/users?page=abc");

      expect(response.status).toBe(200);
      expect(response.body.page).toBe(1); // Should default to 1
      expect(response.body.limit).toBe(10); // Should default to 10
    });

    it("should handle non-numeric limit parameter gracefully", async () => {
      const response = await request(app).get("/users?limit=xyz");

      expect(response.status).toBe(200);
      expect(response.body.page).toBe(1); // Should default to 1
      expect(response.body.limit).toBe(10); // Should default to 10
    });
  });

  describe("Empty results and out-of-bounds pages", () => {
    it("should return empty array for out-of-bounds page with no users", async () => {
      const response = await request(app).get("/users?page=5");

      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(0);
      expect(response.body.totalCount).toBe(0);
      expect(response.body.page).toBe(5);
      expect(response.body.limit).toBe(10);
    });

    it("should return empty array for out-of-bounds page with existing users", async () => {
      // Create 5 test users
      for (let i = 1; i <= 5; i++) {
        await request(app)
          .post("/users")
          .send({
            name: `User ${i}`,
            email: `user${i}@example.com`,
          });
      }

      const response = await request(app).get("/users?page=10&limit=10");

      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(0);
      expect(response.body.totalCount).toBe(5);
      expect(response.body.page).toBe(10);
      expect(response.body.limit).toBe(10);
    });

    it("should return partial results for last page", async () => {
      // Create 7 test users
      for (let i = 1; i <= 7; i++) {
        await request(app)
          .post("/users")
          .send({
            name: `User ${i}`,
            email: `user${i}@example.com`,
          });
      }

      const response = await request(app).get("/users?page=2&limit=5");

      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(2); // Only 2 users left on page 2
      expect(response.body.totalCount).toBe(7);
      expect(response.body.page).toBe(2);
      expect(response.body.limit).toBe(5);
    });
  });

  describe("Response structure validation", () => {
    it("should always return the correct response structure", async () => {
      const response = await request(app).get("/users");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("users");
      expect(response.body).toHaveProperty("totalCount");
      expect(response.body).toHaveProperty("page");
      expect(response.body).toHaveProperty("limit");
      expect(typeof response.body.totalCount).toBe("number");
      expect(typeof response.body.page).toBe("number");
      expect(typeof response.body.limit).toBe("number");
      expect(Array.isArray(response.body.users)).toBe(true);
    });

    it("should return users with correct structure", async () => {
      // Create one test user
      await request(app).post("/users").send({
        name: "Test User",
        email: "test@example.com",
      });

      const response = await request(app).get("/users");

      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(1);

      const user = response.body.users[0];
      expect(user).toHaveProperty("id");
      expect(user).toHaveProperty("name", "Test User");
      expect(user).toHaveProperty("email", "test@example.com");
      expect(user).toHaveProperty("createdAt");
      expect(typeof user.id).toBe("number");
      expect(typeof user.name).toBe("string");
      expect(typeof user.email).toBe("string");
    });
  });
});
