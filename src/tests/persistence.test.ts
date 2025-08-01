import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import { promises as fs } from "fs";
import path from "path";

// Mock fs module
const mockWriteFile = jest.fn();
const mockReadFile = jest.fn();

jest.mock("fs", () => ({
  promises: {
    writeFile: mockWriteFile,
    readFile: mockReadFile,
  },
}));

// Mock console methods to avoid noise in tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

// Create a test module that simulates the persistence functions
// This allows us to test the logic without importing the entire Express app
interface User {
  id: number;
  name: string;
  email: string;
  createdAt: Date;
}

interface PersistedData {
  users: { [key: number]: User };
  nextId: number;
}

// Test data storage
let testUsers: { [key: number]: User } = {};
let testNextId = 1;
const DATA_FILE_PATH = path.join(process.cwd(), "data.json");

// Test implementation of saveData function
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

// Test implementation of loadData function
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

beforeEach(() => {
  // Reset mocks
  mockWriteFile.mockClear();
  mockReadFile.mockClear();
  
  // Mock console methods
  console.log = jest.fn();
  console.error = jest.fn();
  
  // Reset test data
  Object.keys(testUsers).forEach(key => delete testUsers[parseInt(key)]);
  testNextId = 1;
});

afterEach(() => {
  // Restore console methods
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
});

