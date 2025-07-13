import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import express, { Request, Response } from "express";

// Mock the users data and nextId
const mockUsers: { [key: number]: any } = {};
let mockNextId = 1;

// Mock Express app setup
const app = express();
app.use(express.json());

// Helper function to reset mock data
function resetMockData() {
  Object.keys(mockUsers).forEach(key => delete mockUsers[parseInt(key)]);
  mockNextId = 1;
}

// Helper function to add mock users
function addMockUser(name: string, email: string) {
  const user = {
    id: mockNextId++,
    name,
    email,
    createdAt: new Date()
  };
  mockUsers[user.id] = user;
  return user;
}

// Pagination endpoint implementation for testing
function paginationHandler(req: Request, res: Response) {
  const userList = Object.values(mockUsers);
  
  // Parse query parameters with defaults
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  
  // Validate parameters
  if (page < 1) {
    return res.status(400).json({ error: "Page must be greater than 0" });
  }
  
  if (limit < 1) {
    return res.status(400).json({ error: "Limit must be greater than 0" });
  }
  
  // Calculate pagination
  const totalCount = userList.length;
  const offset = (page - 1) * limit;
  const paginatedUsers = userList.slice(offset, offset + limit);
  
  // Return paginated response
  res.json({
    users: paginatedUsers,
    totalCount,
    page,
    limit
  });
}

