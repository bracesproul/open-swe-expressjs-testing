import { promises as fs } from "fs";
import { join } from "path";

// User interface definition (matching the one in index.ts)
interface User {
  id: number;
  name: string;
  email: string;
  createdAt: Date;
}

// Data structure for persistence
interface PersistenceData {
  users: { [key: number]: User };
  nextId: number;
}

// Path to the data file in project root
const DATA_FILE_PATH = join(process.cwd(), "data.json");

/**
 * Save the current users data and nextId counter to data.json file
 * @param users - The users object to save
 * @param nextId - The next ID counter to save
 */
export async function saveData(
  users: { [key: number]: User },
  nextId: number
): Promise<void> {
  try {
    const data: PersistenceData = {
      users,
      nextId,
    };

    const jsonData = JSON.stringify(data, null, 2);
    await fs.writeFile(DATA_FILE_PATH, jsonData, "utf8");
  } catch (error) {
    console.error("Error saving data to file:", error);
    throw new Error(`Failed to save data: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Load users data and nextId counter from data.json file
 * @returns Promise resolving to loaded data or null if file doesn't exist
 */
export async function loadData(): Promise<PersistenceData | null> {
  try {
    const jsonData = await fs.readFile(DATA_FILE_PATH, "utf8");
    const data: PersistenceData = JSON.parse(jsonData);

    // Validate the loaded data structure
    if (typeof data !== "object" || data === null) {
      throw new Error("Invalid data format: expected object");
    }
    if (typeof data.nextId !== "number" || data.nextId < 1) {
      throw new Error("Invalid nextId: expected positive number");
    }
    if (typeof data.users !== "object" || data.users === null) {
      throw new Error("Invalid users data: expected object");
    }

    return data;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      // File doesn't exist, return null (this is expected on first run)
      return null;
    }
    
    console.error("Error loading data from file:", error);
    throw new Error(`Failed to load data: ${error instanceof Error ? error.message : "Unknown error"}`);
}
}