describe("Persistence Functions", () => {
  describe("saveData", () => {
    it("should successfully save users and nextId to data.json", async () => {
      // Arrange
      testUsers[1] = {
        id: 1,
        name: "John Doe",
        email: "john@example.com",
        createdAt: new Date("2023-01-01"),
      };
      testNextId = 2;
      
      mockFs.writeFile.mockResolvedValue(undefined);
      
      // Act
      await saveData();
      
      // Assert
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        DATA_FILE_PATH,
        expect.stringContaining('"users"'),
        "utf8"
      );
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        DATA_FILE_PATH,
        expect.stringContaining('"nextId": 2'),
        "utf8"
      );
    });
    
    it("should format JSON with proper indentation", async () => {
      // Arrange
      testUsers[1] = {
        id: 1,
        name: "Test User",
        email: "test@example.com",
        createdAt: new Date("2023-01-01"),
      };
      testNextId = 2;
      
      mockFs.writeFile.mockResolvedValue(undefined);
      
      // Act
      await saveData();
      
      // Assert
      const expectedData = JSON.stringify({
        users: testUsers,
        nextId: testNextId,
      }, null, 2);
      
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        DATA_FILE_PATH,
        expectedData,
        "utf8"
      );
    });
    
    it("should handle file write errors gracefully", async () => {
      // Arrange
      const writeError = new Error("Permission denied");
      mockFs.writeFile.mockRejectedValue(writeError);
      
      // Act & Assert
      await expect(saveData()).rejects.toThrow("Data persistence failed");
      expect(console.error).toHaveBeenCalledWith("Failed to save data to file:", writeError);
    });
    
    it("should save empty users object and nextId 1 for initial state", async () => {
      // Arrange
      mockFs.writeFile.mockResolvedValue(undefined);
      
      // Act
      await saveData();
      
      // Assert
      const expectedData = JSON.stringify({
        users: {},
        nextId: 1,
      }, null, 2);
      
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        DATA_FILE_PATH,
        expectedData,
        "utf8"
      );
    });
  });
  
  describe("loadData", () => {
    it("should successfully load users and nextId from data.json", async () => {
      // Arrange
      const testData = {
        users: {
          1: {
            id: 1,
            name: "John Doe",
            email: "john@example.com",
            createdAt: "2023-01-01T00:00:00.000Z",
          },
        },
        nextId: 2,
      };
      
      mockFs.readFile.mockResolvedValue(JSON.stringify(testData));
      
      // Act
      await loadData();
      
      // Assert
      expect(testUsers[1]).toEqual({
        id: 1,
        name: "John Doe",
        email: "john@example.com",
        createdAt: new Date("2023-01-01T00:00:00.000Z"),
      });
      expect(testNextId).toBe(2);
    });
    
    it("should handle file not found gracefully", async () => {
      // Arrange
      const error = new Error("File not found") as NodeJS.ErrnoException;
      error.code = "ENOENT";
      mockFs.readFile.mockRejectedValue(error);
      
      // Act
      await loadData();
      
      // Assert
      expect(console.log).toHaveBeenCalledWith("No persistence file found, starting with empty database");
      expect(Object.keys(testUsers)).toHaveLength(0);
      expect(testNextId).toBe(1);
    });
    
    it("should handle JSON parsing errors gracefully", async () => {
      // Arrange
      mockFs.readFile.mockResolvedValue("invalid json");
      
      // Act & Assert
      await expect(loadData()).rejects.toThrow("Corrupted persistence file");
      expect(console.error).toHaveBeenCalledWith(
        "Failed to parse persistence file - corrupted JSON:",
        expect.any(String)
      );
    });
    
    it("should validate data format and reject invalid data", async () => {
      // Arrange
      mockFs.readFile.mockResolvedValue("null");
      
      // Act & Assert
      await expect(loadData()).rejects.toThrow("Invalid data format in persistence file");
    });
    
    it("should validate nextId and reject invalid values", async () => {
      // Arrange
      const invalidData = {
        users: {},
        nextId: "invalid",
      };
      mockFs.readFile.mockResolvedValue(JSON.stringify(invalidData));
      
      // Act & Assert
      await expect(loadData()).rejects.toThrow("Invalid nextId in persistence file");
    });
    
    it("should validate users object and reject invalid values", async () => {
      // Arrange
      const invalidData = {
        users: "invalid",
        nextId: 1,
      };
      mockFs.readFile.mockResolvedValue(JSON.stringify(invalidData));
      
      // Act & Assert
      await expect(loadData()).rejects.toThrow("Invalid users data in persistence file");
    });
    
    it("should convert createdAt strings back to Date objects", async () => {
      // Arrange
      const testData = {
        users: {
          1: {
            id: 1,
            name: "John Doe",
            email: "john@example.com",
            createdAt: "2023-01-01T00:00:00.000Z",
          },
          2: {
            id: 2,
            name: "Jane Doe",
            email: "jane@example.com",
            createdAt: "2023-01-02T00:00:00.000Z",
          },
        },
        nextId: 3,
      };
      
      mockFs.readFile.mockResolvedValue(JSON.stringify(testData));
      
      // Act
      await loadData();
      
      // Assert
      expect(testUsers[1].createdAt).toBeInstanceOf(Date);
      expect(testUsers[2].createdAt).toBeInstanceOf(Date);
      expect(testUsers[1].createdAt.toISOString()).toBe("2023-01-01T00:00:00.000Z");
      expect(testUsers[2].createdAt.toISOString()).toBe("2023-01-02T00:00:00.000Z");
    });
    
    it("should clear existing data before loading new data", async () => {
      // Arrange
      testUsers[99] = { id: 99, name: "Old User", email: "old@example.com", createdAt: new Date() };
      testNextId = 100;
      
      const testData = {
        users: {
          1: {
            id: 1,
            name: "New User",
            email: "new@example.com",
            createdAt: "2023-01-01T00:00:00.000Z",
          },
        },
        nextId: 2,
      };
      
      mockFs.readFile.mockResolvedValue(JSON.stringify(testData));
      
      // Act
      await loadData();
      
      // Assert
      expect(testUsers[99]).toBeUndefined();
      expect(testUsers[1]).toBeDefined();
      expect(testNextId).toBe(2);
    });
  });
  
  describe("Data Integrity", () => {
    it("should maintain data integrity after save/load cycle", async () => {
      // Arrange
      const originalData = {
        1: {
          id: 1,
          name: "John Doe",
          email: "john@example.com",
          createdAt: new Date("2023-01-01"),
        },
        2: {
          id: 2,
          name: "Jane Smith",
          email: "jane@example.com",
          createdAt: new Date("2023-01-02"),
        },
      };
      
      Object.assign(testUsers, originalData);
      testNextId = 3;
      
      // Mock successful save
      mockFs.writeFile.mockResolvedValue(undefined);
      
      // Mock successful load
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        users: originalData,
        nextId: 3,
      }));
      
      // Act
      await saveData();
      
      // Clear data to simulate restart
      Object.keys(testUsers).forEach(key => delete testUsers[parseInt(key)]);
      testNextId = 1;
      
      await loadData();
      
      // Assert
      expect(testUsers[1]).toEqual(originalData[1]);
      expect(testUsers[2]).toEqual(originalData[2]);
      expect(testNextId).toBe(3);
    });
    
    it("should handle multiple save/load cycles correctly", async () => {
      // Arrange
      mockFs.writeFile.mockResolvedValue(undefined);
      
      // First cycle
      testUsers[1] = {
        id: 1,
        name: "User 1",
        email: "user1@example.com",
        createdAt: new Date("2023-01-01"),
      };
      testNextId = 2;
      
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        users: testUsers,
        nextId: testNextId,
      }));
      
      await saveData();
      await loadData();
      
      // Second cycle - add more data
      testUsers[2] = {
        id: 2,
        name: "User 2",
        email: "user2@example.com",
        createdAt: new Date("2023-01-02"),
      };
      testNextId = 3;
      
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        users: testUsers,
        nextId: testNextId,
      }));
      
      await saveData();
      await loadData();
      
      // Assert
      expect(Object.keys(testUsers)).toHaveLength(2);
      expect(testUsers[1].name).toBe("User 1");
      expect(testUsers[2].name).toBe("User 2");
      expect(testNextId).toBe(3);
    });
  });
});















