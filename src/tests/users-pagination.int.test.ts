import { describe, it, expect, beforeEach } from "@jest/globals";
import request from "supertest";
import express, { Request, Response } from "express";

// User interface definition (copied from main app)
interface User {
  id: number;
  name: string;
  email: string;
  createdAt: Date;
}

// Create a test app instance with the same structure as the main app
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
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    
    // Apply pagination using slice
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

  return app;
}

describe("Users Pagination Integration Tests", () => {
  let app: express.Application;

  beforeEach(() => {
    app = createTestApp();
  });

  describe("Default pagination behavior", () => {
    it("should return default pagination (page=1, limit=10) when no query parameters provided", async () => {
      // Create some test users
      for (let i = 1; i <= 15; i++) {
        await request(app)
          .post("/users")
          .send({
            name: `User ${i}`,
            email: `user${i}@example.com`
          });
      }

      const response = await request(app)
        .get("/users")
        .expect(200);

      expect(response.body).toHaveProperty("users");
      expect(response.body).toHaveProperty("totalCount", 15);
      expect(response.body).toHaveProperty("page", 1);
      expect(response.body).toHaveProperty("limit", 10);
      expect(response.body.users).toHaveLength(10);
      expect(response.body.users[0]).toHaveProperty("name", "User 1");
      expect(response.body.users[9]).toHaveProperty("name", "User 10");
    });

    it("should return empty users array with correct metadata when no users exist", async () => {
      const response = await request(app)
        .get("/users")
        .expect(200);

      expect(response.body).toEqual({
        users: [],
        totalCount: 0,
        page: 1,
        limit: 10
      });
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

    it("should return correct page 2 with default limit", async () => {
      const response = await request(app)
        .get("/users?page=2")
        .expect(200);

      expect(response.body.users).toHaveLength(10);
      expect(response.body.totalCount).toBe(25);
      expect(response.body.page).toBe(2);
      expect(response.body.limit).toBe(10);
      expect(response.body.users[0]).toHaveProperty("name", "User 11");
      expect(response.body.users[9]).toHaveProperty("name", "User 20");
    });

    it("should return correct results with custom limit", async () => {
      const response = await request(app)
        .get("/users?limit=5")
        .expect(200);

      expect(response.body.users).toHaveLength(5);
      expect(response.body.totalCount).toBe(25);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(5);
      expect(response.body.users[0]).toHaveProperty("name", "User 1");
      expect(response.body.users[4]).toHaveProperty("name", "User 5");
    });

    it("should return correct results with both custom page and limit", async () => {
      const response = await request(app)
        .get("/users?page=3&limit=7")
        .expect(200);

      expect(response.body.users).toHaveLength(7);
      expect(response.body.totalCount).toBe(25);
      expect(response.body.page).toBe(3);
      expect(response.body.limit).toBe(7);
      expect(response.body.users[0]).toHaveProperty("name", "User 15");
      expect(response.body.users[6]).toHaveProperty("name", "User 21");
    });
  });

  describe("Edge cases and error handling", () => {
    it("should return 400 error for invalid page parameter (page < 1)", async () => {
      const response = await request(app)
        .get("/users?page=0")
        .expect(400);

      expect(response.body).toEqual({
        error: "Page must be greater than 0"
      });
    });

    it("should return 400 error for invalid limit parameter (limit < 1)", async () => {
      const response = await request(app)
        .get("/users?limit=0")
        .expect(400);

      expect(response.body).toEqual({
        error: "Limit must be between 1 and 100"
      });
    });

    it("should return 400 error for invalid limit parameter (limit > 100)", async () => {
      const response = await request(app)
        .get("/users?limit=101")
        .expect(400);

      expect(response.body).toEqual({
        error: "Limit must be between 1 and 100"
      });
    });

    it("should handle non-numeric page and limit parameters gracefully", async () => {
      const response = await request(app)
        .get("/users?page=abc&limit=xyz")
        .expect(200);

      // Should default to page=1, limit=10 when parameters are non-numeric
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(10);
    });
  });

  describe("Out-of-bounds pages", () => {
    beforeEach(async () => {
      // Create 5 test users
      for (let i = 1; i <= 5; i++) {
        await request(app)
          .post("/users")
          .send({
            name: `User ${i}`,
            email: `user${i}@example.com`
          });
      }
    });

    it("should return empty users array for out-of-bounds page", async () => {
      const response = await request(app)
        .get("/users?page=10&limit=10")
        .expect(200);

      expect(response.body).toEqual({
        users: [],
        totalCount: 5,
        page: 10,
        limit: 10
      });
    });

    it("should return partial results for last page", async () => {
      const response = await request(app)
        .get("/users?page=2&limit=3")
        .expect(200);

      expect(response.body.users).toHaveLength(2); // Only 2 users left on page 2
      expect(response.body.totalCount).toBe(5);
      expect(response.body.page).toBe(2);
      expect(response.body.limit).toBe(3);
      expect(response.body.users[0]).toHaveProperty("name", "User 4");
      expect(response.body.users[1]).toHaveProperty("name", "User 5");
    });
  });
});


