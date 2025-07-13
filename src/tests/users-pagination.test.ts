import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import express, { Request, Response } from "express";

// Mock the users data structure and pagination logic
interface User {
  id: number;
  name: string;
  email: string;
  createdAt: Date;
}

// Create a mock users object for testing
let mockUsers: { [key: number]: User } = {};

// Mock the pagination endpoint logic
function paginateUsers(req: Request): { users: User[]; totalCount: number; page: number; limit: number } {
  // Parse query parameters with defaults
  const pageParam = req.query.page as string;
  const limitParam = req.query.limit as string;
  
  let page = 1;
  let limit = 10;
  
  // Parse and validate page parameter
  if (pageParam) {
    const parsedPage = parseInt(pageParam, 10);
    if (!isNaN(parsedPage) && parsedPage > 0) {
      page = parsedPage;
    }
  }
  
  // Parse and validate limit parameter
  if (limitParam) {
    const parsedLimit = parseInt(limitParam, 10);
    if (!isNaN(parsedLimit) && parsedLimit > 0) {
      limit = parsedLimit;
    }
  }
  
  // Get all users and calculate pagination
  const allUsers = Object.values(mockUsers);
  const totalCount = allUsers.length;
  const startIndex = (page - 1) * limit;
  const paginatedUsers = allUsers.slice(startIndex, startIndex + limit);
  
  return { users: paginatedUsers, totalCount, page, limit };
}

