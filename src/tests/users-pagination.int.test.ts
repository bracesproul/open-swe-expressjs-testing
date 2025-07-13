import { describe, it, expect, beforeAll, afterAll, beforeEach } from "@jest/globals";
import request from "supertest";
import express, { Request, Response } from "express";
import { Server } from "http";

// User interface definition
interface User {
  id: number;
  name: string;
  email: string;
  createdAt: Date;
}

// In-memory database for integration tests
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

// Create Express app for integration testing
const createApp = () => {
  const app = express();
  app.use(express.json());

  // GET /users - Get all users with pagination
  app.get("/users", (req: Request, res: Response) => {
    // Parse query parameters with defaults
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    
    // Validate pagination parameters
    if (page < 1 || limit < 1) {
      return res.status(400).json({ 
        error: "Invalid pagination parameters. Page and limit must be positive integers." 
      });
    }
    
    // Get all users as array
    const allUsers = Object.values(users);
    const totalCount = allUsers.length;
    
    // Calculate pagination
    const offset = (page - 1) * limit;
    const paginatedUsers = allUsers.slice(offset, offset + limit);
    
    // Return paginated response
    res.json({ users: paginatedUsers, totalCount, page, limit });
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
};

describe("Users Pagination Integration Tests", () => {
  let app: express.Application;
  let server: Server;
  const PORT = 3001; // Use different port for testing

  beforeAll((done) => {
    app = createApp();
    server = app.listen(PORT, () => {
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  beforeEach(() => {
    // Clear users before each test
    Object.keys(users).forEach(key => delete users[parseInt(key)]);
    nextId = 1;
  });

  const createTestUser = async (name: string, email: string) => {
    const response = await request(app)
      .post('/users')
      .send({ name, email });
    return response.body;
  };

  describe("Default pagination behavior", () => {
    it("should return default pagination when no query parameters provided", async () => {
      // Create some test users
      await createTestUser("John Doe", "john@example.com");
      await createTestUser("Jane Smith", "jane@example.com");
      await createTestUser("Bob Johnson", "bob@example.com");

      const response = await request(app).get('/users');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('users');
      expect(response.body).toHaveProperty('totalCount', 3);
      expect(response.body).toHaveProperty('page', 1);
      expect(response.body).toHaveProperty('limit', 10);
      expect(response.body.users).toHaveLength(3);
      expect(Array.isArray(response.body.users)).toBe(true);
    });

    it("should return empty result when no users exist", async () => {
      const response = await request(app).get('/users');

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

    it("should handle custom page and limit parameters", async () => {
      const response = await request(app).get('/users?page=2&limit=5');

      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(5);
      expect(response.body.totalCount).toBe(15);
      expect(response.body.page).toBe(2);
      expect(response.body.limit).toBe(5);

      // Verify we get the correct users (users 6-10 for page 2 with limit 5)
      expect(response.body.users[0].name).toBe('User 6');
      expect(response.body.users[4].name).toBe('User 10');
    });

    it("should handle first page correctly", async () => {
      const response = await request(app).get('/users?page=1&limit=3');

      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(3);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(3);
      expect(response.body.users[0].name).toBe('User 1');
      expect(response.body.users[2].name).toBe('User 3');
    });

    it("should handle last page with fewer items than limit", async () => {
      const response = await request(app).get('/users?page=3&limit=6');

      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(3); // 15 users, page 3 with limit 6 = 3 users left
      expect(response.body.totalCount).toBe(15);
      expect(response.body.page).toBe(3);
      expect(response.body.limit).toBe(6);
      expect(response.body.users[0].name).toBe('User 13');
      expect(response.body.users[2].name).toBe('User 15');
    });

    it("should return empty array for page beyond available data", async () => {
      const response = await request(app).get('/users?page=5&limit=10');

      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(0);
      expect(response.body.totalCount).toBe(15);
      expect(response.body.page).toBe(5);
      expect(response.body.limit).toBe(10);
    });

    it("should handle large limit values", async () => {
      const response = await request(app).get('/users?page=1&limit=100');

      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(15); // All users returned
      expect(response.body.totalCount).toBe(15);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(100);
    });
  });

  describe("Parameter validation and error handling", () => {
    it("should return 400 for invalid page parameter (zero)", async () => {
      const response = await request(app).get('/users?page=0&limit=10');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid pagination parameters');
    });

    it("should return 400 for invalid limit parameter (zero)", async () => {
      const response = await request(app).get('/users?page=1&limit=0');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid pagination parameters');
    });

    it("should return 400 for negative page parameter", async () => {
      const response = await request(app).get('/users?page=-1&limit=10');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid pagination parameters');
    });

    it("should return 400 for negative limit parameter", async () => {
      const response = await request(app).get('/users?page=1&limit=-5');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid pagination parameters');
    });

    it("should handle non-numeric parameters gracefully (default to page=1, limit=10)", async () => {
      const response = await request(app).get('/users?page=abc&limit=def');

      expect(response.status).toBe(200);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(10);
    });
  });

  describe("Response structure validation", () => {
    it("should always return the correct response structure", async () => {
      await createTestUser("Test User", "test@example.com");
      
      const response = await request(app).get('/users');

      expect(response.status).toBe(200);
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
      await createTestUser("Test User", "test@example.com");
      
      const response = await request(app).get('/users');

      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(1);
      
      const user = response.body.users[0];
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
});

