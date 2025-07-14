import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import express, { Request, Response } from "express";

// Mock the users data and nextId
const mockUsers: { [key: number]: any } = {};
let _mockNextId = 1;

// Mock Express app setup
const app = express();
app.use(express.json());

// User interface for testing
interface User {
  id: number;
  name: string;
  email: string;
  createdAt: Date;
}

// Recreate the pagination logic from the main app for testing
const getUsersPaginated = (req: Request, res: Response): void => {
  // Parse query parameters with defaults
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;

  // Validate pagination parameters
  if (page < 1) {
    return res.status(400).json({ error: "Page must be greater than 0" });
  }

  if (limit < 1 || limit > 100) {
    return res.status(400).json({ error: "Limit must be between 1 and 100" });
  }

  // Convert users object to array
  const userList = Object.values(mockUsers);
  const totalCount = userList.length;

  // Calculate pagination
  const offset = (page - 1) * limit;
  const paginatedUsers = userList.slice(offset, offset + limit);

  // Return paginated response
  return res.json({
    users: paginatedUsers,
    totalCount,
    page,
    limit,
  });
};

// Helper function to create mock users
const createMockUser = (id: number, name: string, email: string): User => ({
  id,
  name,
  email,
  createdAt: new Date(`2024-01-${id.toString().padStart(2, "0")}T10:00:00Z`),
});

// Helper function to populate mock users
const populateMockUsers = (count: number) => {
  for (let i = 1; i <= count; i++) {
    mockUsers[i] = createMockUser(i, `User ${i}`, `user${i}@example.com`);
  }
  _mockNextId = count + 1;
};

// Mock request and response objects
const createMockRequest = (query: any = {}): Partial<Request> => ({
  query,
});

const createMockResponse = (): Partial<Response> => {
  const res: any = {
    status: jest.fn(() => res),
    json: jest.fn(() => res),
  };
  return res;
};

