// This file contains integration tests for pagination functionality.
import { describe, it, expect, beforeEach } from "@jest/globals";

interface User {
  id: number;
  name: string;
  email: string;
  createdAt: string;
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

describe("GET /users Pagination Integration Tests", () => {
  const baseUrl = "http://localhost:3000";
  
  beforeEach(async () => {
    // Clear all users before each test
    const response = await fetch(`${baseUrl}/users`);
    const data = await response.json() as PaginatedResponse;
    
    // Delete all existing users
    if (data.users) {
      for (const user of data.users) {
        await fetch(`${baseUrl}/users/${user.id}`, { method: "DELETE" });
      }
    }
    
    // Create test users
    const testUsers = [
      { name: "User 1", email: "user1@test.com" },
      { name: "User 2", email: "user2@test.com" },
      { name: "User 3", email: "user3@test.com" },
      { name: "User 4", email: "user4@test.com" },
      { name: "User 5", email: "user5@test.com" },
      { name: "User 6", email: "user6@test.com" },
      { name: "User 7", email: "user7@test.com" },
      { name: "User 8", email: "user8@test.com" },
      { name: "User 9", email: "user9@test.com" },
      { name: "User 10", email: "user10@test.com" },
      { name: "User 11", email: "user11@test.com" },
      { name: "User 12", email: "user12@test.com" }
    ];
    
    for (const user of testUsers) {
      await fetch(`${baseUrl}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(user)
      });
    }
  });

  describe("Default Pagination", () => {
    it("should return first page with default limit of 10", async () => {
      const response = await fetch(`${baseUrl}/users`);
      const data = await response.json() as PaginatedResponse;
      
      expect(response.status).toBe(200);
      expect(data.users).toHaveLength(10);
      expect(data.totalCount).toBe(12);
      expect(data.page).toBe(1);
      expect(data.limit).toBe(10);
      expect(data.users[0].name).toBe("User 1");
    });
  });

  describe("Custom Page and Limit", () => {
    it("should return page 1 with limit 5", async () => {
      const response = await fetch(`${baseUrl}/users?page=1&limit=5`);
      const data = await response.json() as PaginatedResponse;
      
      expect(response.status).toBe(200);
      expect(data.users).toHaveLength(5);
      expect(data.totalCount).toBe(12);
      expect(data.page).toBe(1);
      expect(data.limit).toBe(5);
      expect(data.users[0].name).toBe("User 1");
      expect(data.users[4].name).toBe("User 5");
    });

    it("should return page 2 with limit 5", async () => {
      const response = await fetch(`${baseUrl}/users?page=2&limit=5`);
      const data = await response.json() as PaginatedResponse;
      
      expect(response.status).toBe(200);
      expect(data.users).toHaveLength(5);
      expect(data.totalCount).toBe(12);
      expect(data.page).toBe(2);
      expect(data.limit).toBe(5);
      expect(data.users[0].name).toBe("User 6");
      expect(data.users[4].name).toBe("User 10");
    });

    it("should return page 3 with limit 5 (partial page)", async () => {
      const response = await fetch(`${baseUrl}/users?page=3&limit=5`);
      const data = await response.json() as PaginatedResponse;
      
      expect(response.status).toBe(200);
      expect(data.users).toHaveLength(2);
      expect(data.totalCount).toBe(12);
      expect(data.page).toBe(3);
      expect(data.limit).toBe(5);
      expect(data.users[0].name).toBe("User 11");
      expect(data.users[1].name).toBe("User 12");
    });
  });

  describe("Edge Cases", () => {
    it("should return empty array for page beyond available data", async () => {
      const response = await fetch(`${baseUrl}/users?page=10&limit=5`);
      const data = await response.json() as PaginatedResponse;
      
      expect(response.status).toBe(200);
      expect(data.users).toHaveLength(0);
      expect(data.totalCount).toBe(12);
      expect(data.page).toBe(10);
      expect(data.limit).toBe(5);
    });

    it("should handle limit larger than total users", async () => {
      const response = await fetch(`${baseUrl}/users?page=1&limit=20`);
      const data = await response.json() as PaginatedResponse;
      
      expect(response.status).toBe(200);
      expect(data.users).toHaveLength(12);
      expect(data.totalCount).toBe(12);
      expect(data.page).toBe(1);
      expect(data.limit).toBe(20);
    });
  });

  describe("Error Handling", () => {
    it("should return 400 for invalid page parameter", async () => {
      const response = await fetch(`${baseUrl}/users?page=0&limit=5`);
      const data = await response.json() as ErrorResponse;
      
      expect(response.status).toBe(400);
      expect(data.error).toBe("Page must be greater than 0");
    });

    it("should return 400 for invalid limit parameter", async () => {
      const response = await fetch(`${baseUrl}/users?page=1&limit=0`);
      const data = await response.json() as ErrorResponse;
      
      expect(response.status).toBe(400);
      expect(data.error).toBe("Limit must be greater than 0");
    });

    it("should use defaults for invalid query parameters", async () => {
      const response = await fetch(`${baseUrl}/users?page=abc&limit=xyz`);
      const data = await response.json() as PaginatedResponse;
      
      expect(response.status).toBe(200);
      expect(data.page).toBe(1);
      expect(data.limit).toBe(10);
    });
  });

  describe("Empty Database", () => {
    it("should handle empty user database", async () => {
      // Clear all users
      const response = await fetch(`${baseUrl}/users`);
      const data = await response.json() as PaginatedResponse;
      
      if (data.users) {
        for (const user of data.users) {
          await fetch(`${baseUrl}/users/${user.id}`, { method: "DELETE" });
        }
      }
      
      const emptyResponse = await fetch(`${baseUrl}/users?page=1&limit=5`);
      const emptyData = await emptyResponse.json() as PaginatedResponse;
      
      expect(emptyResponse.status).toBe(200);
      expect(emptyData.users).toHaveLength(0);
      expect(emptyData.totalCount).toBe(0);
      expect(emptyData.page).toBe(1);
      expect(emptyData.limit).toBe(5);
    });
  });
});
