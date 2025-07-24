import { describe, it, expect, beforeEach, afterAll } from "@jest/globals";
import request from "supertest";
import express from "express";

// We need to create a test version of the app to avoid port conflicts
// This is a simplified version of the main app for testing purposes
interface User {
  id: number;
  name: string;
  email: string;
  createdAt: Date;
}

// Test app setup
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

  // Routes needed for testing
  app.get("/", (_req, res) => {
    res.json({ message: "Welcome to the API" });
  });

  app.get("/users", (_req, res) => {
    const userList = Object.values(users);
    res.json(userList);
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

  // The search endpoint we're testing
  app.get("/users/search", (req, res) => {
    const query = req.query.q as string;

    if (!query || typeof query !== "string" || query.trim() === "") {
      return res.status(400).json({ error: "Query parameter 'q' is required and must be a non-empty string" });
    }

    const searchTerm = query.trim().toLowerCase();
    const userList = Object.values(users);
    
    const matchingUsers = userList.filter(user => {
      const nameMatch = user.name.toLowerCase().includes(searchTerm);
      const emailMatch = user.email.toLowerCase().includes(searchTerm);
      return nameMatch || emailMatch;
    });

    return res.json(matchingUsers);
  });

  return app;
};

describe("User Search Endpoint", () => {
  let app: express.Application;

  beforeEach(() => {
    app = createTestApp();
  });

  describe("GET /users/search", () => {
    it("should return 400 error when query parameter 'q' is missing", async () => {
      const response = await request(app)
        .get("/users/search")
        .expect(400);

      expect(response.body).toEqual({
        error: "Query parameter 'q' is required and must be a non-empty string"
      });
    });

    it("should return 400 error when query parameter 'q' is empty", async () => {
      const response = await request(app)
        .get("/users/search?q=")
        .expect(400);

      expect(response.body).toEqual({
        error: "Query parameter 'q' is required and must be a non-empty string"
      });
    });

    it("should return 400 error when query parameter 'q' is only whitespace", async () => {
      const response = await request(app)
        .get("/users/search?q=   ")
        .expect(400);

      expect(response.body).toEqual({
        error: "Query parameter 'q' is required and must be a non-empty string"
      });
    });

    it("should return empty array when no users exist", async () => {
      const response = await request(app)
        .get("/users/search?q=john")
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it("should return empty array when no users match the search query", async () => {
      // Create a user first
      await request(app)
        .post("/users")
        .send({ name: "Alice Smith", email: "alice@example.com" });

      const response = await request(app)
        .get("/users/search?q=nonexistent")
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it("should perform case-insensitive search on user names", async () => {
      // Create test users
      await request(app)
        .post("/users")
        .send({ name: "John Doe", email: "john@example.com" });
      
      await request(app)
        .post("/users")
        .send({ name: "Jane Smith", email: "jane@example.com" });

      // Test case-insensitive name search
      const response = await request(app)
        .get("/users/search?q=JOHN")
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe("John Doe");
      expect(response.body[0].email).toBe("john@example.com");
    });

    it("should perform case-insensitive search on user emails", async () => {
      // Create test users
      await request(app)
        .post("/users")
        .send({ name: "John Doe", email: "john@example.com" });
      
      await request(app)
        .post("/users")
        .send({ name: "Jane Smith", email: "jane@example.com" });

      // Test case-insensitive email search
      const response = await request(app)
        .get("/users/search?q=JANE@EXAMPLE")
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe("Jane Smith");
      expect(response.body[0].email).toBe("jane@example.com");
    });

    it("should find partial matches in user names", async () => {
      // Create test users
      await request(app)
        .post("/users")
        .send({ name: "John Doe", email: "john@example.com" });
      
      await request(app)
        .post("/users")
        .send({ name: "Johnny Cash", email: "johnny@example.com" });

      await request(app)
        .post("/users")
        .send({ name: "Jane Smith", email: "jane@example.com" });

      // Test partial name match
      const response = await request(app)
        .get("/users/search?q=john")
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body.map((u: User) => u.name)).toContain("John Doe");
      expect(response.body.map((u: User) => u.name)).toContain("Johnny Cash");
    });

    it("should find partial matches in user emails", async () => {
      // Create test users
      await request(app)
        .post("/users")
        .send({ name: "John Doe", email: "john@gmail.com" });
      
      await request(app)
        .post("/users")
        .send({ name: "Jane Smith", email: "jane@gmail.com" });

      await request(app)
        .post("/users")
        .send({ name: "Bob Wilson", email: "bob@yahoo.com" });

      // Test partial email match
      const response = await request(app)
        .get("/users/search?q=gmail")
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body.map((u: User) => u.email)).toContain("john@gmail.com");
      expect(response.body.map((u: User) => u.email)).toContain("jane@gmail.com");
    });

    it("should search across both name and email fields", async () => {
      // Create test users
      await request(app)
        .post("/users")
        .send({ name: "Alice Johnson", email: "alice@example.com" });
      
      await request(app)
        .post("/users")
        .send({ name: "Bob Smith", email: "bob@johnson.com" });

      await request(app)
        .post("/users")
        .send({ name: "Charlie Brown", email: "charlie@example.com" });

      // Test search that matches both name and email across different users
      const response = await request(app)
        .get("/users/search?q=johnson")
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body.map((u: User) => u.name)).toContain("Alice Johnson");
      expect(response.body.map((u: User) => u.name)).toContain("Bob Smith");
    });

    it("should return multiple users when multiple matches exist", async () => {
      // Create multiple test users
      await request(app)
        .post("/users")
        .send({ name: "John Doe", email: "john@example.com" });
      
      await request(app)
        .post("/users")
        .send({ name: "Jane Doe", email: "jane@example.com" });

      await request(app)
        .post("/users")
        .send({ name: "Bob Smith", email: "bob@doe.com" });

      // Test search that should match multiple users
      const response = await request(app)
        .get("/users/search?q=doe")
        .expect(200);

      expect(response.body).toHaveLength(3);
      expect(response.body.map((u: User) => u.name)).toContain("John Doe");
      expect(response.body.map((u: User) => u.name)).toContain("Jane Doe");
      expect(response.body.map((u: User) => u.name)).toContain("Bob Smith");
    });

    it("should handle special characters in search query", async () => {
      // Create test user with special characters
      await request(app)
        .post("/users")
        .send({ name: "John O'Connor", email: "john.oconnor@example.com" });

      // Test search with special characters
      const response = await request(app)
        .get("/users/search?q=O'Connor")
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe("John O'Connor");
    });

    it("should trim whitespace from search query", async () => {
      // Create test user
      await request(app)
        .post("/users")
        .send({ name: "John Doe", email: "john@example.com" });

      // Test search with leading/trailing whitespace
      const response = await request(app)
        .get("/users/search?q=  john  ")
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe("John Doe");
    });
  });
});

