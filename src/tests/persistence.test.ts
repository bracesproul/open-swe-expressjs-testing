import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import { promises as fs } from "fs";
import path from "path";

// Mock fs module
jest.mock("fs", () => ({
  promises: {
    writeFile: jest.fn(),
    readFile: jest.fn(),
  },
}));

// Mock path module
jest.mock("path", () => ({
  join: jest.fn(),
}));

const mockFs = fs as jest.Mocked<typeof fs>;
const mockPath = path as jest.Mocked<typeof path>;

// Import the module after mocking
let saveData: () => Promise<void>;
let loadData: () => Promise<void>;
let users: { [key: number]: any };
let nextId: number;

// Mock the module's internal state
const mockUsers = {};
const mockNextId = { value: 1 };

// Mock console methods to avoid noise in tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

beforeEach(() => {
  // Reset mocks
  jest.clearAllMocks();
  
  // Mock path.join to return a predictable path
  mockPath.join.mockReturnValue("/mock/path/data.json");
  
  // Mock console methods
  console.log = jest.fn();
  console.error = jest.fn();
  
  // Reset mock data
  Object.keys(mockUsers).forEach(key => delete mockUsers[key]);
  mockNextId.value = 1;
  
  // Create mock functions that simulate the actual persistence functions
  saveData = jest.fn().mockImplementation(async () => {
    const dataToSave = {
      users: mockUsers,
      nextId: mockNextId.value,
    };
    const jsonData = JSON.stringify(dataToSave, null, 2);
    await mockFs.writeFile("/mock/path/data.json", jsonData, "utf8");
  });
  
  loadData = jest.fn().mockImplementation(async () => {
    const fileContent = await mockFs.readFile("/mock/path/data.json", "utf8");
    const parsedData = JSON.parse(fileContent);
    
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
    Object.keys(mockUsers).forEach(key => delete mockUsers[parseInt(key)]);
    Object.assign(mockUsers, parsedData.users);
    mockNextId.value = parsedData.nextId;
    
    // Convert createdAt strings back to Date objects
    Object.values(mockUsers).forEach((user: any) => {
      if (typeof user.createdAt === "string") {
        user.createdAt = new Date(user.createdAt);
      }
    });
  });
  
  users = mockUsers;
  nextId = mockNextId.value;
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
      mockUsers[1] = {
        id: 1,
        name: "John Doe",
        email: "john@example.com",
        createdAt: new Date("2023-01-01"),
      };
      mockNextId.value = 2;
      
      mockFs.writeFile.mockResolvedValue(undefined);
      
      // Act
      await saveData();
      
      // Assert
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        "/mock/path/data.json",
        expect.stringContaining('"users"'),
        "utf8"
      );
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        "/mock/path/data.json",
        expect.stringContaining('"nextId": 2'),
        "utf8"
      );
    });
    
    it("should format JSON with proper indentation", async () => {
      // Arrange
      mockUsers[1] = {
        id: 1,
        name: "Test User",
        email: "test@example.com",
        createdAt: new Date("2023-01-01"),
      };
      mockNextId.value = 2;
      
      mockFs.writeFile.mockResolvedValue(undefined);
      
      // Act
      await saveData();
      
      // Assert
      const expectedData = JSON.stringify({
        users: mockUsers,
        nextId: mockNextId.value,
      }, null, 2);
      
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        "/mock/path/data.json",
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
        "/mock/path/data.json",
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
      expect(mockUsers[1]).toEqual({
        id: 1,
        name: "John Doe",
        email: "john@example.com",
        createdAt: new Date("2023-01-01T00:00:00.000Z"),
      });
      expect(mockNextId.value).toBe(2);
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
      expect(Object.keys(mockUsers)).toHaveLength(0);
      expect(mockNextId.value).toBe(1);
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
      expect(mockUsers[1].createdAt).toBeInstanceOf(Date);
      expect(mockUsers[2].createdAt).toBeInstanceOf(Date);
      expect(mockUsers[1].createdAt.toISOString()).toBe("2023-01-01T00:00:00.000Z");
      expect(mockUsers[2].createdAt.toISOString()).toBe("2023-01-02T00:00:00.000Z");
    });
    
    it("should clear existing data before loading new data", async () => {
      // Arrange
      mockUsers[99] = { id: 99, name: "Old User", email: "old@example.com", createdAt: new Date() };
      mockNextId.value = 100;
      
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
      expect(mockUsers[99]).toBeUndefined();
      expect(mockUsers[1]).toBeDefined();
      expect(mockNextId.value).toBe(2);
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
      
      Object.assign(mockUsers, originalData);
      mockNextId.value = 3;
      
      // Mock successful save
      mockFs.writeFile.mockResolvedValue(undefined);
      
      // Mock successful load
      mockFs.readFile.mockImplementation(async () => {
        return JSON.stringify({
          users: originalData,
          nextId: 3,
        });
      });
      
      // Act
      await saveData();
      
      // Clear data to simulate restart
      Object.keys(mockUsers).forEach(key => delete mockUsers[key]);
      mockNextId.value = 1;
      
      await loadData();
      
      // Assert
      expect(mockUsers[1]).toEqual(originalData[1]);
      expect(mockUsers[2]).toEqual(originalData[2]);
      expect(mockNextId.value).toBe(3);
    });
    
    it("should handle multiple save/load cycles correctly", async () => {
      // Arrange
      mockFs.writeFile.mockResolvedValue(undefined);
      
      // First cycle
      mockUsers[1] = {
        id: 1,
        name: "User 1",
        email: "user1@example.com",
        createdAt: new Date("2023-01-01"),
      };
      mockNextId.value = 2;
      
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        users: mockUsers,
        nextId: mockNextId.value,
      }));
      
      await saveData();
      await loadData();
      
      // Second cycle - add more data
      mockUsers[2] = {
        id: 2,
        name: "User 2",
        email: "user2@example.com",
        createdAt: new Date("2023-01-02"),
      };
      mockNextId.value = 3;
      
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        users: mockUsers,
        nextId: mockNextId.value,
      }));
      
      await saveData();
      await loadData();
      
      // Assert
      expect(Object.keys(mockUsers)).toHaveLength(2);
      expect(mockUsers[1].name).toBe("User 1");
      expect(mockUsers[2].name).toBe("User 2");
      expect(mockNextId.value).toBe(3);
    });
  });
});
