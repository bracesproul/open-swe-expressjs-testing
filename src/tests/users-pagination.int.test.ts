import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import request from "supertest";
import express from "express";

// Import the app setup from the main file
// We'll create a test app instance to avoid port conflicts
interface User {
  id: number;
  name: string;
  email: string;
  createdAt: Date;
}

// Create a test app instance
function createTestApp() {
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
  app.get("/users", (req, res) => {
    // Parse query parameters with defaults
    const pageParam = req.query.page as string;
    const limitParam = req.query.limit as string;
    
    let page = 1;
    let limit = 10;
    
    // Parse and validate page parameter
    if (pageParam) {
      const parsedPage = parseInt(pageParam, 10);
      if (!isNaN(parsedPage) && parsedPage > 0) {
        page = parsedPage;
      }
    }
    
    // Parse and validate limit parameter
    if (limitParam) {
      const parsedLimit = parseInt(limitParam, 10);
      if (!isNaN(parsedLimit) && parsedLimit > 0) {
        limit = parsedLimit;
      }
    }
    
    // Get all users and calculate pagination
    const allUsers = Object.values(users);
    const totalCount = allUsers.length;
    const startIndex = (page - 1) * limit;
    const paginatedUsers = allUsers.slice(startIndex, startIndex + limit);
    
    res.json({ users: paginatedUsers, totalCount, page, limit });
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

  // DELETE /users - Clear all users (for test cleanup)
  app.delete("/users", (req, res) => {
    Object.keys(users).forEach(key => delete users[parseInt(key)]);
    nextId = 1;
    res.status(204).send();
  });

  return app;
}

describe("Users Pagination Integration Tests", () => {
  let app: express.Application;

  beforeEach(() => {
    app = createTestApp();
  });

  afterEach(async () => {
    // Clean up users after each test
    await request(app).delete("/users");
  });

  describe("Default Pagination Behavior", () => {
    it("should return default pagination when no query parameters provided", async () => {
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

      expect(response.body).toHaveProperty('users');
      expect(response.body).toHaveProperty('totalCount', 15);
      expect(response.body).toHaveProperty('page', 1);
      expect(response.body).toHaveProperty('limit', 10);
      expect(response.body.users).toHaveLength(10);
    });

    it("should use default page=1 when only limit is provided", async () => {
      // Create test users
      for (let i = 1; i <= 8; i++) {
        await request(app)
          .post("/users")
          .send({
            name: `User ${i}`,
            email: `user${i}@example.com`
          });
      }

      const response = await request(app)
        .get("/users?limit=5")
        .expect(200);

      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(5);
      expect(response.body.users).toHaveLength(5);
      expect(response.body.totalCount).toBe(8);
    });

    it("should use default limit=10 when only page is provided", async () => {
      // Create test users
      for (let i = 1; i <= 25; i++) {
        await request(app)
          .post("/users")
          .send({
            name: `User ${i}`,
            email: `user${i}@example.com`
          });
      }

      const response = await request(app)
        .get("/users?page=2")
        .expect(200);

      expect(response.body.page).toBe(2);
      expect(response.body.limit).toBe(10);
      expect(response.body.users).toHaveLength(10);
      expect(response.body.totalCount).toBe(25);
    });
  });

  describe("Custom Pagination Parameters", () => {
    beforeEach(async () => {
      // Create 20 test users for pagination tests
      for (let i = 1; i <= 20; i++) {
        await request(app)
          .post("/users")
          .send({
            name: `User ${i}`,
            email: `user${i}@example.com`
          });
      }
    });

    it("should handle custom page and limit parameters", async () => {
      const response = await request(app)
        .get("/users?page=2&limit=5")
        .expect(200);

      expect(response.body.page).toBe(2);
      expect(response.body.limit).toBe(5);
      expect(response.body.users).toHaveLength(5);
      expect(response.body.totalCount).toBe(20);
      
      // Check that we get the correct users (users 6-10)
      expect(response.body.users[0].id).toBe(6);
      expect(response.body.users[4].id).toBe(10);
    });

    it("should handle last page with partial results", async () => {
      const response = await request(app)
        .get("/users?page=3&limit=7")
        .expect(200);

      expect(response.body.page).toBe(3);
      expect(response.body.limit).toBe(7);
      expect(response.body.users).toHaveLength(6); // Only 6 users left on page 3
      expect(response.body.totalCount).toBe(20);
    });

    it("should return empty results when page exceeds available data", async () => {
      const response = await request(app)
        .get("/users?page=10&limit=5")
        .expect(200);

      expect(response.body.page).toBe(10);
      expect(response.body.limit).toBe(5);
      expect(response.body.users).toHaveLength(0);
      expect(response.body.totalCount).toBe(20);
    });
  });

  describe("Invalid Parameters Handling", () => {
    beforeEach(async () => {
      // Create a few test users
      for (let i = 1; i <= 5; i++) {
        await request(app)
          .post("/users")
          .send({
            name: `User ${i}`,
            email: `user${i}@example.com`
          });
      }
    });

    it("should use defaults for invalid page parameter", async () => {
      const response = await request(app)
        .get("/users?page=invalid&limit=3")
        .expect(200);

      expect(response.body.page).toBe(1); // Default
      expect(response.body.limit).toBe(3);
    });

    it("should use defaults for invalid limit parameter", async () => {
      const response = await request(app)
        .get("/users?page=1&limit=invalid")
        .expect(200);

      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(10); // Default
    });

    it("should use defaults for negative parameters", async () => {
      const response = await request(app)
        .get("/users?page=-1&limit=-5")
        .expect(200);

      expect(response.body.page).toBe(1); // Default
      expect(response.body.limit).toBe(10); // Default
    });

    it("should use defaults for zero parameters", async () => {
      const response = await request(app)
        .get("/users?page=0&limit=0")
        .expect(200);

      expect(response.body.page).toBe(1); // Default
      expect(response.body.limit).toBe(10); // Default
    });
  });

  describe("Response Format and Structure", () => {
    beforeEach(async () => {
      // Create test users
      for (let i = 1; i <= 3; i++) {
        await request(app)
          .post("/users")
          .send({
            name: `User ${i}`,
            email: `user${i}@example.com`
          });
      }
    });

    it("should return correct response structure", async () => {
      const response = await request(app)
        .get("/users?page=1&limit=2")
        .expect(200);

      expect(response.body).toHaveProperty('users');
      expect(response.body).toHaveProperty('totalCount');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('limit');
      
      expect(Array.isArray(response.body.users)).toBe(true);
      expect(typeof response.body.totalCount).toBe('number');
      expect(typeof response.body.page).toBe('number');
      expect(typeof response.body.limit).toBe('number');
    });

    it("should return users with correct structure", async () => {
      const response = await request(app)
        .get("/users?page=1&limit=2")
        .expect(200);

      expect(response.body.users).toHaveLength(2);
      
      response.body.users.forEach((user: any) => {
        expect(user).toHaveProperty('id');
        expect(user).toHaveProperty('name');
        expect(user).toHaveProperty('email');
        expect(user).toHaveProperty('createdAt');
        
        expect(typeof user.id).toBe('number');
        expect(typeof user.name).toBe('string');
        expect(typeof user.email).toBe('string');
        expect(typeof user.createdAt).toBe('string'); // Date serialized as string in JSON
      });
    });

    it("should maintain consistent totalCount across different pagination requests", async () => {
      const response1 = await request(app)
        .get("/users?page=1&limit=2")
        .expect(200);

      const response2 = await request(app)
        .get("/users?page=2&limit=1")
        .expect(200);

      expect(response1.body.totalCount).toBe(3);
      expect(response2.body.totalCount).toBe(3);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty users database", async () => {
      const response = await request(app)
        .get("/users?page=1&limit=10")
        .expect(200);

      expect(response.body.users).toHaveLength(0);
      expect(response.body.totalCount).toBe(0);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(10);
    });

    it("should handle large limit values", async () => {
      // Create 5 users
      for (let i = 1; i <= 5; i++) {
        await request(app)
          .post("/users")
          .send({
            name: `User ${i}`,
            email: `user${i}@example.com`
          });
      }

      const response = await request(app)
        .get("/users?page=1&limit=100")
        .expect(200);

      expect(response.body.users).toHaveLength(5); // Only 5 users available
      expect(response.body.totalCount).toBe(5);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(100);
    });
  });
});

