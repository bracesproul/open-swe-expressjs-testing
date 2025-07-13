import { describe, it, expect, beforeEach } from "@jest/globals";
import express, { Request, Response } from "express";
import request from "supertest";

// Mock the users data structure and app setup
interface User {
  id: number;
  name: string;
  email: string;
  createdAt: Date;
}

const users: { [key: number]: User } = {};
let nextId = 1;

// Create test app with pagination endpoint
const app = express();
app.use(express.json());

// GET /users - Get all users with pagination
app.get("/users", (req: Request, res: Response) => {
  const userList = Object.values(users);
  
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
  
  // Calculate pagination
  const totalCount = userList.length;
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

// Helper function to create test users
function createTestUser(name: string, email: string): User {
  const user: User = {
    id: nextId++,
    name,
    email,
    createdAt: new Date(),
  };
  users[user.id] = user;
  return user;
}

// Helper function to clear users
function clearUsers() {
  Object.keys(users).forEach(key => delete users[parseInt(key)]);
  nextId = 1;
}

describe("GET /users - Pagination Tests", () => {
  beforeEach(() => {
    clearUsers();
  });

  describe("Default pagination behavior", () => {
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
      // Create 5 test users
      const testUsers = [];
      for (let i = 1; i <= 5; i++) {
        testUsers.push(createTestUser(`User ${i}`, `user${i}@example.com`));
      }

      const response = await request(app).get("/users");
      
      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(5);
      expect(response.body.totalCount).toBe(5);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(10);
      expect(response.body.users[0]).toMatchObject({
        id: expect.any(Number),
        name: expect.any(String),
        email: expect.any(String),
        createdAt: expect.any(String)
      });
    });

    it("should return first 10 users when more than 10 users exist", async () => {
      // Create 15 test users
      for (let i = 1; i <= 15; i++) {
        createTestUser(`User ${i}`, `user${i}@example.com`);
      }

      const response = await request(app).get("/users");
      
      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(10);
      expect(response.body.totalCount).toBe(15);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(10);
    });
  });

  describe("Custom page and limit parameters", () => {
    beforeEach(() => {
      // Create 25 test users for pagination testing
      for (let i = 1; i <= 25; i++) {
        createTestUser(`User ${i}`, `user${i}@example.com`);
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

    it("should return correct users for page 3 with limit 7", async () => {
      const response = await request(app).get("/users?page=3&limit=7");
      
      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(7);
      expect(response.body.totalCount).toBe(25);
      expect(response.body.page).toBe(3);
      expect(response.body.limit).toBe(7);
    });

    it("should return remaining users when on last page with partial results", async () => {
      const response = await request(app).get("/users?page=3&limit=10");
      
      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(5); // 25 total, page 3 with limit 10 = 5 remaining
      expect(response.body.totalCount).toBe(25);
      expect(response.body.page).toBe(3);
      expect(response.body.limit).toBe(10);
    });

    it("should handle large limit values correctly", async () => {
      const response = await request(app).get("/users?limit=100");
      
      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(25); // All users returned
      expect(response.body.totalCount).toBe(25);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(100);
    });
  });

  describe("Edge cases and error handling", () => {
    it("should return 400 error for invalid page parameter (page < 1)", async () => {
      const response = await request(app).get("/users?page=0");
      
      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: "Page must be greater than 0"
      });
    });

    it("should return 400 error for invalid limit parameter (limit < 1)", async () => {
      const response = await request(app).get("/users?limit=0");
      
      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: "Limit must be greater than 0"
      });
    });

    it("should return empty users array for out of range page", async () => {
      // Create 5 users
      for (let i = 1; i <= 5; i++) {
        createTestUser(`User ${i}`, `user${i}@example.com`);
      }

      const response = await request(app).get("/users?page=10&limit=5");
      
      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(0);
      expect(response.body.totalCount).toBe(5);
      expect(response.body.page).toBe(10);
      expect(response.body.limit).toBe(5);
    });

    it("should handle non-numeric query parameters gracefully (fallback to defaults)", async () => {
      createTestUser("Test User", "test@example.com");
      
      const response = await request(app).get("/users?page=abc&limit=xyz");
      
      expect(response.status).toBe(200);
      expect(response.body.page).toBe(1); // Fallback to default
      expect(response.body.limit).toBe(10); // Fallback to default
    });

    it("should handle negative numbers correctly", async () => {
      const response1 = await request(app).get("/users?page=-1");
      expect(response1.status).toBe(400);
      expect(response1.body.error).toBe("Page must be greater than 0");

      const response2 = await request(app).get("/users?limit=-5");
      expect(response2.status).toBe(400);
      expect(response2.body.error).toBe("Limit must be greater than 0");
    });
  });

  describe("Response format structure", () => {
    it("should always return response with correct structure", async () => {
      createTestUser("Test User", "test@example.com");
      
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
      const testUser = createTestUser("John Doe", "john@example.com");
      
      const response = await request(app).get("/users");
      
      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(1);
      
      const returnedUser = response.body.users[0];
      expect(returnedUser).toHaveProperty("id");
      expect(returnedUser).toHaveProperty("name");
      expect(returnedUser).toHaveProperty("email");
      expect(returnedUser).toHaveProperty("createdAt");
      
      expect(returnedUser.id).toBe(testUser.id);
      expect(returnedUser.name).toBe(testUser.name);
      expect(returnedUser.email).toBe(testUser.email);
    });
  });
});

