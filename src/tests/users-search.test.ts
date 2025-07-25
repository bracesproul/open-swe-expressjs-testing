import { describe, it, expect, beforeEach } from "@jest/globals";
import request from "supertest";
import { app } from "../index.js";

describe("GET /users/search", () => {
  // Helper function to create test users
  const createTestUser = async (name: string, email: string) => {
    const response = await request(app)
      .post("/users")
      .send({ name, email });
    return response.body;
  };

  // Clean up users before each test by creating fresh users
  beforeEach(async () => {
    // Clear existing users by getting all users and deleting them
    const usersResponse = await request(app).get("/users");
    const users = usersResponse.body;
    
    for (const user of users) {
      await request(app).delete(`/users/${user.id}`);
    }
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
  });

  describe("No matches scenarios", () => {
    beforeEach(async () => {
      await createTestUser("John Doe", "john@example.com");
      await createTestUser("Jane Smith", "jane@example.com");
    });

    it("should return empty array when no users match the search query", async () => {
      const response = await request(app)
        .get("/users/search?q=nonexistent")
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it("should return empty array when search query doesn't match any name or email", async () => {
      const response = await request(app)
        .get("/users/search?q=xyz123")
        .expect(200);

      expect(response.body).toEqual([]);
    });
  });

  describe("Partial name matches", () => {
    beforeEach(async () => {
      await createTestUser("John Doe", "john@example.com");
      await createTestUser("Jane Smith", "jane@example.com");
      await createTestUser("Bob Johnson", "bob@example.com");
    });

    it("should return users with partial first name match", async () => {
      const response = await request(app)
        .get("/users/search?q=John")
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body.map((u: any) => u.name)).toContain("John Doe");
      expect(response.body.map((u: any) => u.name)).toContain("Bob Johnson");
    });

    it("should return users with partial last name match", async () => {
      const response = await request(app)
        .get("/users/search?q=Smith")
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe("Jane Smith");
    });

    it("should return users with partial name match (single character)", async () => {
      const response = await request(app)
        .get("/users/search?q=J")
        .expect(200);

      expect(response.body).toHaveLength(3);
      expect(response.body.map((u: any) => u.name)).toContain("John Doe");
      expect(response.body.map((u: any) => u.name)).toContain("Jane Smith");
      expect(response.body.map((u: any) => u.name)).toContain("Bob Johnson");
    });
  });

  describe("Partial email matches", () => {
    beforeEach(async () => {
      await createTestUser("Alice", "alice@gmail.com");
      await createTestUser("Bob", "bob@yahoo.com");
      await createTestUser("Charlie", "charlie@gmail.com");
    });

    it("should return users with partial email domain match", async () => {
      const response = await request(app)
        .get("/users/search?q=gmail")
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body.map((u: any) => u.name)).toContain("Alice");
      expect(response.body.map((u: any) => u.name)).toContain("Charlie");
    });

    it("should return users with partial email username match", async () => {
      const response = await request(app)
        .get("/users/search?q=alice")
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe("Alice");
    });

    it("should return users with @ symbol search", async () => {
      const response = await request(app)
        .get("/users/search?q=@yahoo")
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe("Bob");
    });
  });

  describe("Case-insensitive matching", () => {
    beforeEach(async () => {
      await createTestUser("John DOE", "JOHN@EXAMPLE.COM");
      await createTestUser("jane smith", "jane@example.com");
    });

    it("should match names case-insensitively (lowercase query)", async () => {
      const response = await request(app)
        .get("/users/search?q=john")
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe("John DOE");
    });

    it("should match names case-insensitively (uppercase query)", async () => {
      const response = await request(app)
        .get("/users/search?q=JANE")
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe("jane smith");
    });

    it("should match emails case-insensitively (mixed case query)", async () => {
      const response = await request(app)
        .get("/users/search?q=ExAmPlE")
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body.map((u: any) => u.name)).toContain("John DOE");
      expect(response.body.map((u: any) => u.name)).toContain("jane smith");
    });
  });

  describe("Special characters", () => {
    beforeEach(async () => {
      await createTestUser("O'Connor", "oconnor@test.com");
      await createTestUser("Smith-Jones", "smith.jones@test-domain.com");
      await createTestUser("User123", "user+tag@example.com");
    });

    it("should handle apostrophes in names", async () => {
      const response = await request(app)
        .get("/users/search?q=O'Connor")
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe("O'Connor");
    });

    it("should handle hyphens in names", async () => {
      const response = await request(app)
        .get("/users/search?q=Smith-Jones")
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe("Smith-Jones");
    });

    it("should handle numbers in names", async () => {
      const response = await request(app)
        .get("/users/search?q=123")
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe("User123");
    });

    it("should handle special characters in emails", async () => {
      const response = await request(app)
        .get("/users/search?q=user%2Btag")
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe("User123");
    });

    it("should handle dots in emails", async () => {
      const response = await request(app)
        .get("/users/search?q=smith.jones")
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe("Smith-Jones");
    });
  });

  describe("Multiple matching users", () => {
    beforeEach(async () => {
      await createTestUser("John Smith", "john.smith@company.com");
      await createTestUser("John Doe", "john.doe@company.com");
      await createTestUser("Jane Johnson", "jane@company.com");
      await createTestUser("Bob Smith", "bob@othercompany.com");
    });

    it("should return multiple users when they match the search query", async () => {
      const response = await request(app)
        .get("/users/search?q=John")
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body.map((u: any) => u.name)).toContain("John Smith");
      expect(response.body.map((u: any) => u.name)).toContain("John Doe");
    });

    it("should return multiple users with same last name", async () => {
      const response = await request(app)
        .get("/users/search?q=Smith")
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body.map((u: any) => u.name)).toContain("John Smith");
      expect(response.body.map((u: any) => u.name)).toContain("Bob Smith");
    });

    it("should return multiple users with same email domain", async () => {
      const response = await request(app)
        .get("/users/search?q=company.com")
        .expect(200);

      expect(response.body).toHaveLength(3);
      expect(response.body.map((u: any) => u.name)).toContain("John Smith");
      expect(response.body.map((u: any) => u.name)).toContain("John Doe");
      expect(response.body.map((u: any) => u.name)).toContain("Jane Johnson");
    });

    it("should return all users when search matches common pattern", async () => {
      const response = await request(app)
        .get("/users/search?q=@")
        .expect(200);

      expect(response.body).toHaveLength(4);
    });
  });

  describe("Response format validation", () => {
    beforeEach(async () => {
      await createTestUser("Test User", "test@example.com");
    });

    it("should return users with correct structure", async () => {
      const response = await request(app)
        .get("/users/search?q=Test")
        .expect(200);

      expect(response.body).toHaveLength(1);
      const user = response.body[0];
      
      expect(user).toHaveProperty("id");
      expect(user).toHaveProperty("name");
      expect(user).toHaveProperty("email");
      expect(user).toHaveProperty("createdAt");
      
      expect(typeof user.id).toBe("number");
      expect(typeof user.name).toBe("string");
      expect(typeof user.email).toBe("string");
      expect(typeof user.createdAt).toBe("string");
    });
  });
});

