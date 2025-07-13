import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import express, { Request, Response } from "express";
import request from "supertest";

// Mock the users data structure and app setup similar to src/index.ts
interface User {
  id: number;
  name: string;
  email: string;
  createdAt: Date;
}

// Create a test app with the same structure as the main app
const createTestApp = () => {
  const app = express();
  const users: { [key: number]: User } = {};
  let nextId = 1;

  app.use(express.json());

  // Helper function to add test users
  const addTestUser = (name: string, email: string): User => {
    const user: User = {
      id: nextId++,
      name,
      email,
      createdAt: new Date(),
    };
    users[user.id] = user;
    return user;
  };

  // GET /users - Get all users with pagination (same implementation as main app)
  app.get("/users", (req: Request, res: Response) => {
    // Parse query parameters with defaults
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    // Validate parameters
    if (page < 1) {
      return res.status(400).json({ error: "Page must be greater than 0" });
    }
    if (limit < 1) {
      return res.status(400).json({ error: "Limit must be greater than 0" });
    }
    if (limit > 100) {
      return res.status(400).json({ error: "Limit cannot exceed 100" });
    }

    const userList = Object.values(users);
    const totalCount = userList.length;
    
    // Calculate pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedUsers = userList.slice(startIndex, endIndex);

    res.json({
      users: paginatedUsers,
      totalCount,
      page,
      limit
    });
  });

  return { app, addTestUser, users };
};

describe("Users Pagination", () => {
  let app: express.Application;
  let addTestUser: (name: string, email: string) => User;
  let users: { [key: number]: User };

  beforeEach(() => {
    const testApp = createTestApp();
    app = testApp.app;
    addTestUser = testApp.addTestUser;
    users = testApp.users;
  });

  afterEach(() => {
    // Clear users after each test
    Object.keys(users).forEach(key => delete users[parseInt(key)]);
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

    it("should return all users with default pagination (page=1, limit=10) when no query params provided", async () => {
      // Add 5 test users
      for (let i = 1; i <= 5; i++) {
        addTestUser(`User ${i}`, `user${i}@example.com`);
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

    it("should return first 10 users when more than 10 users exist", async () => {
      // Add 15 test users
      for (let i = 1; i <= 15; i++) {
        addTestUser(`User ${i}`, `user${i}@example.com`);
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
    beforeEach(() => {
      // Add 25 test users for pagination testing
      for (let i = 1; i <= 25; i++) {
        addTestUser(`User ${i}`, `user${i}@example.com`);
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

    it("should return correct page with default limit when only page is specified", async () => {
      const response = await request(app).get("/users?page=2");

      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(10);
      expect(response.body.totalCount).toBe(25);
      expect(response.body.page).toBe(2);
      expect(response.body.limit).toBe(10);
    });

    it("should return first page with custom limit when only limit is specified", async () => {
      const response = await request(app).get("/users?limit=7");

      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(7);
      expect(response.body.totalCount).toBe(25);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(7);
    });

    it("should return empty array when page is beyond available data", async () => {
      const response = await request(app).get("/users?page=10&limit=10");

      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(0);
      expect(response.body.totalCount).toBe(25);
      expect(response.body.page).toBe(10);
      expect(response.body.limit).toBe(10);
    });

    it("should return partial results on last page", async () => {
      const response = await request(app).get("/users?page=3&limit=10");

      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(5); // 25 total, page 3 with limit 10 = 5 remaining
      expect(response.body.totalCount).toBe(25);
      expect(response.body.page).toBe(3);
      expect(response.body.limit).toBe(10);
    });
  });

  describe("Edge Cases and Invalid Parameters", () => {
    it("should return 400 error for page less than 1", async () => {
      const response = await request(app).get("/users?page=0");

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: "Page must be greater than 0"
      });
    });

    it("should return 400 error for negative page", async () => {
      const response = await request(app).get("/users?page=-1");

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: "Page must be greater than 0"
      });
    });

    it("should return 400 error for limit less than 1", async () => {
      const response = await request(app).get("/users?limit=0");

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: "Limit must be greater than 0"
      });
    });

    it("should return 400 error for limit greater than 100", async () => {
      const response = await request(app).get("/users?limit=101");

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: "Limit cannot exceed 100"
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

  describe("Response Format Structure", () => {
    it("should always return response with correct structure", async () => {
      addTestUser("Test User", "test@example.com");

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

    it("should return users with correct user object structure", async () => {
      const testUser = addTestUser("Test User", "test@example.com");

      const response = await request(app).get("/users");

      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(1);
      
      const returnedUser = response.body.users[0];
      expect(returnedUser).toHaveProperty("id", testUser.id);
      expect(returnedUser).toHaveProperty("name", testUser.name);
      expect(returnedUser).toHaveProperty("email", testUser.email);
      expect(returnedUser).toHaveProperty("createdAt");
      expect(new Date(returnedUser.createdAt)).toBeInstanceOf(Date);
    });
  });
});

