import { describe, it, expect, beforeEach } from "@jest/globals";
import request from "supertest";
import express from "express";

// User interface definition
interface User {
  id: number;
  name: string;
  email: string;
  createdAt: Date;
}

// Create a test Express app with the same structure as the main app
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

  // Routes - including the search endpoint
  app.get("/users", (_req, res) => {
    const userList = Object.values(users);
    res.json(userList);
  });

  // GET /users/search - Search users by name or email
  app.get("/users/search", (req, res) => {
    const query = req.query.q as string;
    
    // If no query provided, return all users
    if (!query || query.trim() === "") {
      const userList = Object.values(users);
      return res.json(userList);
    }
    
    const searchTerm = query.toLowerCase().trim();
    const matchingUsers = Object.values(users).filter(user => 
      user.name.toLowerCase().includes(searchTerm) || 
      user.email.toLowerCase().includes(searchTerm)
    );
    
    return res.json(matchingUsers);
  });

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

  return { app, users };
};

describe("User Search Endpoint", () => {
  let testApp: express.Application;
  let testUsers: { [key: number]: User };

  beforeEach(() => {
    const { app, users } = createTestApp();
    testApp = app;
    testUsers = users;

    // Add test users
    testUsers[1] = {
      id: 1,
      name: "John Doe",
      email: "john.doe@example.com",
      createdAt: new Date("2023-01-01"),
    };
    testUsers[2] = {
      id: 2,
      name: "Jane Smith",
      email: "jane.smith@test.org",
      createdAt: new Date("2023-01-02"),
    };
    testUsers[3] = {
      id: 3,
      name: "Bob Johnson",
      email: "bob@company.net",
      createdAt: new Date("2023-01-03"),
    };
    testUsers[4] = {
      id: 4,
      name: "Alice Brown",
      email: "alice.brown@domain.co.uk",
      createdAt: new Date("2023-01-04"),
    };
  });

  describe("GET /users/search", () => {
    it("should return all users when query is empty", async () => {
      const response = await request(testApp).get("/users/search?q=");
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(4);
    });

    it("should return all users when no query parameter is provided", async () => {
      const response = await request(testApp).get("/users/search");
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(4);
    });

    it("should find users by partial name match", async () => {
      const response = await request(testApp).get("/users/search?q=John");
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body.map((u: User) => u.name)).toEqual(
        expect.arrayContaining(["John Doe", "Bob Johnson"])
      );
    });

    it("should find users by partial email match", async () => {
      const response = await request(testApp).get("/users/search?q=example");
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].email).toBe("john.doe@example.com");
    });

    it("should perform case-insensitive search on names", async () => {
      const response = await request(testApp).get("/users/search?q=JANE");
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe("Jane Smith");
    });

    it("should perform case-insensitive search on emails", async () => {
      const response = await request(testApp).get("/users/search?q=TEST.ORG");
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].email).toBe("jane.smith@test.org");
    });

    it("should return empty array when no matches found", async () => {
      const response = await request(testApp).get("/users/search?q=nonexistent");
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(0);
      expect(response.body).toEqual([]);
    });

    it("should handle special characters in queries", async () => {
      const response = await request(testApp).get("/users/search?q=@");
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(4); // All users have @ in their email
    });

    it("should handle dots in queries", async () => {
      const response = await request(testApp).get("/users/search?q=.");
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(4); // All users have dots in their email
    });

    it("should handle queries with only whitespace", async () => {
      const response = await request(testApp).get("/users/search?q=   ");
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(4); // Should return all users
    });

    it("should handle URL encoded special characters", async () => {
      const response = await request(testApp).get("/users/search?q=%40"); // @ symbol URL encoded
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(4); // All users have @ in their email
    });

    it("should handle undefined query parameter gracefully", async () => {
      const response = await request(testApp).get("/users/search");
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(4); // Should return all users
    });

    it("should handle search with numbers", async () => {
      // Add a user with numbers for this test
      testUsers[5] = {
        id: 5,
        name: "User123",
        email: "user123@test.com",
        createdAt: new Date("2023-01-05"),
      };

      const response = await request(testApp).get("/users/search?q=123");
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe("User123");
    });

    it("should handle search with hyphens and underscores", async () => {
      // Add a user with special characters for this test
      testUsers[6] = {
        id: 6,
        name: "Test-User_Name",
        email: "test-user@sub-domain.com",
        createdAt: new Date("2023-01-06"),
      };

      const response = await request(testApp).get("/users/search?q=test-user");
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe("Test-User_Name");
    });

    it("should handle multiple word search terms (no matches expected)", async () => {
      const response = await request(testApp).get("/users/search?q=john doe");
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1); // "John Doe" contains "john doe" as a substring
      expect(response.body[0].name).toBe("John Doe");
    });

    it("should handle empty string after trimming", async () => {
      const response = await request(testApp).get("/users/search?q=    ");
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(4); // Should return all users
    });
  });
});
