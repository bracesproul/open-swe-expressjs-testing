import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import request from "supertest";
import express, { Request, Response } from "express";

// Import the app logic (we'll need to refactor the main file to export the app)
// For now, let's recreate the relevant parts for testing

interface User {
  id: number;
  name: string;
  email: string;
  createdAt: Date;
}

// Create test app with the same logic as main app
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

  return { app, users, setNextId: (id: number) => { nextId = id; } };
}

describe("GET /users - Pagination Integration Tests", () => {
  let testApp: ReturnType<typeof createTestApp>;
  let app: express.Application;

  beforeEach(() => {
    testApp = createTestApp();
    app = testApp.app;
  });

  afterEach(() => {
    // Clean up is handled by recreating the app in beforeEach
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

    it("should return first page with default limit when only page is specified", async () => {
      const response = await request(app)
        .get("/users?page=1")
        .expect(200);

      expect(response.body).toEqual({
        users: [],
        totalCount: 0,
        page: 1,
        limit: 10
      });
    });

    it("should return first page with custom limit when only limit is specified", async () => {
      const response = await request(app)
        .get("/users?limit=5")
        .expect(200);

      expect(response.body).toEqual({
        users: [],
        totalCount: 0,
        page: 1,
        limit: 5
      });
    });
  });

  describe("Custom pagination parameters", () => {
    beforeEach(async () => {
      // Create test users
      for (let i = 1; i <= 25; i++) {
        await request(app)
          .post("/users")
          .send({
            name: `User ${i}`,
            email: `user${i}@example.com`
          });
      }
    });

    it("should return correct page with custom page and limit", async () => {
      const response = await request(app)
        .get("/users?page=2&limit=5")
        .expect(200);

      expect(response.body.users).toHaveLength(5);
      expect(response.body.totalCount).toBe(25);
      expect(response.body.page).toBe(2);
      expect(response.body.limit).toBe(5);
      
      // Check that we get users 6-10 (second page with limit 5)
      expect(response.body.users[0].name).toBe("User 6");
      expect(response.body.users[4].name).toBe("User 10");
    });

    it("should return correct page with different limit", async () => {
      const response = await request(app)
        .get("/users?page=3&limit=7")
        .expect(200);

      expect(response.body.users).toHaveLength(7);
      expect(response.body.totalCount).toBe(25);
      expect(response.body.page).toBe(3);
      expect(response.body.limit).toBe(7);
      
      // Check that we get users 15-21 (third page with limit 7: offset = (3-1)*7 = 14)
      expect(response.body.users[0].name).toBe("User 15");
      expect(response.body.users[6].name).toBe("User 21");
    });

    it("should return partial results for last page", async () => {
      const response = await request(app)
        .get("/users?page=3&limit=10")
        .expect(200);

      expect(response.body.users).toHaveLength(5); // Only 5 users left on page 3
      expect(response.body.totalCount).toBe(25);
      expect(response.body.page).toBe(3);
      expect(response.body.limit).toBe(10);
      
      // Check that we get users 21-25 (third page with limit 10: offset = (3-1)*10 = 20)
      expect(response.body.users[0].name).toBe("User 21");
      expect(response.body.users[4].name).toBe("User 25");
    });
  });

  describe("Edge cases and invalid parameters", () => {
    it("should default to page 1 for invalid page parameter", async () => {
      const response = await request(app)
        .get("/users?page=invalid&limit=5")
        .expect(200);

      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(5);
    });

    it("should default to limit 10 for invalid limit parameter", async () => {
      const response = await request(app)
        .get("/users?page=2&limit=invalid")
        .expect(200);

      expect(response.body.page).toBe(2);
      expect(response.body.limit).toBe(10);
    });

    it("should default to page 1 for negative page", async () => {
      const response = await request(app)
        .get("/users?page=-1&limit=5")
        .expect(200);

      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(5);
    });

    it("should default to limit 10 for negative limit", async () => {
      const response = await request(app)
        .get("/users?page=1&limit=-5")
        .expect(200);

      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(10);
    });

    it("should default to page 1 for zero page", async () => {
      const response = await request(app)
        .get("/users?page=0&limit=5")
        .expect(200);

      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(5);
    });

    it("should default to limit 10 for zero limit", async () => {
      const response = await request(app)
        .get("/users?page=1&limit=0")
        .expect(200);

      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(10);
    });

    it("should return empty users array for out of range page", async () => {
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
        .get("/users?page=10&limit=5")
        .expect(200);

      expect(response.body.users).toHaveLength(0);
      expect(response.body.totalCount).toBe(5);
      expect(response.body.page).toBe(10);
      expect(response.body.limit).toBe(5);
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
      // Create a test user
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
      expect(typeof user.createdAt).toBe("string"); // Date is serialized as string in JSON
    });
  });
});

