import { describe, it, expect, beforeEach, afterAll } from "@jest/globals";
import request from "supertest";
import express from "express";

// Import the User interface and create a test app
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

  // Routes
  app.get("/", (_req, res) => {
    res.json({ message: "Welcome to the API" });
  });

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

  app.get("/users/:id", (req, res) => {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const user = users[id];
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json(user);
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
      expect(response.body).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: "John Doe" }),
        expect.objectContaining({ name: "Jane Smith" }),
        expect.objectContaining({ name: "Bob Johnson" }),
        expect.objectContaining({ name: "Alice Brown" }),
      ]));
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
      expect(response.body).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: "John Doe" }),
        expect.objectContaining({ name: "Bob Johnson" }),
      ]));
    });

    it("should find users by partial email match", async () => {
      const response = await request(testApp).get("/users/search?q=example");
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toEqual(expect.objectContaining({
        name: "John Doe",
        email: "john.doe@example.com",
      }));
    });

    it("should perform case-insensitive search on names", async () => {
      const response = await request(testApp).get("/users/search?q=JANE");
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toEqual(expect.objectContaining({
        name: "Jane Smith",
      }));
    });

    it("should perform case-insensitive search on emails", async () => {
      const response = await request(testApp).get("/users/search?q=TEST.ORG");
      
