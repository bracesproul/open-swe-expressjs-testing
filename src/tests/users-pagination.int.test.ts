import { describe, it, expect, beforeEach, afterAll } from "@jest/globals";
import express from "express";
import { Server } from "http";

// User interface
interface User {
  id: number;
  name: string;
  email: string;
  createdAt: string; // JSON serialized date
}

interface PaginatedResponse {
  users: User[];
  totalCount: number;
  page: number;
  limit: number;
}

interface ErrorResponse {
  error: string;
}

// Create a test server instance
let server: Server;
let baseUrl: string;

// In-memory database for testing
const testUsers: { [key: number]: User } = {};
let testNextId = 1;

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

// Create test Express app with the same structure as main app
const createTestApp = () => {
  const app = express();
  app.use(express.json());

  // GET /users - Get all users with pagination
  app.get("/users", (req, res): void => {
    // Parse query parameters with defaults
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    // Validate pagination parameters
    if (page < 1) {
      return res.status(400).json({ error: "Page must be greater than 0" });
    }

    if (limit < 1 || limit > 100) {
      return res.status(400).json({ error: "Limit must be between 1 and 100" });
    }

    // Convert users object to array
    const userList = Object.values(testUsers);
    const totalCount = userList.length;

    // Calculate pagination
    const offset = (page - 1) * limit;
    const paginatedUsers = userList.slice(offset, offset + limit);

    // Return paginated response
    return res.json({
      users: paginatedUsers,
      totalCount,
      page,
      limit,
    });
  });

  // POST /users - Create new user (for test data setup)
  app.post("/users", (req, res): void => {
    const { isValid, errors } = validateUserData(req.body);

    if (!isValid) {
      return res
        .status(400)
        .json({ error: "Validation failed", details: errors });
    }

    const newUser: User = {
      id: testNextId++,
      name: req.body.name.trim(),
      email: req.body.email.trim(),
      createdAt: new Date().toISOString(),
    };

    testUsers[newUser.id] = newUser;
    return res.status(201).json(newUser);
  });

  return app;
};

// Helper function to make HTTP requests
const makeRequest = async (path: string): Promise<Response> => {
  const response = await fetch(`${baseUrl}${path}`);
  return response;
};

// Helper function to create test users
const createTestUser = async (name: string, email: string): Promise<User> => {
  const response = await fetch(`${baseUrl}/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, email }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create user: ${response.statusText}`);
  }

  return (await response.json()) as User;
};

// Helper function to populate test users
const populateTestUsers = async (count: number): Promise<User[]> => {
  const users: User[] = [];
  for (let i = 1; i <= count; i++) {
    const user = await createTestUser(`User ${i}`, `user${i}@example.com`);
    users.push(user);
  }
  return users;
};