describe("Users Pagination", () => {
  beforeEach(() => {
    // Reset mock users before each test
    mockUsers = {};
    
    // Create sample users for testing
    for (let i = 1; i <= 25; i++) {
      mockUsers[i] = {
        id: i,
        name: `User ${i}`,
        email: `user${i}@example.com`,
        createdAt: new Date(`2023-01-${String(i).padStart(2, '0')}T10:00:00Z`)
      };
    }
  });

  describe("Default Values", () => {
    it("should use default page=1 and limit=10 when no query parameters provided", () => {
      const mockReq = { query: {} } as Request;
      const result = paginateUsers(mockReq);
      
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.users).toHaveLength(10);
      expect(result.totalCount).toBe(25);
      expect(result.users[0].id).toBe(1);
      expect(result.users[9].id).toBe(10);
    });

    it("should use default page=1 when only limit is provided", () => {
      const mockReq = { query: { limit: "5" } } as Request;
      const result = paginateUsers(mockReq);
      
      expect(result.page).toBe(1);
      expect(result.limit).toBe(5);
      expect(result.users).toHaveLength(5);
      expect(result.users[0].id).toBe(1);
      expect(result.users[4].id).toBe(5);
    });

    it("should use default limit=10 when only page is provided", () => {
      const mockReq = { query: { page: "2" } } as Request;
      const result = paginateUsers(mockReq);
      
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.users).toHaveLength(10);
      expect(result.users[0].id).toBe(11);
      expect(result.users[9].id).toBe(20);
    });
  });

  describe("Various Page/Limit Combinations", () => {
    it("should handle page=1, limit=5", () => {
      const mockReq = { query: { page: "1", limit: "5" } } as Request;
      const result = paginateUsers(mockReq);
      
      expect(result.page).toBe(1);
      expect(result.limit).toBe(5);
      expect(result.users).toHaveLength(5);
      expect(result.users[0].id).toBe(1);
      expect(result.users[4].id).toBe(5);
    });

    it("should handle page=3, limit=7", () => {
      const mockReq = { query: { page: "3", limit: "7" } } as Request;
      const result = paginateUsers(mockReq);
      
      expect(result.page).toBe(3);
      expect(result.limit).toBe(7);
      expect(result.users).toHaveLength(7);
      expect(result.users[0].id).toBe(15); // (3-1) * 7 + 1 = 15
      expect(result.users[6].id).toBe(21);
    });

    it("should handle large limit that exceeds total users", () => {
      const mockReq = { query: { page: "1", limit: "100" } } as Request;
      const result = paginateUsers(mockReq);
      
      expect(result.page).toBe(1);
      expect(result.limit).toBe(100);
      expect(result.users).toHaveLength(25); // Only 25 users total
      expect(result.totalCount).toBe(25);
    });

    it("should handle last page with partial results", () => {
      const mockReq = { query: { page: "3", limit: "10" } } as Request;
      const result = paginateUsers(mockReq);
      
      expect(result.page).toBe(3);
      expect(result.limit).toBe(10);
      expect(result.users).toHaveLength(5); // Only 5 users left on page 3
      expect(result.users[0].id).toBe(21);
      expect(result.users[4].id).toBe(25);
    });
  });

  describe("Edge Cases", () => {
    it("should return empty results when page exceeds available data", () => {
      const mockReq = { query: { page: "10", limit: "10" } } as Request;
      const result = paginateUsers(mockReq);
      
      expect(result.page).toBe(10);
      expect(result.limit).toBe(10);
      expect(result.users).toHaveLength(0);
      expect(result.totalCount).toBe(25);
    });

    it("should handle empty users database", () => {
      mockUsers = {}; // Empty users
      const mockReq = { query: { page: "1", limit: "10" } } as Request;
      const result = paginateUsers(mockReq);
      
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.users).toHaveLength(0);
      expect(result.totalCount).toBe(0);
    });
  });

  describe("Invalid Parameters", () => {
    it("should use defaults for invalid page parameter", () => {
      const mockReq = { query: { page: "invalid", limit: "5" } } as Request;
      const result = paginateUsers(mockReq);
      
      expect(result.page).toBe(1); // Default
      expect(result.limit).toBe(5);
    });

    it("should use defaults for invalid limit parameter", () => {
      const mockReq = { query: { page: "2", limit: "invalid" } } as Request;
      const result = paginateUsers(mockReq);
      
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10); // Default
    });

    it("should use defaults for negative page parameter", () => {
      const mockReq = { query: { page: "-1", limit: "5" } } as Request;
      const result = paginateUsers(mockReq);
      
      expect(result.page).toBe(1); // Default
      expect(result.limit).toBe(5);
    });

    it("should use defaults for zero or negative limit parameter", () => {
      const mockReq = { query: { page: "1", limit: "0" } } as Request;
      const result = paginateUsers(mockReq);
      
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10); // Default
    });
  });

  describe("Response Format Validation", () => {
    it("should return correct response structure", () => {
      const mockReq = { query: { page: "2", limit: "5" } } as Request;
      const result = paginateUsers(mockReq);
      
      expect(result).toHaveProperty('users');
      expect(result).toHaveProperty('totalCount');
      expect(result).toHaveProperty('page');
      expect(result).toHaveProperty('limit');
      
      expect(Array.isArray(result.users)).toBe(true);
      expect(typeof result.totalCount).toBe('number');
      expect(typeof result.page).toBe('number');
      expect(typeof result.limit).toBe('number');
    });

    it("should return users with correct structure", () => {
      const mockReq = { query: { page: "1", limit: "3" } } as Request;
      const result = paginateUsers(mockReq);
      
      expect(result.users).toHaveLength(3);
      
      result.users.forEach(user => {
        expect(user).toHaveProperty('id');
        expect(user).toHaveProperty('name');
        expect(user).toHaveProperty('email');
        expect(user).toHaveProperty('createdAt');
        
        expect(typeof user.id).toBe('number');
        expect(typeof user.name).toBe('string');
        expect(typeof user.email).toBe('string');
        expect(user.createdAt).toBeInstanceOf(Date);
      });
    });

    it("should maintain correct totalCount regardless of pagination", () => {
      const mockReq1 = { query: { page: "1", limit: "10" } } as Request;
      const mockReq2 = { query: { page: "2", limit: "5" } } as Request;
      const mockReq3 = { query: { page: "5", limit: "3" } } as Request;
      
      const result1 = paginateUsers(mockReq1);
      const result2 = paginateUsers(mockReq2);
      const result3 = paginateUsers(mockReq3);
      
      expect(result1.totalCount).toBe(25);
      expect(result2.totalCount).toBe(25);
      expect(result3.totalCount).toBe(25);
    });
  });
});

