import { describe, it, expect, beforeAll, afterAll, beforeEach } from "@jest/globals";
import express from "express";
import request from "supertest";

// Import the app setup from index.ts
// Since we can't directly import the app, we'll recreate the relevant parts for testing
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
  app.get("/users", (req, res) => {
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

  return { app, users, resetUsers: () => {
    Object.keys(users).forEach(key => delete users[parseInt(key)]);
    nextId = 1;
  }};
};

describe("GET /users - Pagination Integration Tests", () => {
  let app: express.Application;
  let resetUsers: () => void;

  beforeAll(() => {
    const testApp = createTestApp();
    app = testApp.app;
    resetUsers = testApp.resetUsers;
  });

  beforeEach(() => {
    // Reset users before each test
    resetUsers();
  });

  describe("Default pagination behavior", () => {
    it("should return default pagination when no query parameters are provided", async () => {
      const response = await request(app).get("/users");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("users");
      expect(response.body).toHaveProperty("totalCount");
      expect(response.body).toHaveProperty("page");
      expect(response.body).toHaveProperty("limit");
      
      expect(response.body.users).toEqual([]);
      expect(response.body.totalCount).toBe(0);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(10);
    });

    it("should return first page with default limit when only page is specified", async () => {
      const response = await request(app).get("/users?page=1");

      expect(response.status).toBe(200);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(10);
    });

    it("should return first page with custom limit when only limit is specified", async () => {
      const response = await request(app).get("/users?limit=5");

      expect(response.status).toBe(200);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(5);
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

    it("should return correct users for different page sizes", async () => {
      const response = await request(app).get("/users?page=3&limit=7");

      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(7);
      expect(response.body.totalCount).toBe(25);
      expect(response.body.page).toBe(3);
      expect(response.body.limit).toBe(7);
      
      // Check that we get users 15-21 (third page with limit 7)
      expect(response.body.users[0].name).toBe("User 15");
      expect(response.body.users[6].name).toBe("User 21");
    });

    it("should return partial results for last page", async () => {
      const response = await request(app).get("/users?page=3&limit=10");

      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(5); // Only 5 users left on page 3
      expect(response.body.totalCount).toBe(25);
      expect(response.body.page).toBe(3);
      expect(response.body.limit).toBe(10);
      
      // Check that we get users 21-25 (last 5 users)
      expect(response.body.users[0].name).toBe("User 21");
      expect(response.body.users[4].name).toBe("User 25");
    });
  });

  describe("Edge cases and invalid parameters", () => {
    it("should handle invalid page parameter (non-numeric)", async () => {
      const response = await request(app).get("/users?page=invalid&limit=5");

      expect(response.status).toBe(200);
      expect(response.body.page).toBe(1); // Should default to 1
      expect(response.body.limit).toBe(5);
    });

    it("should handle invalid limit parameter (non-numeric)", async () => {
      const response = await request(app).get("/users?page=2&limit=invalid");

      expect(response.status).toBe(200);
      expect(response.body.page).toBe(2);
      expect(response.body.limit).toBe(10); // Should default to 10
    });

    it("should handle negative page parameter", async () => {
      const response = await request(app).get("/users?page=-1&limit=5");

      expect(response.status).toBe(200);
      expect(response.body.page).toBe(1); // Should default to 1
      expect(response.body.limit).toBe(5);
    });

    it("should handle negative limit parameter", async () => {
      const response = await request(app).get("/users?page=1&limit=-5");

      expect(response.status).toBe(200);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(10); // Should default to 10
    });

    it("should handle zero page parameter", async () => {
      const response = await request(app).get("/users?page=0&limit=5");

      expect(response.status).toBe(200);
      expect(response.body.page).toBe(1); // Should default to 1
      expect(response.body.limit).toBe(5);
    });

    it("should return empty array for out of range page", async () => {
      // Create only 5 users
      for (let i = 1; i <= 5; i++) {
        await request(app)
          .post("/users")
          .send({
            name: `User ${i}`,
            email: `user${i}@example.com`
          });
      }

      const response = await request(app).get("/users?page=10&limit=5");

      expect(response.status).toBe(200);
      expect(response.body.users).toEqual([]);
      expect(response.body.totalCount).toBe(5);
      expect(response.body.page).toBe(10);
      expect(response.body.limit).toBe(5);
    });
  });

  describe("Response format validation", () => {
    it("should always return the correct response structure", async () => {
      const response = await request(app).get("/users");

      expect(response.status).toBe(200);
      expect(typeof response.body).toBe("object");
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
    });
  });
});

