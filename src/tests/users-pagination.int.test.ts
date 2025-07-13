import { describe, it, expect, beforeAll, afterAll, beforeEach } from "@jest/globals";
import request from "supertest";
import express, { Request, Response } from "express";

// User interface definition (copied from main app)
interface User {
  id: number;
  name: string;
  email: string;
  createdAt: Date;
}

// Create a test app instance
const createTestApp = () => {
  const app = express();
  app.use(express.json());

  // In-memory database for testing
  const users: { [key: number]: User } = {};
  let nextId = 1;

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
    const pageParam = req.query.page as string;
    const limitParam = req.query.limit as string;
    
    // Convert to integers with defaults
    let page = pageParam ? parseInt(pageParam, 10) : 1;
    let limit = limitParam ? parseInt(limitParam, 10) : 10;
    
    // Validate parameters
    if (isNaN(page) || page < 1) {
      page = 1;
    }
    if (isNaN(limit) || limit < 1) {
      limit = 10;
    }
    
    // Get all users and calculate pagination
    const userList = Object.values(users);
    const totalCount = userList.length;
    const offset = (page - 1) * limit;
    const paginatedUsers = userList.slice(offset, offset + limit);
    
    // Return paginated response with metadata
    res.json({
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

  // Helper function to clear users (for testing)
  app.delete("/test/clear-users", (_req: Request, res: Response) => {
    Object.keys(users).forEach(key => delete users[parseInt(key)]);
    nextId = 1;
    res.status(204).send();
  });

  return app;
};

describe("GET /users - Pagination Integration Tests", () => {
  let app: express.Application;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(async () => {
    // Clear all users before each test
    await request(app).delete("/test/clear-users");
  });

  describe("Default pagination behavior", () => {
    it("should return default pagination when no query parameters are provided", async () => {
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

    it("should return first 10 users by default when users exist", async () => {
      // Create 15 test users
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

      expect(response.body.users).toHaveLength(10);
      expect(response.body.totalCount).toBe(15);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(10);
      expect(response.body.users[0].name).toBe("User 1");
      expect(response.body.users[9].name).toBe("User 10");
    });
  });

  describe("Custom pagination parameters", () => {
    beforeEach(async () => {
      // Create 25 test users for pagination tests
      for (let i = 1; i <= 25; i++) {
        await request(app)
          .post("/users")
          .send({
            name: `User ${i}`,
            email: `user${i}@example.com`
          });
      }
    });

    it("should handle custom page parameter", async () => {
      const response = await request(app)
        .get("/users?page=2")
        .expect(200);

      expect(response.body.users).toHaveLength(10);
      expect(response.body.totalCount).toBe(25);
      expect(response.body.page).toBe(2);
      expect(response.body.limit).toBe(10);
      expect(response.body.users[0].name).toBe("User 11");
      expect(response.body.users[9].name).toBe("User 20");
    });

    it("should handle custom limit parameter", async () => {
      const response = await request(app)
        .get("/users?limit=5")
        .expect(200);

      expect(response.body.users).toHaveLength(5);
      expect(response.body.totalCount).toBe(25);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(5);
      expect(response.body.users[0].name).toBe("User 1");
      expect(response.body.users[4].name).toBe("User 5");
    });

    it("should handle both custom page and limit parameters", async () => {
      const response = await request(app)
        .get("/users?page=3&limit=7")
        .expect(200);

      expect(response.body.users).toHaveLength(7);
      expect(response.body.totalCount).toBe(25);
      expect(response.body.page).toBe(3);
      expect(response.body.limit).toBe(7);
      expect(response.body.users[0].name).toBe("User 15"); // (3-1) * 7 + 1 = 15
      expect(response.body.users[6].name).toBe("User 21");
    });
  });

  describe("Edge cases and invalid parameters", () => {
    it("should default to page 1 for invalid page parameter", async () => {
      const response = await request(app)
        .get("/users?page=invalid")
        .expect(200);

      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(10);
    });

    it("should default to page 1 for negative page parameter", async () => {
      const response = await request(app)
        .get("/users?page=-1")
        .expect(200);

      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(10);
    });

    it("should default to page 1 for zero page parameter", async () => {
      const response = await request(app)
        .get("/users?page=0")
        .expect(200);

      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(10);
    });

    it("should default to limit 10 for invalid limit parameter", async () => {
      const response = await request(app)
        .get("/users?limit=invalid")
        .expect(200);

      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(10);
    });

    it("should default to limit 10 for negative limit parameter", async () => {
      const response = await request(app)
        .get("/users?limit=-5")
        .expect(200);

      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(10);
    });

    it("should default to limit 10 for zero limit parameter", async () => {
      const response = await request(app)
        .get("/users?limit=0")
        .expect(200);

      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(10);
    });

    it("should handle out of range page gracefully", async () => {
      // Create only 5 users
      for (let i = 1; i <= 5; i++) {
        await request(app)
          .post("/users")
          .send({
            name: `User ${i}`,
            email: `user${i}@example.com`
          });
      }

      const response = await request(app)
        .get("/users?page=10&limit=10")
        .expect(200);

      expect(response.body.users).toHaveLength(0);
      expect(response.body.totalCount).toBe(5);
      expect(response.body.page).toBe(10);
      expect(response.body.limit).toBe(10);
    });
  });

  describe("Response format validation", () => {
    it("should always return the correct response structure", async () => {
      const response = await request(app)
        .get("/users")
        .expect(200);

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
      await request(app)
        .post("/users")
        .send({
          name: "Test User",
          email: "test@example.com"
        });

      const response = await request(app)
        .get("/users")
        .expect(200);

      expect(response.body.users).toHaveLength(1);
      const user = response.body.users[0];
      expect(user).toHaveProperty("id");
      expect(user).toHaveProperty("name");
      expect(user).toHaveProperty("email");
      expect(user).toHaveProperty("createdAt");
      expect(typeof user.id).toBe("number");
      expect(typeof user.name).toBe("string");
      expect(typeof user.email).toBe("string");
      expect(user.name).toBe("Test User");
      expect(user.email).toBe("test@example.com");
    });
  });
});

