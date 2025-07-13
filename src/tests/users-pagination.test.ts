import { describe, it, expect, beforeEach } from "@jest/globals";
import express, { Request, Response } from "express";
import request from "supertest";

// Mock the users data structure and app setup similar to src/index.ts
interface User {
  id: number;
  name: string;
  email: string;
  createdAt: Date;
}

// Create a test app with the pagination endpoint
function createTestApp() {
  const app = express();
  app.use(express.json());
  
  // In-memory test database
  const users: { [key: number]: User } = {};
  let nextId = 1;
  
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
  
  // GET /users - Paginated endpoint (same implementation as in src/index.ts)
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
    
    // Get all users and calculate pagination
    const allUsers = Object.values(users);
    const totalCount = allUsers.length;
    
    // Calculate start and end indices for pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    
    // Get paginated users
    const paginatedUsers = allUsers.slice(startIndex, endIndex);
    
    // Return paginated response
    res.json({
      users: paginatedUsers,
      totalCount,
      page,
      limit
    });
  });
  
  return { app, addTestUser, users };
}

describe("GET /users - Pagination Tests", () => {
  let app: express.Application;
  let addTestUser: (name: string, email: string) => User;
  
  beforeEach(() => {
    const testApp = createTestApp();
    app = testApp.app;
    addTestUser = testApp.addTestUser;
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
    
    it("should use default page=1 and limit=10 when no query parameters provided", async () => {
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
      expect(response.body.users[0].name).toBe("User 1");
      expect(response.body.users[9].name).toBe("User 10");
    });
  });
  
  describe("Custom page and limit parameters", () => {
    beforeEach(() => {
      // Add 25 test users for pagination tests
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
      expect(response.body.users[0].name).toBe("User 6");
      expect(response.body.users[4].name).toBe("User 10");
    });
    
    it("should return correct page with default limit", async () => {
      const response = await request(app).get("/users?page=2");
      
      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(10);
      expect(response.body.totalCount).toBe(25);
      expect(response.body.page).toBe(2);
      expect(response.body.limit).toBe(10);
      expect(response.body.users[0].name).toBe("User 11");
      expect(response.body.users[9].name).toBe("User 20");
    });
    
    it("should return correct results with custom limit and default page", async () => {
      const response = await request(app).get("/users?limit=7");
      
      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(7);
      expect(response.body.totalCount).toBe(25);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(7);
      expect(response.body.users[0].name).toBe("User 1");
      expect(response.body.users[6].name).toBe("User 7");
    });
    
    it("should handle last page with fewer items than limit", async () => {
      const response = await request(app).get("/users?page=3&limit=10");
      
      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(5); // Only 5 users left on page 3
      expect(response.body.totalCount).toBe(25);
      expect(response.body.page).toBe(3);
      expect(response.body.limit).toBe(10);
      expect(response.body.users[0].name).toBe("User 21");
      expect(response.body.users[4].name).toBe("User 25");
    });
  });
  
  describe("Edge cases and error handling", () => {
    beforeEach(() => {
      // Add 10 test users
      for (let i = 1; i <= 10; i++) {
        addTestUser(`User ${i}`, `user${i}@example.com`);
      }
    });
    
    it("should return 400 error for invalid page parameter (page < 1)", async () => {
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
    
    it("should return 400 error for invalid limit parameter (limit < 1)", async () => {
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
    
    it("should return empty users array for out of range page", async () => {
      const response = await request(app).get("/users?page=999&limit=5");
      
      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(0);
      expect(response.body.totalCount).toBe(10);
      expect(response.body.page).toBe(999);
      expect(response.body.limit).toBe(5);
    });
  });
  
  describe("Response format structure", () => {
    it("should always return the correct response structure", async () => {
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
    
    it("should return users with correct structure", async () => {
      const testUser = addTestUser("Test User", "test@example.com");
      
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



