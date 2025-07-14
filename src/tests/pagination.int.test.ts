// This file contains simplified integration tests for pagination functionality.
import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";

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

const baseUrl = "http://localhost:3000";

async function clearAllUsers() {
  const response = await fetch(`${baseUrl}/users?limit=1000`);
  const data = await response.json() as PaginatedResponse;
  
  if (data.users) {
    for (const user of data.users) {
      await fetch(`${baseUrl}/users/${user.id}`, { method: "DELETE" });
    }
  }
}

async function createTestUsers(count: number) {
  const users = [];
  for (let i = 1; i <= count; i++) {
    const user = await fetch(`${baseUrl}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `User ${i}`,
        email: `user${i}@test.com`
      })
    });
    users.push(await user.json());
  }
  return users;
}

describe("Pagination Integration Tests", () => {
  beforeAll(async () => {
    await clearAllUsers();
  });

  afterAll(async () => {
    await clearAllUsers();
  });

  it("should return paginated results with default values", async () => {
    await clearAllUsers();
    await createTestUsers(15);
    
    const response = await fetch(`${baseUrl}/users`);
    const data = await response.json() as PaginatedResponse;
    
    expect(response.status).toBe(200);
    expect(data.users).toHaveLength(10);
    expect(data.totalCount).toBe(15);
    expect(data.page).toBe(1);
    expect(data.limit).toBe(10);
  });

  it("should return page 2 with limit 5", async () => {
    await clearAllUsers();
    await createTestUsers(12);
    
    const response = await fetch(`${baseUrl}/users?page=2&limit=5`);
    const data = await response.json() as PaginatedResponse;
    
    expect(response.status).toBe(200);
    expect(data.users).toHaveLength(5);
    expect(data.totalCount).toBe(12);
    expect(data.page).toBe(2);
    expect(data.limit).toBe(5);
    expect(data.users[0].name).toBe("User 6");
  });

  it("should return partial page when fewer users available", async () => {
    await clearAllUsers();
    await createTestUsers(7);
    
    const response = await fetch(`${baseUrl}/users?page=2&limit=5`);
    const data = await response.json() as PaginatedResponse;
    
    expect(response.status).toBe(200);
    expect(data.users).toHaveLength(2);
    expect(data.totalCount).toBe(7);
    expect(data.page).toBe(2);
    expect(data.limit).toBe(5);
    expect(data.users[0].name).toBe("User 6");
    expect(data.users[1].name).toBe("User 7");
  });

  it("should return empty array for page beyond available data", async () => {
    await clearAllUsers();
    await createTestUsers(5);
    
    const response = await fetch(`${baseUrl}/users?page=10&limit=5`);
    const data = await response.json() as PaginatedResponse;
    
    expect(response.status).toBe(200);
    expect(data.users).toHaveLength(0);
    expect(data.totalCount).toBe(5);
    expect(data.page).toBe(10);
    expect(data.limit).toBe(5);
  });

  it("should handle empty database", async () => {
    await clearAllUsers();
    
    const response = await fetch(`${baseUrl}/users?page=1&limit=5`);
    const data = await response.json() as PaginatedResponse;
    
    expect(response.status).toBe(200);
    expect(data.users).toHaveLength(0);
    expect(data.totalCount).toBe(0);
    expect(data.page).toBe(1);
    expect(data.limit).toBe(5);
  });

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
    await clearAllUsers();
    await createTestUsers(5);
    
    const response = await fetch(`${baseUrl}/users?page=abc&limit=xyz`);
    const data = await response.json() as PaginatedResponse;
    
    expect(response.status).toBe(200);
    expect(data.page).toBe(1);
    expect(data.limit).toBe(10);
    expect(data.totalCount).toBe(5);
  });
});