describe("Users Pagination", () => {
  beforeEach(() => {
    resetMockData();
  });

  describe("Default Values", () => {
    it("should use default page=1 and limit=10 when no query parameters provided", () => {
      // Add some test users
      for (let i = 1; i <= 15; i++) {
        addMockUser(`User ${i}`, `user${i}@example.com`);
      }

      const mockReq = {
        query: {}
      } as unknown as Request;

      const mockRes = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      } as unknown as Response;

      paginationHandler(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        users: expect.arrayContaining([
          expect.objectContaining({ name: "User 1" }),
          expect.objectContaining({ name: "User 10" })
        ]),
        totalCount: 15,
        page: 1,
        limit: 10
      });

      const response = (mockRes.json as jest.Mock).mock.calls[0][0];
      expect(response.users).toHaveLength(10);
    });

    it("should use default page=1 when only limit is provided", () => {
      for (let i = 1; i <= 5; i++) {
        addMockUser(`User ${i}`, `user${i}@example.com`);
      }

      const mockReq = {
        query: { limit: "3" }
      } as unknown as Request;

      const mockRes = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      } as unknown as Response;

      paginationHandler(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        users: expect.any(Array),
        totalCount: 5,
        page: 1,
        limit: 3
      });
    });

    it("should use default limit=10 when only page is provided", () => {
      for (let i = 1; i <= 5; i++) {
        addMockUser(`User ${i}`, `user${i}@example.com`);
      }

      const mockReq = {
        query: { page: "1" }
      } as unknown as Request;

      const mockRes = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      } as unknown as Response;

      paginationHandler(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        users: expect.any(Array),
        totalCount: 5,
        page: 1,
        limit: 10
      });
    });
  });

  describe("Various Page/Limit Combinations", () => {
    beforeEach(() => {
      // Add 25 test users
      for (let i = 1; i <= 25; i++) {
        addMockUser(`User ${i}`, `user${i}@example.com`);
      }
    });

    it("should return correct users for page=1, limit=5", () => {
      const mockReq = {
        query: { page: "1", limit: "5" }
      } as unknown as Request;

      const mockRes = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      } as unknown as Response;

      paginationHandler(mockReq, mockRes);

      const response = (mockRes.json as jest.Mock).mock.calls[0][0];
      expect(response.users).toHaveLength(5);
      expect(response.totalCount).toBe(25);
      expect(response.page).toBe(1);
      expect(response.limit).toBe(5);
    });

    it("should return correct users for page=3, limit=5", () => {
      const mockReq = {
        query: { page: "3", limit: "5" }
      } as unknown as Request;

      const mockRes = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      } as unknown as Response;

      paginationHandler(mockReq, mockRes);

      const response = (mockRes.json as jest.Mock).mock.calls[0][0];
      expect(response.users).toHaveLength(5);
      expect(response.totalCount).toBe(25);
      expect(response.page).toBe(3);
      expect(response.limit).toBe(5);
    });

    it("should return partial results for last page", () => {
      const mockReq = {
        query: { page: "5", limit: "6" }
      } as unknown as Request;

      const mockRes = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      } as unknown as Response;

      paginationHandler(mockReq, mockRes);

      const response = (mockRes.json as jest.Mock).mock.calls[0][0];
      expect(response.users).toHaveLength(1); // 25 users, page 5 with limit 6 should have 1 user
      expect(response.totalCount).toBe(25);
      expect(response.page).toBe(5);
      expect(response.limit).toBe(6);
    });
  });

  describe("Edge Cases", () => {
    it("should return empty array when no users exist", () => {
      const mockReq = {
        query: { page: "1", limit: "10" }
      } as unknown as Request;

      const mockRes = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      } as unknown as Response;

      paginationHandler(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        users: [],
        totalCount: 0,
        page: 1,
        limit: 10
      });
    });

    it("should return empty array when page exceeds available data", () => {
      addMockUser("User 1", "user1@example.com");

      const mockReq = {
        query: { page: "5", limit: "10" }
      } as unknown as Request;

      const mockRes = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      } as unknown as Response;

      paginationHandler(mockReq, mockRes);

      const response = (mockRes.json as jest.Mock).mock.calls[0][0];
      expect(response.users).toHaveLength(0);
      expect(response.totalCount).toBe(1);
      expect(response.page).toBe(5);
      expect(response.limit).toBe(10);
    });
  });

  describe("Invalid Parameters", () => {
    it("should return 400 error for page less than 1", () => {
      const mockReq = {
        query: { page: "0", limit: "10" }
      } as unknown as Request;

      const mockRes = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      } as unknown as Response;

      paginationHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Page must be greater than 0"
      });
    });

    it("should return 400 error for limit less than 1", () => {
      const mockReq = {
        query: { page: "1", limit: "0" }
      } as unknown as Request;

      const mockRes = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      } as unknown as Response;

      paginationHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Limit must be greater than 0"
      });
    });

    it("should return 400 error for negative page", () => {
      const mockReq = {
        query: { page: "-1", limit: "10" }
      } as unknown as Request;

      const mockRes = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      } as unknown as Response;

      paginationHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Page must be greater than 0"
      });
    });

    it("should return 400 error for negative limit", () => {
      const mockReq = {
        query: { page: "1", limit: "-5" }
      } as unknown as Request;

      const mockRes = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      } as unknown as Response;

      paginationHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Limit must be greater than 0"
      });
    });
  });

  describe("Response Format Validation", () => {
    it("should return response with correct structure and types", () => {
      addMockUser("Test User", "test@example.com");

      const mockReq = {
        query: { page: "1", limit: "10" }
      } as unknown as Request;

      const mockRes = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      } as unknown as Response;

      paginationHandler(mockReq, mockRes);

      const response = (mockRes.json as jest.Mock).mock.calls[0][0];
      
      // Check response structure
      expect(response).toHaveProperty('users');
      expect(response).toHaveProperty('totalCount');
      expect(response).toHaveProperty('page');
      expect(response).toHaveProperty('limit');

      // Check types
      expect(Array.isArray(response.users)).toBe(true);
      expect(typeof response.totalCount).toBe('number');
      expect(typeof response.page).toBe('number');
      expect(typeof response.limit).toBe('number');

      // Check user object structure
      if (response.users.length > 0) {
        const user = response.users[0];
        expect(user).toHaveProperty('id');
        expect(user).toHaveProperty('name');
        expect(user).toHaveProperty('email');
        expect(user).toHaveProperty('createdAt');
      }
    });

    it("should maintain consistent response format even with empty results", () => {
      const mockReq = {
        query: { page: "1", limit: "10" }
      } as unknown as Request;

      const mockRes = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      } as unknown as Response;

      paginationHandler(mockReq, mockRes);

      const response = (mockRes.json as jest.Mock).mock.calls[0][0];
      
      expect(response).toEqual({
        users: [],
        totalCount: 0,
        page: 1,
        limit: 10
      });
    });
  });
});

