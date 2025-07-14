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

    if (!data.name || typeof data.name !== "string" || data.name.trim() === "") {
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
    if (page < 1) {
      return res.status(400).json({ error: "Page must be greater than 0" });
    }
    
    if (limit < 1 || limit > 100) {
      return res.status(400).json({ error: "Limit must be between 1 and 100" });
    }
    
    // Get all users and calculate pagination
    const allUsers = Object.values(users);
    const totalCount = allUsers.length;
    
    // Calculate start and end indices for pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    
    // Get paginated users
    const paginatedUsers = allUsers.slice(startIndex, endIndex);
    
    // Return paginated response with metadata
    return res.json({
      users: paginatedUsers,
      totalCount,
      page,
      limit
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

  return { app, users };
}

describe("Users Pagination Integration Tests", () => {
  let app: express.Application;
  let users: { [key: number]: User };

  beforeEach(() => {
    const testApp = createTestApp();
    app = testApp.app;
    users = testApp.users;
  });

  afterEach(() => {
    // Clear users after each test
    Object.keys(users).forEach(key => delete users[parseInt(key)]);
  });

  describe("Default pagination behavior", () => {
    it("should return empty results with default pagination when no users exist", async () => {
      const response = await request(app).get("/users");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        users: [],
        totalCount: 0,
        page: 1,
        limit: 10
      });
    });

    it("should return users with default pagination (page=1, limit=10)", async () => {
      // Create 5 test users
      for (let i = 1; i <= 5; i++) {
        await request(app)
          .post("/users")
          .send({
            name: `User ${i}`,
            email: `user${i}@example.com`
          });
      }

      const response = await request(app).get("/users");

      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(5);
      expect(response.body.totalCount).toBe(5);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(10);
      expect(response.body.users[0]).toHaveProperty("id");
      expect(response.body.users[0]).toHaveProperty("name");
      expect(response.body.users[0]).toHaveProperty("email");
      expect(response.body.users[0]).toHaveProperty("createdAt");
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
            email: `user${i}@example.com`
          });
      }
    });

    it("should return first page with custom limit", async () => {
      const response = await request(app).get("/users?limit=5");

      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(5);
      expect(response.body.totalCount).toBe(25);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(5);
    });

    it("should return second page with custom limit", async () => {
      const response = await request(app).get("/users?page=2&limit=5");

      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(5);
      expect(response.body.totalCount).toBe(25);
      expect(response.body.page).toBe(2);
      expect(response.body.limit).toBe(5);
    });

    it("should return partial results on last page", async () => {
      const response = await request(app).get("/users?page=3&limit=10");

      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(5); // 25 total, page 3 with limit 10 = 5 remaining
      expect(response.body.totalCount).toBe(25);
      expect(response.body.page).toBe(3);
      expect(response.body.limit).toBe(10);
    });

    it("should handle large limit values", async () => {
      const response = await request(app).get("/users?limit=100");

      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(25);
      expect(response.body.totalCount).toBe(25);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(100);
    });
  });

  describe("Edge cases and error handling", () => {
    it("should return 400 for invalid page parameter (page < 1)", async () => {
      const response = await request(app).get("/users?page=0");

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: "Page must be greater than 0"
      });
    });

    it("should return 400 for negative page parameter", async () => {
      const response = await request(app).get("/users?page=-1");

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: "Page must be greater than 0"
      });
    });

    it("should return 400 for invalid limit parameter (limit < 1)", async () => {
      const response = await request(app).get("/users?limit=0");

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: "Limit must be between 1 and 100"
      });
    });

    it("should return 400 for limit parameter exceeding maximum (limit > 100)", async () => {
      const response = await request(app).get("/users?limit=101");

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: "Limit must be between 1 and 100"
      });
    });

    it("should handle non-numeric page parameter gracefully (defaults to 1)", async () => {
      const response = await request(app).get("/users?page=abc");

      expect(response.status).toBe(200);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(10);
    });

    it("should handle non-numeric limit parameter gracefully (defaults to 10)", async () => {
      const response = await request(app).get("/users?limit=xyz");

      expect(response.status).toBe(200);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(10);
    });
  });

  describe("Out-of-bounds pages", () => {
    beforeEach(async () => {
      // Create 15 test users
      for (let i = 1; i <= 15; i++) {
        await request(app)
          .post("/users")
          .send({
            name: `User ${i}`,
            email: `user${i}@example.com`
          });
      }
    });

    it("should return empty results for out-of-bounds page", async () => {
      const response = await request(app).get("/users?page=10&limit=10");

      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(0);
      expect(response.body.totalCount).toBe(15);
      expect(response.body.page).toBe(10);
      expect(response.body.limit).toBe(10);
    });
  });
});


