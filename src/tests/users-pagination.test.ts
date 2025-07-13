import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import express, { Request, Response } from "express";

// Mock the users data and nextId
const mockUsers: { [key: number]: any } = {};
let mockNextId = 1;

// Mock user interface
interface User {
  id: number;
  name: string;
  email: string;
  createdAt: Date;
}

// Create a test app with the pagination endpoint
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  
  // Replicate the GET /users endpoint with pagination
  app.get("/users", (req: Request, res: Response) => {
    // Parse query parameters with defaults
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    
    // Validate pagination parameters
    if (page < 1 || limit < 1) {
      return res.status(400).json({ 
        error: "Invalid pagination parameters. Page and limit must be positive integers." 
      });
    }
    
    // Get all users as array
    const allUsers = Object.values(mockUsers);
    const totalCount = allUsers.length;
    
    // Calculate pagination
    const offset = (page - 1) * limit;
    const paginatedUsers = allUsers.slice(offset, offset + limit);
    
    // Return paginated response
    res.json({ users: paginatedUsers, totalCount, page, limit });
  });
  
  return app;
};

describe("Users Pagination", () => {
  let app: express.Application;
  
  beforeEach(() => {
    // Clear mock users before each test
    Object.keys(mockUsers).forEach(key => delete mockUsers[parseInt(key)]);
    mockNextId = 1;
    app = createTestApp();
  });
  
  const createMockUser = (name: string, email: string): User => {
    const user: User = {
      id: mockNextId++,
      name,
      email,
      createdAt: new Date(),
    };
    mockUsers[user.id] = user;
    return user;
  };
  
  describe("Default pagination behavior", () => {
    it("should return default page=1 and limit=10 when no query parameters provided", async () => {
      // Create 5 test users
      for (let i = 1; i <= 5; i++) {
        createMockUser(`User ${i}`, `user${i}@example.com`);
      }
      
      const request = require('supertest');
      const response = await request(app).get('/users');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('users');
      expect(response.body).toHaveProperty('totalCount', 5);
      expect(response.body).toHaveProperty('page', 1);
      expect(response.body).toHaveProperty('limit', 10);
      expect(response.body.users).toHaveLength(5);
    });
    
    it("should return empty users array when no users exist", async () => {
      const request = require('supertest');
      const response = await request(app).get('/users');
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        users: [],
        totalCount: 0,
        page: 1,
        limit: 10
      });
    });
  });
  
  describe("Custom pagination parameters", () => {
    beforeEach(() => {
      // Create 25 test users for pagination testing
      for (let i = 1; i <= 25; i++) {
        createMockUser(`User ${i}`, `user${i}@example.com`);
      }
    });
    
    it("should handle custom page and limit parameters", async () => {
      const request = require('supertest');
      const response = await request(app).get('/users?page=2&limit=5');
      
      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(5);
      expect(response.body.totalCount).toBe(25);
      expect(response.body.page).toBe(2);
      expect(response.body.limit).toBe(5);
      
      // Check that we get users 6-10 (second page with limit 5)
      expect(response.body.users[0].name).toBe('User 6');
      expect(response.body.users[4].name).toBe('User 10');
    });
    
    it("should handle first page correctly", async () => {
      const request = require('supertest');
      const response = await request(app).get('/users?page=1&limit=3');
      
      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(3);
      expect(response.body.users[0].name).toBe('User 1');
      expect(response.body.users[2].name).toBe('User 3');
    });
    
    it("should handle last page with fewer items", async () => {
      const request = require('supertest');
      const response = await request(app).get('/users?page=5&limit=6');
      
      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(1); // 25 users, page 5 with limit 6 = 1 user left
      expect(response.body.totalCount).toBe(25);
      expect(response.body.page).toBe(5);
      expect(response.body.limit).toBe(6);
      expect(response.body.users[0].name).toBe('User 25');
    });
    
    it("should return empty array for page beyond available data", async () => {
      const request = require('supertest');
      const response = await request(app).get('/users?page=10&limit=10');
      
      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(0);
      expect(response.body.totalCount).toBe(25);
      expect(response.body.page).toBe(10);
      expect(response.body.limit).toBe(10);
    });
  });
  
  describe("Parameter validation and edge cases", () => {
    it("should return 400 for invalid page parameter", async () => {
      const request = require('supertest');
      const response = await request(app).get('/users?page=0&limit=10');
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid pagination parameters');
    });
    
    it("should return 400 for invalid limit parameter", async () => {
      const request = require('supertest');
      const response = await request(app).get('/users?page=1&limit=0');
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid pagination parameters');
    });
    
    it("should return 400 for negative page parameter", async () => {
      const request = require('supertest');
      const response = await request(app).get('/users?page=-1&limit=10');
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid pagination parameters');
    });
    
    it("should return 400 for negative limit parameter", async () => {
      const request = require('supertest');
      const response = await request(app).get('/users?page=1&limit=-5');
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid pagination parameters');
    });
    
    it("should handle non-numeric parameters gracefully", async () => {
      const request = require('supertest');
      const response = await request(app).get('/users?page=abc&limit=def');
      
      expect(response.status).toBe(200);
      expect(response.body.page).toBe(1); // Should default to 1
      expect(response.body.limit).toBe(10); // Should default to 10
    });
  });
});

