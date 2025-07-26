import { describe, it, expect, beforeEach } from "@jest/globals";
import request from "supertest";
import app from "../index.js";

describe("GET /users/search", () => {
  // Test users data
  const testUsers = [
    { name: "John Doe", email: "john.doe@example.com" },
    { name: "Jane Smith", email: "jane.smith@gmail.com" },
    { name: "Bob Johnson", email: "bob@company.org" },
    { name: "Alice Brown", email: "alice.brown@test.com" },
    { name: "Charlie Wilson", email: "charlie@example.net" },
    { name: "Diana Prince", email: "diana.prince@wonder.com" },
  ];

  let createdUserIds: number[] = [];

  beforeEach(async () => {
    // Clean up any existing users by getting all users and deleting them
    const getUsersResponse = await request(app).get("/users");
    const existingUsers = getUsersResponse.body;
    
    for (const user of existingUsers) {
      await request(app).delete(`/users/${user.id}`);
    }

    // Create test users
    createdUserIds = [];
    for (const userData of testUsers) {
      const response = await request(app)
        .post("/users")
        .send(userData)
        .expect(201);
      createdUserIds.push(response.body.id);
    }
  });

  describe("Empty query scenarios", () => {
    it("should return empty array when query parameter is missing", async () => {
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
    it("should return empty array when no users match the query", async () => {
      const response = await request(app)
        .get("/users/search?q=nonexistent")
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it("should return empty array when query doesn't match any name or email", async () => {
      const response = await request(app)
        .get("/users/search?q=xyz123")
        .expect(200);

      expect(response.body).toEqual([]);
    });
  });

  describe("Partial name matches", () => {
    it("should find users by partial first name match", async () => {
      const response = await request(app)
        .get("/users/search?q=John")
        .expect(200);

      expect(response.body).toHaveLength(2);
      const names = response.body.map((user: any) => user.name);
      expect(names).toContain("John Doe");
      expect(names).toContain("Bob Johnson");
    });

    it("should find users by partial last name match", async () => {
      const response = await request(app)
        .get("/users/search?q=Brown")
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe("Alice Brown");
    });

    it("should find users by partial name substring", async () => {
      const response = await request(app)
        .get("/users/search?q=an")
        .expect(200);

      expect(response.body).toHaveLength(2);
      const names = response.body.map((user: any) => user.name);
      expect(names).toContain("Jane Smith");
      expect(names).toContain("Diana Prince");
    });
  });

  describe("Partial email matches", () => {
    it("should find users by email domain", async () => {
      const response = await request(app)
        .get("/users/search?q=example.com")
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].email).toBe("john.doe@example.com");
    });

    it("should find users by email username", async () => {
      const response = await request(app)
        .get("/users/search?q=jane.smith")
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].email).toBe("jane.smith@gmail.com");
    });

    it("should find users by partial email substring", async () => {
      const response = await request(app)
        .get("/users/search?q=gmail")
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].email).toBe("jane.smith@gmail.com");
    });
  });

  describe("Case-insensitive matching", () => {
    it("should find users with uppercase query matching lowercase name", async () => {
      const response = await request(app)
        .get("/users/search?q=JOHN")
        .expect(200);

      expect(response.body).toHaveLength(2);
      const names = response.body.map((user: any) => user.name);
      expect(names).toContain("John Doe");
      expect(names).toContain("Bob Johnson");
    });

    it("should find users with lowercase query matching mixed case name", async () => {
      const response = await request(app)
        .get("/users/search?q=alice")
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe("Alice Brown");
    });

    it("should find users with mixed case query", async () => {
      const response = await request(app)
        .get("/users/search?q=ChArLiE")
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe("Charlie Wilson");
    });
  });

  describe("Special characters", () => {
    it("should handle queries with dots (email matching)", async () => {
      const response = await request(app)
        .get("/users/search?q=john.doe")
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].email).toBe("john.doe@example.com");
    });

    it("should handle queries with @ symbol", async () => {
      const response = await request(app)
        .get("/users/search?q=@company")
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].email).toBe("bob@company.org");
    });
  });

  describe("Multiple matches", () => {
    it("should return multiple users when query matches multiple names", async () => {
      const response = await request(app)
        .get("/users/search?q=o")
        .expect(200);

      expect(response.body.length).toBeGreaterThan(1);
      // Should match users with 'o' in name or email
    });
  });
});

