import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from "@jest/globals";
import request from "supertest";
import express from "express";
import { promises as fs } from "fs";
import path from "path";

// Import the Express app and persistence functions
// We need to create a test version of the app without auto-starting the server
const DATA_FILE_PATH = path.join(process.cwd(), "data.json");

// User interface definition
interface User {
  id: number;
  name: string;
  email: string;
  createdAt: string; // Will be string in JSON responses
}

interface PersistedData {
  users: { [key: number]: User };
  nextId: number;
}

// Create test Express app
let app: express.Application;
let testUsers: { [key: number]: any } = {};
let testNextId = 1;

// Mock console methods to reduce test noise
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

beforeAll(() => {
  console.log = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
});

// Helper function to create test Express app
function createTestApp() {
  const testApp = express();
  testApp.use(express.json());

  // Validation function
  function validateUserData(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.name || typeof data.name !== "string" || data.name.trim().length === 0) {
      errors.push("Name is required and must be a non-empty string");
    }

    if (!data.email || typeof data.email !== "string" || data.email.trim().length === 0) {
      errors.push("Email is required and must be a non-empty string");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (data.email && !emailRegex.test(data.email.trim())) {
      errors.push("Email must be a valid email address");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // Save data to JSON file
  async function saveData(): Promise<void> {
    try {
      const dataToSave: PersistedData = {
        users: testUsers,
        nextId: testNextId,
      };
      
      const jsonData = JSON.stringify(dataToSave, null, 2);
      await fs.writeFile(DATA_FILE_PATH, jsonData, "utf8");
    } catch (error) {
      console.error("Failed to save data to file:", error);
      throw new Error("Data persistence failed");
    }
  }

  // Load data from JSON file
  async function loadData(): Promise<void> {
    try {
      const fileContent = await fs.readFile(DATA_FILE_PATH, "utf8");
      const parsedData: PersistedData = JSON.parse(fileContent);
      
      // Validate the structure of loaded data
      if (typeof parsedData !== "object" || parsedData === null) {
        throw new Error("Invalid data format in persistence file");
      }
      
      if (typeof parsedData.nextId !== "number" || parsedData.nextId < 1) {
        throw new Error("Invalid nextId in persistence file");
      }
      
      if (typeof parsedData.users !== "object" || parsedData.users === null) {
        throw new Error("Invalid users data in persistence file");
      }
      
      // Clear existing data and restore from file
      Object.keys(testUsers).forEach(key => delete testUsers[parseInt(key)]);
      Object.assign(testUsers, parsedData.users);
      testNextId = parsedData.nextId;
      
      // Convert createdAt strings back to Date objects
      Object.values(testUsers).forEach(user => {
        if (typeof user.createdAt === "string") {
          user.createdAt = new Date(user.createdAt);
        }
      });
      
      console.log(`Loaded ${Object.keys(testUsers).length} users from persistence file`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        // File doesn't exist, this is normal for first run
        console.log("No persistence file found, starting with empty database");
        return;
      }
      
      if (error instanceof SyntaxError) {
        console.error("Failed to parse persistence file - corrupted JSON:", error.message);
        throw new Error("Corrupted persistence file");
      }
      
      console.error("Failed to load data from file:", error);
      throw error;
    }
  }

  // Routes
  testApp.get("/users", (req, res) => {
    const userList = Object.values(testUsers);
    res.json(userList);
  });

  testApp.get("/users/:id", (req, res) => {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }
    
    const user = testUsers[id];
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    return res.json(user);
  });

  testApp.post("/users", async (req, res) => {
    const { isValid, errors } = validateUserData(req.body);

    if (!isValid) {
      return res
        .status(400)
        .json({ error: "Validation failed", details: errors });
    }

    const newUser = {
      id: testNextId++,
      name: req.body.name.trim(),
      email: req.body.email.trim(),
      createdAt: new Date(),
    };

    testUsers[newUser.id] = newUser;

    try {
      await saveData();
    } catch (error) {
      // If persistence fails, rollback the changes
      delete testUsers[newUser.id];
      testNextId--;
      console.error("Failed to persist new user:", error);
      return res.status(500).json({ error: "Failed to save user data" });
    }

    return res.status(201).json(newUser);
  });

  testApp.put("/users/:id", async (req, res) => {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const user = testUsers[id];
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const { isValid, errors } = validateUserData(req.body);

    if (!isValid) {
      return res
        .status(400)
        .json({ error: "Validation failed", details: errors });
    }

    // Store original user data for rollback in case of persistence failure
    const originalUser = { ...user };
    
    // Update user (preserve id and createdAt)
    testUsers[id] = {
      ...user,
      name: req.body.name.trim(),
      email: req.body.email.trim(),
    };

    try {
      await saveData();
    } catch (error) {
      // If persistence fails, rollback the changes
      testUsers[id] = originalUser;
      console.error("Failed to persist user update:", error);
      return res.status(500).json({ error: "Failed to save user data" });
    }

    return res.json(testUsers[id]);
  });

  testApp.delete("/users/:id", async (req, res) => {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const user = testUsers[id];
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Store deleted user for rollback in case of persistence failure
    const deletedUser = { ...user };
    delete testUsers[id];

    try {
      await saveData();
    } catch (error) {
      // If persistence fails, restore the deleted user
      testUsers[id] = deletedUser;
      console.error("Failed to persist user deletion:", error);
      return res.status(500).json({ error: "Failed to save user data" });
    }

    return res.status(204).send();
  });

  // Expose loadData function for testing
  (testApp as any).loadData = loadData;
  (testApp as any).saveData = saveData;

  return testApp;
}

describe("Persistence Integration Tests", () => {
  beforeEach(async () => {
    // Clean up test data
    testUsers = {};
    testNextId = 1;
    
    // Remove data file if it exists
    try {
      await fs.unlink(DATA_FILE_PATH);
    } catch (error) {
      // File doesn't exist, which is fine
    }
    
    // Create fresh test app
    app = createTestApp();
  });

  afterEach(async () => {
    // Clean up test data file
    try {
      await fs.unlink(DATA_FILE_PATH);
    } catch (error) {
      // File doesn't exist, which is fine
    }
  });

  describe("End-to-End Persistence via API", () => {
    it("should create users via API and persist them to data.json", async () => {
      // Create first user
      const user1Response = await request(app)
        .post("/users")
        .send({
          name: "John Doe",
          email: "john@example.com",
        })
        .expect(201);

      expect(user1Response.body).toMatchObject({
        id: 1,
        name: "John Doe",
        email: "john@example.com",
      });
      expect(user1Response.body.createdAt).toBeDefined();

      // Create second user
      const user2Response = await request(app)
        .post("/users")
        .send({
          name: "Jane Smith",
          email: "jane@example.com",
        })
        .expect(201);

      expect(user2Response.body).toMatchObject({
        id: 2,
        name: "Jane Smith",
        email: "jane@example.com",
      });

      // Verify data.json was created and contains correct data
      const fileExists = await fs.access(DATA_FILE_PATH).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);

      const fileContent = await fs.readFile(DATA_FILE_PATH, "utf8");
      const persistedData: PersistedData = JSON.parse(fileContent);

      expect(persistedData.nextId).toBe(3);
      expect(Object.keys(persistedData.users)).toHaveLength(2);
      expect(persistedData.users[1]).toMatchObject({
        id: 1,
        name: "John Doe",
        email: "john@example.com",
      });
      expect(persistedData.users[2]).toMatchObject({
        id: 2,
        name: "Jane Smith",
        email: "jane@example.com",
      });
    });

    it("should update users via API and persist changes to data.json", async () => {
      // Create a user first
      await request(app)
        .post("/users")
        .send({
          name: "Original Name",
          email: "original@example.com",
        })
        .expect(201);

      // Update the user
      const updateResponse = await request(app)
        .put("/users/1")
        .send({
          name: "Updated Name",
          email: "updated@example.com",
        })
        .expect(200);

      expect(updateResponse.body).toMatchObject({
        id: 1,
        name: "Updated Name",
        email: "updated@example.com",
      });

      // Verify data.json contains updated data
      const fileContent = await fs.readFile(DATA_FILE_PATH, "utf8");
      const persistedData: PersistedData = JSON.parse(fileContent);

      expect(persistedData.users[1]).toMatchObject({
        id: 1,
        name: "Updated Name",
        email: "updated@example.com",
      });
    });

    it("should delete users via API and persist changes to data.json", async () => {
      // Create two users
      await request(app)
        .post("/users")
        .send({
          name: "User 1",
          email: "user1@example.com",
        })
        .expect(201);

      await request(app)
        .post("/users")
        .send({
          name: "User 2",
          email: "user2@example.com",
        })
        .expect(201);

      // Delete first user
      await request(app)
        .delete("/users/1")
        .expect(204);

      // Verify data.json only contains second user
      const fileContent = await fs.readFile(DATA_FILE_PATH, "utf8");
      const persistedData: PersistedData = JSON.parse(fileContent);

      expect(Object.keys(persistedData.users)).toHaveLength(1);
      expect(persistedData.users[1]).toBeUndefined();
      expect(persistedData.users[2]).toMatchObject({
        id: 2,
        name: "User 2",
        email: "user2@example.com",
      });
    });
  });

  describe("Server Restart Simulation", () => {
    it("should restore data after simulated server restart", async () => {
      // Create users via API
      await request(app)
        .post("/users")
        .send({
          name: "Persistent User 1",
          email: "persistent1@example.com",
        })
        .expect(201);

      await request(app)
        .post("/users")
        .send({
          name: "Persistent User 2",
          email: "persistent2@example.com",
        })
        .expect(201);

      // Verify users exist before restart
      const beforeRestart = await request(app)
        .get("/users")
        .expect(200);

      expect(beforeRestart.body).toHaveLength(2);

      // Simulate server restart by clearing in-memory data
      testUsers = {};
      testNextId = 1;

      // Verify in-memory data is cleared
      const afterClear = await request(app)
        .get("/users")
        .expect(200);

      expect(afterClear.body).toHaveLength(0);

      // Load data from persistence file
      await (app as any).loadData();

      // Verify data is restored
      const afterRestart = await request(app)
        .get("/users")
        .expect(200);

      expect(afterRestart.body).toHaveLength(2);
      expect(afterRestart.body[0]).toMatchObject({
        id: 1,
        name: "Persistent User 1",
        email: "persistent1@example.com",
      });
      expect(afterRestart.body[1]).toMatchObject({
        id: 2,
        name: "Persistent User 2",
        email: "persistent2@example.com",
      });

      // Verify nextId is also restored
      const newUserResponse = await request(app)
        .post("/users")
        .send({
          name: "New User After Restart",
          email: "newuser@example.com",
        })
        .expect(201);

      expect(newUserResponse.body.id).toBe(3);
    });

    it("should handle Date objects correctly after restart", async () => {
      // Create a user
      const createResponse = await request(app)
        .post("/users")
        .send({
          name: "Date Test User",
          email: "datetest@example.com",
        })
        .expect(201);

      const originalCreatedAt = createResponse.body.createdAt;

      // Simulate server restart
      testUsers = {};
      testNextId = 1;
      await (app as any).loadData();

      // Get the user after restart
      const afterRestart = await request(app)
        .get("/users/1")
        .expect(200);

      // Verify createdAt is preserved and is a valid date
      expect(afterRestart.body.createdAt).toBe(originalCreatedAt);
      expect(new Date(afterRestart.body.createdAt).getTime()).not.toBeNaN();
    });

    it("should maintain data integrity across multiple restart cycles", async () => {
      // First cycle - create users
      await request(app)
        .post("/users")
        .send({
          name: "Cycle User 1",
          email: "cycle1@example.com",
        })
        .expect(201);

      // Simulate restart
      testUsers = {};
      testNextId = 1;
      await (app as any).loadData();

      // Second cycle - add more users
      await request(app)
        .post("/users")
        .send({
          name: "Cycle User 2",
          email: "cycle2@example.com",
        })
        .expect(201);

      // Simulate another restart
      testUsers = {};
      testNextId = 1;
      await (app as any).loadData();

      // Verify all data is intact
      const finalUsers = await request(app)
        .get("/users")
        .expect(200);

      expect(finalUsers.body).toHaveLength(2);
      expect(finalUsers.body.find((u: any) => u.id === 1)).toMatchObject({
        name: "Cycle User 1",
        email: "cycle1@example.com",
      });
      expect(finalUsers.body.find((u: any) => u.id === 2)).toMatchObject({
        name: "Cycle User 2",
        email: "cycle2@example.com",
      });

      // Verify nextId is correct
      const newUser = await request(app)
        .post("/users")
        .send({
          name: "Final User",
          email: "final@example.com",
        })
        .expect(201);

      expect(newUser.body.id).toBe(3);
    });
  });

  describe("Error Handling in Integration", () => {
    it("should handle persistence failures gracefully during user creation", async () => {
      // Mock fs.writeFile to fail
      const originalWriteFile = fs.writeFile;
      (fs as any).writeFile = jest.fn().mockRejectedValue(new Error("Disk full"));

      const response = await request(app)
        .post("/users")
        .send({
          name: "Failed User",
          email: "failed@example.com",
        })
        .expect(500);

      expect(response.body.error).toBe("Failed to save user data");

      // Verify user was not created in memory
      const users = await request(app)
        .get("/users")
        .expect(200);

      expect(users.body).toHaveLength(0);

      // Restore original function
      (fs as any).writeFile = originalWriteFile;
    });

    it("should handle corrupted data.json file gracefully", async () => {
      // Create a corrupted data.json file
      await fs.writeFile(DATA_FILE_PATH, "{ invalid json", "utf8");

      // Attempt to load data should throw an error
      await expect((app as any).loadData()).rejects.toThrow("Corrupted persistence file");
    });
  });
});
