import { describe, it, expect, beforeEach, afterAll } from "@jest/globals";
import express from "express";
import { Server } from "http";

// Create a test server instance
let server: Server;
let port: number;

// User interface for testing
interface User {
  id: number;
  name: string;
  email: string;
  createdAt: string;
}

// In-memory database for testing
const testUsers: { [key: number]: User } = {};
let testNextId = 1;

// Helper function to reset test data
function resetTestData() {
  Object.keys(testUsers).forEach(key => delete testUsers[parseInt(key)]);
  testNextId = 1;
}

// Helper function to add test users
function addTestUser(name: string, email: string): User {
  const user: User = {
    id: testNextId++,
    name,
    email,
    createdAt: new Date().toISOString()
  };
  testUsers[user.id] = user;
  return user;
}

// Create test Express app
function createTestApp() {
  const app = express();
  app.use(express.json());

  // GET /users endpoint with pagination
  app.get("/users", (req, res) => {
    const userList = Object.values(testUsers);
    
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
    const offset = (page - 1) * limit;
    const paginatedUsers = userList.slice(offset, offset + limit);
    
    // Return paginated response
    res.json({
      users: paginatedUsers,
      totalCount,
      page,
      limit
    });
  });

  // POST /users endpoint for creating test data
  app.post("/users", (req, res) => {
    const { name, email } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: "Name and email are required" });
    }
    
    const user = addTestUser(name, email);
    res.status(201).json(user);
  });

  return app;
}

// Helper function to make HTTP requests
async function makeRequest(path: string): Promise<Response> {
  const response = await fetch(`http://localhost:${port}${path}`);
  return response;
}

