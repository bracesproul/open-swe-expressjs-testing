import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import request from "supertest";
import { app } from "../index.js";

describe("GET /users/search", () => {
  // Test users data for consistent testing
  const testUsers = [
    { name: "John Doe", email: "john.doe@example.com" },
    { name: "Jane Smith", email: "jane.smith@gmail.com" },
    { name: "Bob Johnson", email: "bob@company.org" },
    { name: "Alice Brown", email: "alice.brown@test.com" },
    { name: "Charlie Wilson", email: "charlie@example.net" },
  ];

  let createdUserIds: number[] = [];

  beforeEach(async () => {
    // Create test users before each test
    createdUserIds = [];
    for (const userData of testUsers) {
      const response = await request(app)
        .post("/users")
        .send(userData)
        .expect(201);
      createdUserIds.push(response.body.id);
    }
  });

  afterEach(async () => {
    // Clean up created users after each test
    for (const userId of createdUserIds) {
      await request(app).delete(`/users/${userId}`);
    }
    createdUserIds = [];
  });

  describe("Empty query scenarios", () => {
    it("should return empty array when no query parameter is provided", async () => {
      const response = await request(app)
        .get("/users/search")
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it("should return empty array when query parameter is empty string", async () => {
      const response = await request(app)
        .get("/users/search?q=")
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it("should return empty array when query parameter is only whitespace", async () => {
      const response = await request(app)
        .get("/users/search?q=   ")
        .expect(200);

      expect(response.body).toEqual([]);
    });
  });

  describe("No matches scenarios", () => {
    it("should return empty array when no users match the search query", async () => {
      const response = await request(app)
        .get("/users/search?q=nonexistent")
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it("should return empty array when searching for non-matching email domain", async () => {
      const response = await request(app)
        .get("/users/search?q=@nonexistent.com")
        .expect(200);

      expect(response.body).toEqual([]);
    });
  });

  describe("Single match scenarios", () => {
    it("should return single user when searching by exact name", async () => {
      const response = await request(app)
        .get("/users/search?q=John Doe")
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe("John Doe");
      expect(response.body[0].email).toBe("john.doe@example.com");
    });

    it("should return single user when searching by exact email", async () => {
      const response = await request(app)
        .get("/users/search?q=jane.smith@gmail.com")
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe("Jane Smith");
      expect(response.body[0].email).toBe("jane.smith@gmail.com");
    });

    it("should return single user when searching by unique partial name", async () => {
      const response = await request(app)
        .get("/users/search?q=Charlie")
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe("Charlie Wilson");
    });
  });

  describe("Multiple matches scenarios", () => {
    it("should return multiple users when searching by common name part", async () => {
      const response = await request(app)
        .get("/users/search?q=John")
        .expect(200);

      expect(response.body.length).toBeGreaterThan(1);
      const names = response.body.map((user: any) => user.name);
      expect(names).toContain("John Doe");
      expect(names).toContain("Bob Johnson");
    });

    it("should return multiple users when searching by common email domain", async () => {
      const response = await request(app)
        .get("/users/search?q=example")
        .expect(200);

      expect(response.body.length).toBeGreaterThan(1);
      const emails = response.body.map((user: any) => user.email);
      expect(emails).toContain("john.doe@example.com");
      expect(emails).toContain("charlie@example.net");
    });
  });

  describe("Case-insensitive matching", () => {
    it("should match users regardless of query case for names", async () => {
      const response = await request(app)
        .get("/users/search?q=ALICE")
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe("Alice Brown");
    });

    it("should match users regardless of query case for emails", async () => {
      const response = await request(app)
        .get("/users/search?q=BOB@COMPANY.ORG")
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].email).toBe("bob@company.org");
    });

    it("should match users with mixed case query", async () => {
      const response = await request(app)
        .get("/users/search?q=JaNe")
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe("Jane Smith");
    });
  });

  describe("Partial string matching", () => {
    it("should match users by partial name", async () => {
      const response = await request(app)
        .get("/users/search?q=Smi")
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe("Jane Smith");
    });

    it("should match users by partial email", async () => {
      const response = await request(app)
        .get("/users/search?q=gmail")
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].email).toBe("jane.smith@gmail.com");
    });

    it("should match users by email local part", async () => {
      const response = await request(app)
        .get("/users/search?q=alice.brown")
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe("Alice Brown");
    });
  });

  describe("Edge cases with special characters", () => {
    it("should handle search queries with dots", async () => {
      const response = await request(app)
        .get("/users/search?q=john.doe")
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].email).toBe("john.doe@example.com");
    });

    it("should handle search queries with @ symbol", async () => {
      const response = await request(app)
        .get("/users/search?q=@test.com")
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].email).toBe("alice.brown@test.com");
    });

    it("should handle search queries with spaces", async () => {
      const response = await request(app)
        .get("/users/search?q=Bob Johnson")
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe("Bob Johnson");
    });

    it("should handle URL encoded special characters", async () => {
      const response = await request(app)
        .get("/users/search?q=alice%40test")
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].email).toBe("alice.brown@test.com");
    });
  });
});
