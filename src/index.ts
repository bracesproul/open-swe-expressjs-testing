import express, { Request, Response } from "express";
import { promises as fs } from "fs";
import path from "path";

// User interface definition
interface User {
  id: number;
  name: string;
  email: string;
  createdAt: Date;
}

// In-memory database
const users: { [key: number]: User } = {};
let nextId = 1;

// Data persistence file path
const DATA_FILE_PATH = path.join(process.cwd(), "data.json");

// Interface for persisted data structure
interface PersistedData {
  users: { [key: number]: User };
  nextId: number;
}

// Save data to JSON file
async function saveData(): Promise<void> {
  try {
    const dataToSave: PersistedData = {
      users,
      nextId,
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
    Object.keys(users).forEach(key => delete users[parseInt(key)]);
    Object.assign(users, parsedData.users);
    nextId = parsedData.nextId;
    
    // Convert createdAt strings back to Date objects
    Object.values(users).forEach(user => {
      if (typeof user.createdAt === "string") {
        user.createdAt = new Date(user.createdAt);
      }
    });
    
    console.log(`Loaded ${Object.keys(users).length} users from persistence file`);
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

// Create Express app
const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());

// Helper function to validate user data
function validateUserData(data: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.name || typeof data.name !== "string" || data.name.trim() === "") {
    errors.push("Name is required and must be a non-empty string");
  }

  if (
    !data.email ||
    typeof data.email !== "string" ||
    data.email.trim() === ""
  ) {
    errors.push("Email is required and must be a non-empty string");
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.push("Email must be a valid email address");
  }

  return { isValid: errors.length === 0, errors };
}

// Routes

// GET / - Welcome endpoint
app.get("/", (_req: Request, res: Response) => {
  res.json({ message: "Welcome to the API" });
});

// GET /users - Get all users
app.get("/users", (_req: Request, res: Response) => {
  const userList = Object.values(users);
  res.json(userList);
});

// GET /users/:id - Get user by ID
app.get("/users/:id", (req: Request, res: Response) => {
  const id = parseInt(req.params.id);

  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid user ID" });
  }

  const user = users[id];
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  return res.json(user);
});

// POST /users - Create new user
app.post("/users", async (req: Request, res: Response) => {
  const { isValid, errors } = validateUserData(req.body);

  if (!isValid) {
    return res
      .status(400)
      .json({ error: "Validation failed", details: errors });
  }

  const newUser: User = {
    id: nextId++,
    name: req.body.name.trim(),
    email: req.body.email.trim(),
    createdAt: new Date(),
  };

  users[newUser.id] = newUser;
  
  try {
    await saveData();
  } catch (error) {
    // If persistence fails, remove the user from memory to maintain consistency
    delete users[newUser.id];
    nextId--;
    console.error("Failed to persist user creation:", error);
    return res.status(500).json({ error: "Failed to save user data" });
  }
  
  return res.status(201).json(newUser);
});

// PUT /users/:id - Update user by ID
app.put("/users/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);

  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid user ID" });
  }

  const user = users[id];
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
  users[id] = {
    ...user,
    name: req.body.name.trim(),
    email: req.body.email.trim(),
  };

  try {
    await saveData();
  } catch (error) {
    // If persistence fails, rollback the changes
    users[id] = originalUser;
    console.error("Failed to persist user update:", error);
    return res.status(500).json({ error: "Failed to save user data" });
  }

  return res.json(users[id]);
});

// DELETE /users/:id - Delete user by ID
app.delete("/users/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);

  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid user ID" });
  }

  const user = users[id];
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  // Store user data for rollback in case of persistence failure
  const deletedUser = { ...user };
  delete users[id];

  try {
    await saveData();
  } catch (error) {
    // If persistence fails, restore the deleted user
    users[id] = deletedUser;
    console.error("Failed to persist user deletion:", error);
    return res.status(500).json({ error: "Failed to save user data" });
  }

  return res.status(204).send();
});

// Start server
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server is running on http://localhost:${PORT}`);
});





