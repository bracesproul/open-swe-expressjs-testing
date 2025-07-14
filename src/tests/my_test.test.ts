// This file contains unit tests for pagination functionality.
import { describe, it, expect } from "@jest/globals";

describe("Pagination Logic Tests", () => {
  describe("Query Parameter Parsing", () => {
    it("should use default page=1 and limit=10 when no parameters provided", () => {
      const page = parseInt("undefined") || 1;
      const limit = parseInt("undefined") || 10;
      
      expect(page).toBe(1);
      expect(limit).toBe(10);
    });

    it("should parse valid page and limit parameters", () => {
      const page = parseInt("2") || 1;
      const limit = parseInt("5") || 10;
      
      expect(page).toBe(2);
      expect(limit).toBe(5);
    });

    it("should handle invalid page parameter", () => {
      const page = parseInt("abc") || 1;
      const limit = parseInt("10") || 10;
      
      expect(page).toBe(1);
      expect(limit).toBe(10);
    });
  });

  describe("Array Slicing Logic", () => {
    const testData = [
      { id: 1, name: "User 1", email: "user1@test.com" },
      { id: 2, name: "User 2", email: "user2@test.com" },
      { id: 3, name: "User 3", email: "user3@test.com" },
      { id: 4, name: "User 4", email: "user4@test.com" },
      { id: 5, name: "User 5", email: "user5@test.com" }
    ];

    it("should slice array correctly for page 1 with limit 2", () => {
      const page = 1;
      const limit = 2;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const result = testData.slice(startIndex, endIndex);
      
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(1);
      expect(result[1].id).toBe(2);
    });

    it("should slice array correctly for page 2 with limit 2", () => {
      const page = 2;
      const limit = 2;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const result = testData.slice(startIndex, endIndex);
      
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(3);
      expect(result[1].id).toBe(4);
    });

    it("should handle page beyond available data", () => {
      const page = 10;
      const limit = 2;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const result = testData.slice(startIndex, endIndex);
      
      expect(result).toHaveLength(0);
    });

    it("should handle limit larger than available data", () => {
      const page = 1;
      const limit = 10;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const result = testData.slice(startIndex, endIndex);
      
      expect(result).toHaveLength(5);
      expect(result).toEqual(testData);
    });
  });

  describe("Response Metadata", () => {
    it("should calculate correct metadata for pagination", () => {
      const users = new Array(25).fill(0).map((_, i) => ({ id: i + 1, name: `User ${i + 1}` }));
      const page = 2;
      const limit = 10;
      const totalCount = users.length;
      
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedUsers = users.slice(startIndex, endIndex);
      
      const response = {
        users: paginatedUsers,
        totalCount,
        page,
        limit
      };
      
      expect(response.totalCount).toBe(25);
      expect(response.page).toBe(2);
      expect(response.limit).toBe(10);
      expect(response.users).toHaveLength(10);
      expect(response.users[0].id).toBe(11);
    });
  });
});