describe("Users Pagination Unit Tests", () => {
  beforeEach(() => {
    // Clear mock users before each test
    Object.keys(mockUsers).forEach((key) => delete mockUsers[parseInt(key)]);
    _mockNextId = 1;
    jest.clearAllMocks();
  });

  describe("Default Values", () => {
    it("should use default page=1 and limit=10 when no query parameters provided", () => {
      populateMockUsers(15);
      const req = createMockRequest({}) as Request;
      const res = createMockResponse() as Response;

      getUsersPaginated(req, res);

      expect(res.json).toHaveBeenCalledWith({
        users: expect.arrayContaining([
          expect.objectContaining({ id: 1, name: "User 1" }),
          expect.objectContaining({ id: 10, name: "User 10" }),
        ]),
        totalCount: 15,
        page: 1,
        limit: 10,
      });
      expect(
        (res.json as jest.MockedFunction<any>).mock.calls[0][0].users,
      ).toHaveLength(10);
    });

    it("should use default page=1 when only limit is provided", () => {
      populateMockUsers(8);
      const req = createMockRequest({ limit: "5" }) as Request;
      const res = createMockResponse() as Response;

      getUsersPaginated(req, res);

      expect(res.json).toHaveBeenCalledWith({
        users: expect.arrayContaining([
          expect.objectContaining({ id: 1 }),
          expect.objectContaining({ id: 5 }),
        ]),
        totalCount: 8,
        page: 1,
        limit: 5,
      });
      expect(
        (res.json as jest.MockedFunction<any>).mock.calls[0][0].users,
      ).toHaveLength(5);
    });

    it("should use default limit=10 when only page is provided", () => {
      populateMockUsers(25);
      const req = createMockRequest({ page: "2" }) as Request;
      const res = createMockResponse() as Response;

      getUsersPaginated(req, res);

      expect(res.json).toHaveBeenCalledWith({
        users: expect.arrayContaining([
          expect.objectContaining({ id: 11 }),
          expect.objectContaining({ id: 20 }),
        ]),
        totalCount: 25,
        page: 2,
        limit: 10,
      });
      expect(
        (res.json as jest.MockedFunction<any>).mock.calls[0][0].users,
      ).toHaveLength(10);
    });
  });

  describe("Various Page/Limit Combinations", () => {
    beforeEach(() => {
      populateMockUsers(50); // Create 50 users for testing
    });

    it("should return correct users for page=1, limit=5", () => {
      const req = createMockRequest({ page: "1", limit: "5" }) as Request;
      const res = createMockResponse() as Response;

      getUsersPaginated(req, res);

      const response = (res.json as jest.MockedFunction<any>).mock.calls[0][0];
      expect(response.users).toHaveLength(5);
      expect(response.users[0].id).toBe(1);
      expect(response.users[4].id).toBe(5);
      expect(response.totalCount).toBe(50);
      expect(response.page).toBe(1);
      expect(response.limit).toBe(5);
    });

    it("should return correct users for page=3, limit=7", () => {
      const req = createMockRequest({ page: "3", limit: "7" }) as Request;
      const res = createMockResponse() as Response;

      getUsersPaginated(req, res);

      const response = (res.json as jest.MockedFunction<any>).mock.calls[0][0];
      expect(response.users).toHaveLength(7);
      expect(response.users[0].id).toBe(15); // (3-1) * 7 + 1 = 15
      expect(response.users[6].id).toBe(21);
      expect(response.totalCount).toBe(50);
      expect(response.page).toBe(3);
      expect(response.limit).toBe(7);
    });

    it("should return partial results for last page", () => {
      const req = createMockRequest({ page: "6", limit: "10" }) as Request;
      const res = createMockResponse() as Response;

      getUsersPaginated(req, res);

      const response = (res.json as jest.MockedFunction<any>).mock.calls[0][0];
      expect(response.users).toHaveLength(10); // 50 users, page 6 with limit 10 = users 51-60, but only 50 exist
      expect(response.users[0].id).toBe(51);
      expect(response.totalCount).toBe(50);
    });
  });

  describe("Edge Cases", () => {
    it("should return empty array when no users exist", () => {
      const req = createMockRequest({ page: "1", limit: "10" }) as Request;
      const res = createMockResponse() as Response;

      getUsersPaginated(req, res);

      expect(res.json).toHaveBeenCalledWith({
        users: [],
        totalCount: 0,
        page: 1,
        limit: 10,
      });
    });

    it("should return empty array when page exceeds available data", () => {
      populateMockUsers(5);
      const req = createMockRequest({ page: "10", limit: "10" }) as Request;
      const res = createMockResponse() as Response;

      getUsersPaginated(req, res);

      const response = (res.json as jest.MockedFunction<any>).mock.calls[0][0];
      expect(response.users).toEqual([]);
      expect(response.totalCount).toBe(5);
      expect(response.page).toBe(10);
      expect(response.limit).toBe(10);
    });
  });

  describe("Invalid Parameters", () => {
    it("should return 400 error for page less than 1", () => {
      const req = createMockRequest({ page: "0" }) as Request;
      const res = createMockResponse() as Response;

      getUsersPaginated(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "Page must be greater than 0",
      });
    });

    it("should return 400 error for negative page", () => {
      const req = createMockRequest({ page: "-1" }) as Request;
      const res = createMockResponse() as Response;

      getUsersPaginated(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "Page must be greater than 0",
      });
    });

    it("should return 400 error for limit less than 1", () => {
      const req = createMockRequest({ limit: "0" }) as Request;
      const res = createMockResponse() as Response;

      getUsersPaginated(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "Limit must be between 1 and 100",
      });
    });

    it("should return 400 error for limit greater than 100", () => {
      const req = createMockRequest({ limit: "101" }) as Request;
      const res = createMockResponse() as Response;

      getUsersPaginated(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "Limit must be between 1 and 100",
      });
    });

    it("should handle non-numeric page parameter gracefully", () => {
      populateMockUsers(10);
      const req = createMockRequest({ page: "invalid" }) as Request;
      const res = createMockResponse() as Response;

      getUsersPaginated(req, res);

      // Should default to page 1 when parseInt returns NaN
      const response = (res.json as jest.MockedFunction<any>).mock.calls[0][0];
      expect(response.page).toBe(1);
      expect(response.limit).toBe(10);
    });

    it("should handle non-numeric limit parameter gracefully", () => {
      populateMockUsers(10);
      const req = createMockRequest({ limit: "invalid" }) as Request;
      const res = createMockResponse() as Response;

      getUsersPaginated(req, res);

      // Should default to limit 10 when parseInt returns NaN
      const response = (res.json as jest.MockedFunction<any>).mock.calls[0][0];
      expect(response.page).toBe(1);
      expect(response.limit).toBe(10);
    });
  });

  describe("Response Format Validation", () => {
    it("should return response with correct structure and types", () => {
      populateMockUsers(3);
      const req = createMockRequest({ page: "1", limit: "2" }) as Request;
      const res = createMockResponse() as Response;

      getUsersPaginated(req, res);

      const response = (res.json as jest.MockedFunction<any>).mock.calls[0][0];

      // Check response structure
      expect(response).toHaveProperty("users");
      expect(response).toHaveProperty("totalCount");
      expect(response).toHaveProperty("page");
      expect(response).toHaveProperty("limit");

      // Check types
      expect(Array.isArray(response.users)).toBe(true);
      expect(typeof response.totalCount).toBe("number");
      expect(typeof response.page).toBe("number");
      expect(typeof response.limit).toBe("number");

      // Check user object structure
      if (response.users.length > 0) {
        const user = response.users[0];
        expect(user).toHaveProperty("id");
        expect(user).toHaveProperty("name");
        expect(user).toHaveProperty("email");
        expect(user).toHaveProperty("createdAt");
        expect(typeof user.id).toBe("number");
        expect(typeof user.name).toBe("string");
        expect(typeof user.email).toBe("string");
      }
    });

    it("should maintain consistent response format even with empty results", () => {
      const req = createMockRequest({ page: "1", limit: "10" }) as Request;
      const res = createMockResponse() as Response;

      getUsersPaginated(req, res);

      const response = (res.json as jest.MockedFunction<any>).mock.calls[0][0];

      expect(response).toEqual({
        users: [],
        totalCount: 0,
        page: 1,
        limit: 10,
      });
    });
  });
});