describe("Users Pagination Integration Tests", () => {
  beforeEach(async () => {
    // Clear test users before each test
    Object.keys(testUsers).forEach((key) => delete testUsers[parseInt(key)]);
    testNextId = 1;

    // Create and start test server
    const app = createTestApp();
    const port = 0; // Use random available port

    return new Promise<void>((resolve) => {
      server = app.listen(port, () => {
        const address = server.address();
        if (address && typeof address === "object") {
          baseUrl = `http://localhost:${address.port}`;
        }
        resolve();
      });
    });
  });

  afterAll(() => {
    if (server) {
      server.close();
    }
  });

  describe("Default Pagination Behavior", () => {
    it("should return default page=1 and limit=10 when no query parameters provided", async () => {
      await populateTestUsers(15);

      const response = await makeRequest("/users");
      expect(response.status).toBe(200);

      const data: PaginatedResponse =
        (await response.json()) as PaginatedResponse;
      expect(data.users).toHaveLength(10);
      expect(data.totalCount).toBe(15);
      expect(data.page).toBe(1);
      expect(data.limit).toBe(10);
      expect(data.users[0].name).toBe("User 1");
      expect(data.users[9].name).toBe("User 10");
    });

    it("should use default page=1 when only limit is provided", async () => {
      await populateTestUsers(8);

      const response = await makeRequest("/users?limit=5");
      expect(response.status).toBe(200);

      const data: PaginatedResponse =
        (await response.json()) as PaginatedResponse;
      expect(data.users).toHaveLength(5);
      expect(data.totalCount).toBe(8);
      expect(data.page).toBe(1);
      expect(data.limit).toBe(5);
      expect(data.users[0].name).toBe("User 1");
      expect(data.users[4].name).toBe("User 5");
    });

    it("should use default limit=10 when only page is provided", async () => {
      await populateTestUsers(25);

      const response = await makeRequest("/users?page=2");
      expect(response.status).toBe(200);

      const data: PaginatedResponse =
        (await response.json()) as PaginatedResponse;
      expect(data.users).toHaveLength(10);
      expect(data.totalCount).toBe(25);
      expect(data.page).toBe(2);
      expect(data.limit).toBe(10);
      expect(data.users[0].name).toBe("User 11");
      expect(data.users[9].name).toBe("User 20");
    });
  });

  describe("Various Page/Limit Combinations", () => {
    beforeEach(async () => {
      await populateTestUsers(50);
    });

    it("should return correct users for page=1&limit=5", async () => {
      const response = await makeRequest("/users?page=1&limit=5");
      expect(response.status).toBe(200);

      const data: PaginatedResponse =
        (await response.json()) as PaginatedResponse;
      expect(data.users).toHaveLength(5);
      expect(data.totalCount).toBe(50);
      expect(data.page).toBe(1);
      expect(data.limit).toBe(5);
      expect(data.users[0].id).toBe(1);
      expect(data.users[4].id).toBe(5);
    });

    it("should return correct users for page=3&limit=7", async () => {
      const response = await makeRequest("/users?page=3&limit=7");
      expect(response.status).toBe(200);

      const data: PaginatedResponse =
        (await response.json()) as PaginatedResponse;
      expect(data.users).toHaveLength(7);
      expect(data.totalCount).toBe(50);
      expect(data.page).toBe(3);
      expect(data.limit).toBe(7);
      expect(data.users[0].id).toBe(15); // (3-1) * 7 + 1 = 15
      expect(data.users[6].id).toBe(21);
    });

    it("should return partial results for last page", async () => {
      const response = await makeRequest("/users?page=8&limit=7");
      expect(response.status).toBe(200);

      const data: PaginatedResponse =
        (await response.json()) as PaginatedResponse;
      expect(data.users).toHaveLength(1); // 50 users, page 8 with limit 7 = users 50-56, but only 50 exists
      expect(data.totalCount).toBe(50);
      expect(data.page).toBe(8);
      expect(data.limit).toBe(7);
      expect(data.users[0].id).toBe(50);
    });

    it("should handle large limit values within bounds", async () => {
      const response = await makeRequest("/users?page=1&limit=100");
      expect(response.status).toBe(200);

      const data: PaginatedResponse =
        (await response.json()) as PaginatedResponse;
      expect(data.users).toHaveLength(50); // All 50 users
      expect(data.totalCount).toBe(50);
      expect(data.page).toBe(1);
      expect(data.limit).toBe(100);
    });
  });

  describe("Edge Cases", () => {
    it("should return empty array when no users exist", async () => {
      const response = await makeRequest("/users?page=1&limit=10");
      expect(response.status).toBe(200);

      const data: PaginatedResponse =
        (await response.json()) as PaginatedResponse;
      expect(data.users).toEqual([]);
      expect(data.totalCount).toBe(0);
      expect(data.page).toBe(1);
      expect(data.limit).toBe(10);
    });

    it("should return empty array when page exceeds available data", async () => {
      await populateTestUsers(5);

      const response = await makeRequest("/users?page=10&limit=10");
      expect(response.status).toBe(200);

      const data: PaginatedResponse =
        (await response.json()) as PaginatedResponse;
      expect(data.users).toEqual([]);
      expect(data.totalCount).toBe(5);
      expect(data.page).toBe(10);
      expect(data.limit).toBe(10);
    });

    it("should handle non-numeric parameters gracefully", async () => {
      await populateTestUsers(10);

      const response = await makeRequest("/users?page=invalid&limit=invalid");
      expect(response.status).toBe(200);

      const data: PaginatedResponse =
        (await response.json()) as PaginatedResponse;
      expect(data.page).toBe(1); // Default when parseInt returns NaN
      expect(data.limit).toBe(10); // Default when parseInt returns NaN
      expect(data.users).toHaveLength(10);
      expect(data.totalCount).toBe(10);
    });
  });

  describe("Error Handling", () => {
    it("should return 400 error for page less than 1", async () => {
      const response = await makeRequest("/users?page=0");
      expect(response.status).toBe(400);

      const data: ErrorResponse = (await response.json()) as ErrorResponse;
      expect(data.error).toBe("Page must be greater than 0");
    });

    it("should return 400 error for negative page", async () => {
      const response = await makeRequest("/users?page=-1");
      expect(response.status).toBe(400);

      const data: ErrorResponse = (await response.json()) as ErrorResponse;
      expect(data.error).toBe("Page must be greater than 0");
    });

    it("should return 400 error for limit less than 1", async () => {
      const response = await makeRequest("/users?limit=0");
      expect(response.status).toBe(400);

      const data: ErrorResponse = (await response.json()) as ErrorResponse;
      expect(data.error).toBe("Limit must be between 1 and 100");
    });

    it("should return 400 error for limit greater than 100", async () => {
      const response = await makeRequest("/users?limit=101");
      expect(response.status).toBe(400);

      const data: ErrorResponse = (await response.json()) as ErrorResponse;
      expect(data.error).toBe("Limit must be between 1 and 100");
    });
  });

  describe("Response Format and Headers", () => {
    it("should return correct Content-Type header", async () => {
      await populateTestUsers(5);

      const response = await makeRequest("/users");
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain(
        "application/json",
      );
    });

    it("should return response with correct structure and data types", async () => {
      await populateTestUsers(3);

      const response = await makeRequest("/users?page=1&limit=2");
      expect(response.status).toBe(200);

      const data: PaginatedResponse =
        (await response.json()) as PaginatedResponse;

      // Check response structure
      expect(data).toHaveProperty("users");
      expect(data).toHaveProperty("totalCount");
      expect(data).toHaveProperty("page");
      expect(data).toHaveProperty("limit");

      // Check types
      expect(Array.isArray(data.users)).toBe(true);
      expect(typeof data.totalCount).toBe("number");
      expect(typeof data.page).toBe("number");
      expect(typeof data.limit).toBe("number");

      // Check user object structure
      if (data.users.length > 0) {
        const user = data.users[0];
        expect(user).toHaveProperty("id");
        expect(user).toHaveProperty("name");
        expect(user).toHaveProperty("email");
        expect(user).toHaveProperty("createdAt");
        expect(typeof user.id).toBe("number");
        expect(typeof user.name).toBe("string");
        expect(typeof user.email).toBe("string");
        expect(typeof user.createdAt).toBe("string");
      }
    });

    it("should maintain consistent response format even with empty results", async () => {
      const response = await makeRequest("/users?page=1&limit=10");
      expect(response.status).toBe(200);

      const data: PaginatedResponse =
        (await response.json()) as PaginatedResponse;
      expect(data).toEqual({
        users: [],
        totalCount: 0,
        page: 1,
        limit: 10,
      });
    });
  });
});