// Helper function to make POST requests
async function makePostRequest(path: string, body: any): Promise<Response> {
  const response = await fetch(`http://localhost:${port}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return response;
}

describe("Users Pagination Integration Tests", () => {
  beforeEach(async () => {
    resetTestData();
    
    // Create and start test server
    const app = createTestApp();
    server = app.listen(0); // Use port 0 to get a random available port
    
    // Get the actual port number
    const address = server.address();
    if (address && typeof address === 'object') {
      port = address.port;
    }
  });

  afterAll(() => {
    if (server) {
      server.close();
    }
  });

  describe("Default Pagination Behavior", () => {
    it("should return default pagination when no query parameters are provided", async () => {
      // Add some test users
      for (let i = 1; i <= 15; i++) {
        addTestUser(`User ${i}`, `user${i}@example.com`);
      }

      const response = await makeRequest("/users");
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('users');
      expect(data).toHaveProperty('totalCount', 15);
      expect(data).toHaveProperty('page', 1);
      expect(data).toHaveProperty('limit', 10);
      expect(data.users).toHaveLength(10);
    });

    it("should use default page=1 when only limit is provided", async () => {
      for (let i = 1; i <= 8; i++) {
        addTestUser(`User ${i}`, `user${i}@example.com`);
      }

      const response = await makeRequest("/users?limit=5");
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.page).toBe(1);
      expect(data.limit).toBe(5);
      expect(data.totalCount).toBe(8);
      expect(data.users).toHaveLength(5);
    });

    it("should use default limit=10 when only page is provided", async () => {
      for (let i = 1; i <= 5; i++) {
        addTestUser(`User ${i}`, `user${i}@example.com`);
      }

      const response = await makeRequest("/users?page=1");
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.page).toBe(1);
      expect(data.limit).toBe(10);
      expect(data.totalCount).toBe(5);
      expect(data.users).toHaveLength(5);
    });
  });

  describe("Pagination with Various Parameters", () => {
    beforeEach(() => {
      // Add 25 test users for pagination testing
      for (let i = 1; i <= 25; i++) {
        addTestUser(`User ${i}`, `user${i}@example.com`);
      }
    });

    it("should return correct page with page=1&limit=5", async () => {
      const response = await makeRequest("/users?page=1&limit=5");
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.users).toHaveLength(5);
      expect(data.totalCount).toBe(25);
      expect(data.page).toBe(1);
      expect(data.limit).toBe(5);
      
      // Verify we get the first 5 users
      expect(data.users[0].name).toBe("User 1");
      expect(data.users[4].name).toBe("User 5");
    });

    it("should return correct page with page=3&limit=5", async () => {
      const response = await makeRequest("/users?page=3&limit=5");
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.users).toHaveLength(5);
      expect(data.totalCount).toBe(25);
      expect(data.page).toBe(3);
      expect(data.limit).toBe(5);
      
      // Verify we get users 11-15 (page 3 with limit 5)
      expect(data.users[0].name).toBe("User 11");
      expect(data.users[4].name).toBe("User 15");
    });

    it("should return partial results for last page", async () => {
      const response = await makeRequest("/users?page=5&limit=6");
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.users).toHaveLength(1); // 25 users, page 5 with limit 6 = 1 user left
      expect(data.totalCount).toBe(25);
      expect(data.page).toBe(5);
      expect(data.limit).toBe(6);
      
      // Verify we get the last user
      expect(data.users[0].name).toBe("User 25");
    });

    it("should return empty array when page exceeds available data", async () => {
      const response = await makeRequest("/users?page=10&limit=5");
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.users).toHaveLength(0);
      expect(data.totalCount).toBe(25);
      expect(data.page).toBe(10);
      expect(data.limit).toBe(5);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty user list", async () => {
      const response = await makeRequest("/users?page=1&limit=10");
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.users).toEqual([]);
      expect(data.totalCount).toBe(0);
      expect(data.page).toBe(1);
      expect(data.limit).toBe(10);
    });

    it("should handle single user", async () => {
      addTestUser("Single User", "single@example.com");

      const response = await makeRequest("/users?page=1&limit=10");
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.users).toHaveLength(1);
      expect(data.totalCount).toBe(1);
      expect(data.users[0].name).toBe("Single User");
    });
  });

  describe("Error Handling", () => {
    it("should return 400 for invalid page parameter (page < 1)", async () => {
      const response = await makeRequest("/users?page=0&limit=10");
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe("Page must be greater than 0");
    });

    it("should return 400 for invalid limit parameter (limit < 1)", async () => {
      const response = await makeRequest("/users?page=1&limit=0");
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe("Limit must be greater than 0");
    });

    it("should return 400 for negative page", async () => {
      const response = await makeRequest("/users?page=-1&limit=10");
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe("Page must be greater than 0");
    });

    it("should return 400 for negative limit", async () => {
      const response = await makeRequest("/users?page=1&limit=-5");
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe("Limit must be greater than 0");
    });
  });

  describe("Response Format Validation", () => {
    it("should return proper JSON response structure", async () => {
      addTestUser("Test User", "test@example.com");

      const response = await makeRequest("/users?page=1&limit=10");
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('application/json');

      const data = await response.json();
      
      // Validate response structure
      expect(data).toHaveProperty('users');
      expect(data).toHaveProperty('totalCount');
      expect(data).toHaveProperty('page');
      expect(data).toHaveProperty('limit');

      // Validate data types
      expect(Array.isArray(data.users)).toBe(true);
      expect(typeof data.totalCount).toBe('number');
      expect(typeof data.page).toBe('number');
      expect(typeof data.limit).toBe('number');

      // Validate user object structure
      if (data.users.length > 0) {
        const user = data.users[0];
        expect(user).toHaveProperty('id');
        expect(user).toHaveProperty('name');
        expect(user).toHaveProperty('email');
        expect(user).toHaveProperty('createdAt');
        expect(typeof user.id).toBe('number');
        expect(typeof user.name).toBe('string');
        expect(typeof user.email).toBe('string');
        expect(typeof user.createdAt).toBe('string');
      }
    });
  });
});

