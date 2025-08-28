import express, { Request, Response } from "express";
import bcrypt from "bcrypt";

// User interface definition
interface User {
  id: number;
  name: string;
  email: string;
  password: string;
  createdAt: Date;
}

// In-memory database
const users: { [key: number]: User } = {};
let nextId = 1;

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

// Helper function to validate signup data
function validateSignupData(data: any): { isValid: boolean; errors: string[] } {
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

  if (!data.password || typeof data.password !== "string") {
    errors.push("Password is required");
  } else if (data.password.length < 8) {
    errors.push("Password must be at least 8 characters long");
  }

  return { isValid: errors.length === 0, errors };
}

// Helper function to check if email already exists
function isEmailTaken(email: string): boolean {
  const userList = Object.values(users);
  return userList.some(
    (user) => user.email.toLowerCase() === email.toLowerCase(),
  );
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
app.post("/users", (req: Request, res: Response) => {
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
    password: "", // Empty password for non-signup user creation
    createdAt: new Date(),
  };

  users[newUser.id] = newUser;
  return res.status(201).json(newUser);
});

// POST /signup - User signup with password
app.post("/signup", async (req: Request, res: Response) => {
  // Validate signup data
  const { isValid, errors } = validateSignupData(req.body);

  if (!isValid) {
    return res
      .status(400)
      .json({ error: "Validation failed", details: errors });
  }

  // Check if email already exists
  if (isEmailTaken(req.body.email)) {
    return res.status(409).json({ error: "Email already exists" });
  }

  try {
    // Hash the password with salt rounds of 10
    const hashedPassword = await bcrypt.hash(req.body.password, 10);

    // Create new user with hashed password
    const newUser: User = {
      id: nextId++,
      name: req.body.name.trim(),
      email: req.body.email.trim(),
      password: hashedPassword,
      createdAt: new Date(),
    };

    // Store the user
    users[newUser.id] = newUser;

    // Return user object without password field
    const { password: _, ...userWithoutPassword } = newUser;
    return res.status(201).json(userWithoutPassword);
  } catch (_error) {
    return res.status(500).json({ error: "Failed to create user" });
  }
});

// PUT /users/:id - Update user by ID
app.put("/users/:id", (req: Request, res: Response) => {
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

  // Update user (preserve id and createdAt)
  users[id] = {
    ...user,
    name: req.body.name.trim(),
    email: req.body.email.trim(),
  };

  return res.json(users[id]);
});

// DELETE /users/:id - Delete user by ID
app.delete("/users/:id", (req: Request, res: Response) => {
  const id = parseInt(req.params.id);

  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid user ID" });
  }

  const user = users[id];
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  delete users[id];
  return res.status(204).send();
});

// Start server
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server is running on http://localhost:${PORT}`);
});
