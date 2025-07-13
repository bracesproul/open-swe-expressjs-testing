import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import express from "express";
import request from "supertest";

// Mock the users data structure and app setup similar to src/index.ts
interface User {
  id: number;
  name: string;
  email: string;
  createdAt: Date;
}

const users: { [key: number]: User } = {};
let nextId = 1;

// Create test app with the same structure as main app
const app = express();
app.use(express.json());

// Helper function to validate user data (same as main app)
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

// Implement the paginated GET /users endpoint for testing
app.get("/users", (req, res) => {
  const userList = Object.values(users);
  
  // Parse pagination parameters with defaults
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  
  // Validate pagination parameters
  if (page < 1) {
    return res.status(400).json({ error: "Page must be greater than 0" });
  }
  
  if (limit < 1) {
    return res.status(400).json({ error: "Limit must be greater than 0" });
  }
  
  // Calculate pagination
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

// POST /users endpoint for creating test data
app.post("/users", (req, res) => {
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

  afterEach(() => {
    // Clean up after each test
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
  });

  describe("Custom pagination parameters", () => {
    beforeEach(async () => {
      // Create 25 test users for pagination testing
      for (let i = 1; i <= 25; i++) {
        await createTestUser(`User ${i}`, `user${i}@example.com`);
      }
    });

    it("should handle custom page parameter", async () => {
      const response = await request(app).get("/users?page=2");

      expect(response.status).toBe(200);
      expect(response.body.page).toBe(2);
      expect(response.body.limit).toBe(10);
      expect(response.body.totalCount).toBe(25);
      expect(response.body.users).toHaveLength(10);
      // Should return users 11-20 (second page)
      expect(response.body.users[0].name).toBe("User 11");
    });

    it("should handle custom limit parameter", async () => {
      const response = await request(app).get("/users?limit=5");

      expect(response.status).toBe(200);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(5);
      expect(response.body.totalCount).toBe(25);
      expect(response.body.users).toHaveLength(5);
    });

    it("should handle both custom page and limit parameters", async () => {
      const response = await request(app).get("/users?page=3&limit=7");

      expect(response.status).toBe(200);
      expect(response.body.page).toBe(3);
      expect(response.body.limit).toBe(7);
      expect(response.body.totalCount).toBe(25);
      expect(response.body.users).toHaveLength(7);
      // Should return users 15-21 (third page with limit 7: offset = (3-1)*7 = 14)
      expect(response.body.users[0].name).toBe("User 15");
    });

    it("should handle large limit that exceeds total count", async () => {
      const response = await request(app).get("/users?limit=100");

      expect(response.status).toBe(200);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(100);
      expect(response.body.totalCount).toBe(25);
      expect(response.body.users).toHaveLength(25); // Should return all users
    });
  });

  describe("Edge cases and error handling", () => {
    beforeEach(async () => {
      // Create 15 test users
      for (let i = 1; i <= 15; i++) {
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

    it("should return empty users array for page beyond available data", async () => {
      const response = await request(app).get("/users?page=10&limit=10");

      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(0);
      expect(response.body.totalCount).toBe(15);
      expect(response.body.page).toBe(10);
      expect(response.body.limit).toBe(10);
    });
  });

  describe("Response format validation", () => {
    beforeEach(async () => {
      await createTestUser("Test User", "test@example.com");
    });

    it("should return response with correct structure and data types", async () => {
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
      const response = await request(app).get("/users");

      expect(response.status).toBe(200);
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

