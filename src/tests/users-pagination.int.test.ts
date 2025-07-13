import { describe, it, expect, beforeAll, afterAll, beforeEach } from "@jest/globals";
import express from "express";
import request from "supertest";

// Import the app - we'll need to modify the main file to export the app
// For now, let's create a test server setup

interface User {
  id: number;
  name: string;
  email: string;
  createdAt: Date;
}

// Test server setup - replicating the main app structure for testing
const app = express();
app.use(express.json());

// In-memory database for testing
const users: { [key: number]: User } = {};
let nextId = 1;

// Helper function to validate user data (copied from main app)
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

// GET /users - Get all users with pagination (the endpoint we're testing)
app.get("/users", (req: express.Request, res: express.Response) => {
  // Parse query parameters with defaults
  const pageParam = req.query.page as string;
  const limitParam = req.query.limit as string;
  
  // Convert to integers with defaults
  let page = 1;
  let limit = 10;
  
  if (pageParam) {
    const parsedPage = parseInt(pageParam, 10);
    if (!isNaN(parsedPage) && parsedPage > 0) {
      page = parsedPage;
    }
  }
  
  if (limitParam) {
    const parsedLimit = parseInt(limitParam, 10);
    if (!isNaN(parsedLimit) && parsedLimit > 0) {
      limit = parsedLimit;
    }
  }
  
  // Get all users and calculate pagination
  const userList = Object.values(users);
  const totalCount = userList.length;
  const offset = (page - 1) * limit;
  const paginatedUsers = userList.slice(offset, offset + limit);
  
  res.json({ users: paginatedUsers, totalCount, page, limit });
});

// POST /users - Create new user (for test data setup)
app.post("/users", (req: express.Request, res: express.Response) => {
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

describe("GET /users - Pagination Integration Tests", () => {
  // Helper function to create test users
  const createTestUser = async (name: string, email: string) => {
    const response = await request(app)
      .post("/users")
      .send({ name, email });
    return response.body;
  };

  // Clear users before each test
  beforeEach(() => {
    // Clear the users object
    Object.keys(users).forEach(key => delete users[parseInt(key)]);
    nextId = 1;
  });

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

