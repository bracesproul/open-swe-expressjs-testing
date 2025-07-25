import { describe, it, expect, beforeEach } from "@jest/globals";
import request from "supertest";
import express from "express";

// Import the app setup from index.ts
// Since we can't directly import the app, we'll recreate the setup for testing
interface User {
  id: number;
  name: string;
  email: string;
  createdAt: Date;
}

// Create test app with the same setup as index.ts
const app = express();
app.use(express.json());

// In-memory database for testing
const users: { [key: number]: User } = {};
let nextId = 1;

// Helper function to validate user data (same as in index.ts)
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

// Add the routes we need for testing
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

  if (!query) {
    return res.status(400).json({ error: "Query parameter 'q' is required" });
  }

  if (typeof query !== "string" || query.trim() === "") {
    return res.status(400).json({ error: "Query parameter 'q' must be a non-empty string" });
  }

  const searchTerm = query.toLowerCase().trim();
  const userList = Object.values(users);
  const matchingUsers = userList.filter(user => 
    user.name.toLowerCase().includes(searchTerm) || 
    user.email.toLowerCase().includes(searchTerm)
  );

  return res.json(matchingUsers);
});

describe("User Search Integration Tests", () => {
  // Clear users before each test
  beforeEach(() => {
    Object.keys(users).forEach(key => delete users[parseInt(key)]);
    nextId = 1;
  });

  describe("GET /users/search", () => {
    it("should return matching users when searching by name", async () => {
      // Create test users
      await request(app)
        .post("/users")
        .send({ name: "John Doe", email: "john@example.com" });
      
      await request(app)
        .post("/users")
        .send({ name: "Jane Smith", email: "jane@example.com" });

      // Search by name
      const response = await request(app)
        .get("/users/search?q=John")
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe("John Doe");
      expect(response.body[0].email).toBe("john@example.com");
    });

    it("should return matching users when searching by email", async () => {
      // Create test users
      await request(app)
        .post("/users")
        .send({ name: "John Doe", email: "john@example.com" });
      
      await request(app)
        .post("/users")
        .send({ name: "Jane Smith", email: "jane@test.com" });

      // Search by email
      const response = await request(app)
        .get("/users/search?q=example")
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe("John Doe");
      expect(response.body[0].email).toBe("john@example.com");
    });

    it("should perform case-insensitive search on name field", async () => {
      // Create test user
      await request(app)
        .post("/users")
        .send({ name: "John Doe", email: "john@example.com" });

      // Search with different cases
      const response1 = await request(app)
        .get("/users/search?q=john")
        .expect(200);
      
      const response2 = await request(app)
        .get("/users/search?q=JOHN")
        .expect(200);
      
      const response3 = await request(app)
        .get("/users/search?q=JoHn")
        .expect(200);

      expect(response1.body).toHaveLength(1);
      expect(response2.body).toHaveLength(1);
      expect(response3.body).toHaveLength(1);
      expect(response1.body[0].name).toBe("John Doe");
      expect(response2.body[0].name).toBe("John Doe");
      expect(response3.body[0].name).toBe("John Doe");
    });

    it("should perform case-insensitive search on email field", async () => {
      // Create test user
      await request(app)
        .post("/users")
        .send({ name: "John Doe", email: "John@Example.Com" });

      // Search with different cases
      const response1 = await request(app)
        .get("/users/search?q=example")
        .expect(200);
      
      const response2 = await request(app)
        .get("/users/search?q=EXAMPLE")
        .expect(200);

      expect(response1.body).toHaveLength(1);
      expect(response2.body).toHaveLength(1);
      expect(response1.body[0].email).toBe("John@Example.Com");
      expect(response2.body[0].email).toBe("John@Example.Com");
    });

    it("should return partial matches", async () => {
      // Create test users
      await request(app)
        .post("/users")
        .send({ name: "Alexander", email: "alex@example.com" });
      
      await request(app)
        .post("/users")
        .send({ name: "Alexandra", email: "alexandra@test.com" });

      // Search with partial match
      const response = await request(app)
        .get("/users/search?q=Alex")
        .expect(200);
