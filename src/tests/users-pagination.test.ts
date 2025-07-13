import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { app } from "../index.js";
import { Server } from "http";

describe("Users Pagination API", () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    // Start server on a random port for testing
    server = app.listen(0);
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 3000;
    baseUrl = `http://localhost:${port}`;

    // Add some test users for pagination testing
    const testUsers = [
      { name: "User 1", email: "user1@example.com" },
      { name: "User 2", email: "user2@example.com" },
      { name: "User 3", email: "user3@example.com" },
      { name: "User 4", email: "user4@example.com" },
      { name: "User 5", email: "user5@example.com" },
      { name: "User 6", email: "user6@example.com" },
      { name: "User 7", email: "user7@example.com" },
      { name: "User 8", email: "user8@example.com" },
      { name: "User 9", email: "user9@example.com" },
      { name: "User 10", email: "user10@example.com" },
      { name: "User 11", email: "user11@example.com" },
      { name: "User 12", email: "user12@example.com" },
      { name: "User 13", email: "user13@example.com" },
      { name: "User 14", email: "user14@example.com" },
      { name: "User 15", email: "user15@example.com" },
    ];

    // Create test users
    for (const userData of testUsers) {
      await fetch(`${baseUrl}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userData),
      });
    }
  });

  afterEach(async () => {
    // Clean up server
    if (server) {
      server.close();
    }
  });

  describe("Default Pagination Behavior", () => {
    it("should return first 10 users with default pagination when no parameters provided", async () => {
      const response = await fetch(`${baseUrl}/users`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("users");
      expect(data).toHaveProperty("totalCount");
      expect(data).toHaveProperty("page");
      expect(data).toHaveProperty("limit");
      
      expect(data.users).toHaveLength(10);
      expect(data.totalCount).toBe(15);
      expect(data.page).toBe(1);
      expect(data.limit).toBe(10);
      
      // Verify users are returned in order
      expect(data.users[0].name).toBe("User 1");
      expect(data.users[9].name).toBe("User 10");
    });

    it("should return correct structure for paginated response", async () => {
      const response = await fetch(`${baseUrl}/users`);
      const data = await response.json();

      expect(data).toEqual({
        users: expect.any(Array),
        totalCount: expect.any(Number),
        page: expect.any(Number),
        limit: expect.any(Number),
      });

      // Verify each user has correct structure
      data.users.forEach((user: any) => {
        expect(user).toHaveProperty("id");
        expect(user).toHaveProperty("name");
        expect(user).toHaveProperty("email");
        expect(user).toHaveProperty("createdAt");
      });
    });
  });

  describe("Custom Page and Limit Parameters", () => {
    it("should return second page with default limit", async () => {
      const response = await fetch(`${baseUrl}/users?page=2`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.users).toHaveLength(5); // Remaining users on page 2
      expect(data.totalCount).toBe(15);
      expect(data.page).toBe(2);
      expect(data.limit).toBe(10);
      
      // Verify correct users are returned
      expect(data.users[0].name).toBe("User 11");
      expect(data.users[4].name).toBe("User 15");
    });

    it("should return first page with custom limit", async () => {
      const response = await fetch(`${baseUrl}/users?limit=5`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.users).toHaveLength(5);
      expect(data.totalCount).toBe(15);
      expect(data.page).toBe(1);
      expect(data.limit).toBe(5);
      
      // Verify correct users are returned
      expect(data.users[0].name).toBe("User 1");
      expect(data.users[4].name).toBe("User 5");
    });

    it("should return correct page with custom page and limit", async () => {
      const response = await fetch(`${baseUrl}/users?page=3&limit=5`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.users).toHaveLength(5);
      expect(data.totalCount).toBe(15);
      expect(data.page).toBe(3);
      expect(data.limit).toBe(5);
      
      // Verify correct users are returned (users 11-15)
      expect(data.users[0].name).toBe("User 11");
      expect(data.users[4].name).toBe("User 15");
    });

    it("should handle large limit values", async () => {
      const response = await fetch(`${baseUrl}/users?limit=100`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.users).toHaveLength(15); // All available users
      expect(data.totalCount).toBe(15);
      expect(data.page).toBe(1);
      expect(data.limit).toBe(100);
    });
  });

  describe("Edge Cases - Invalid Parameters", () => {
    it("should return 400 error for invalid page parameter (non-numeric)", async () => {
      const response = await fetch(`${baseUrl}/users?page=invalid`);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty("error");
      expect(data.error).toBe("Invalid page parameter. Must be a positive integer.");
    });

    it("should return 400 error for invalid page parameter (zero)", async () => {
      const response = await fetch(`${baseUrl}/users?page=0`);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty("error");
      expect(data.error).toBe("Invalid page parameter. Must be a positive integer.");
    });

    it("should return 400 error for invalid page parameter (negative)", async () => {
      const response = await fetch(`${baseUrl}/users?page=-1`);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty("error");
      expect(data.error).toBe("Invalid page parameter. Must be a positive integer.");
    });

    it("should return 400 error for invalid limit parameter (non-numeric)", async () => {
      const response = await fetch(`${baseUrl}/users?limit=invalid`);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty("error");
      expect(data.error).toBe("Invalid limit parameter. Must be a positive integer.");
    });

    it("should return 400 error for invalid limit parameter (zero)", async () => {
      const response = await fetch(`${baseUrl}/users?limit=0`);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty("error");
      expect(data.error).toBe("Invalid limit parameter. Must be a positive integer.");
    });

    it("should return 400 error for invalid limit parameter (negative)", async () => {
      const response = await fetch(`${baseUrl}/users?limit=-5`);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty("error");
      expect(data.error).toBe("Invalid limit parameter. Must be a positive integer.");
    });

    it("should return 400 error for both invalid parameters", async () => {
      const response = await fetch(`${baseUrl}/users?page=invalid&limit=invalid`);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty("error");
      // Should return error for page parameter first (as it's validated first)
      expect(data.error).toBe("Invalid page parameter. Must be a positive integer.");
    });

    it("should handle decimal values by truncating to integer", async () => {
      const response = await fetch(`${baseUrl}/users?page=1.5&limit=5.9`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.page).toBe(1); // parseInt truncates 1.5 to 1
      expect(data.limit).toBe(5); // parseInt truncates 5.9 to 5
      expect(data.users).toHaveLength(5);
    });
  });

  describe("Out-of-bounds Pages", () => {
    it("should return empty results for page beyond available data", async () => {
      const response = await fetch(`${baseUrl}/users?page=10&limit=10`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.users).toHaveLength(0);
      expect(data.totalCount).toBe(15);
      expect(data.page).toBe(10);
      expect(data.limit).toBe(10);
    });

    it("should return partial results for last page", async () => {
      const response = await fetch(`${baseUrl}/users?page=4&limit=5`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.users).toHaveLength(0); // Page 4 with limit 5 is beyond available data
      expect(data.totalCount).toBe(15);
      expect(data.page).toBe(4);
      expect(data.limit).toBe(5);
    });

    it("should handle very high page numbers", async () => {
      const response = await fetch(`${baseUrl}/users?page=1000`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.users).toHaveLength(0);
      expect(data.totalCount).toBe(15);
      expect(data.page).toBe(1000);
      expect(data.limit).toBe(10);
    });
  });

  describe("Empty Results", () => {
    it("should handle empty user database", async () => {
      // Clear all users first by making DELETE requests
      const getUsersResponse = await fetch(`${baseUrl}/users`);
      const usersData = await getUsersResponse.json();
      
      // Delete all users
      for (const user of usersData.users) {
        await fetch(`${baseUrl}/users/${user.id}`, { method: "DELETE" });
      }

      const response = await fetch(`${baseUrl}/users`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.users).toHaveLength(0);
      expect(data.totalCount).toBe(0);
      expect(data.page).toBe(1);
      expect(data.limit).toBe(10);
    });

    it("should handle empty results with custom pagination parameters", async () => {
      // Clear all users first
      const getUsersResponse = await fetch(`${baseUrl}/users`);
      const usersData = await getUsersResponse.json();
      
      for (const user of usersData.users) {
        await fetch(`${baseUrl}/users/${user.id}`, { method: "DELETE" });
      }

      const response = await fetch(`${baseUrl}/users?page=2&limit=5`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.users).toHaveLength(0);
      expect(data.totalCount).toBe(0);
      expect(data.page).toBe(2);
      expect(data.limit).toBe(5);
    });
  });
});

