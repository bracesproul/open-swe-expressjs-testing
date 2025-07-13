import express, { Request, Response } from "express";

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

// GET /users - Get all users with pagination
app.get("/users", (req: Request, res: Response) => {
  // Parse query parameters with defaults
  const pageParam = req.query.page as string;
  const limitParam = req.query.limit as string;
  
  // Convert to integers with defaults
  let page = pageParam ? parseInt(pageParam, 10) : 1;
  let limit = limitParam ? parseInt(limitParam, 10) : 10;
  
  // Validate parameters
  if (isNaN(page) || page < 1) {
    page = 1;
  }
  if (isNaN(limit) || limit < 1) {
    limit = 10;
  }
  
  // Get all users and calculate pagination
  const userList = Object.values(users);
  const totalCount = userList.length;
  const offset = (page - 1) * limit;
  const paginatedUsers = userList.slice(offset, offset + limit);
  
  // Return paginated response with metadata
  res.json({
    users: paginatedUsers,
    totalCount,
    page,
    limit
  });
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
    createdAt: new Date(),
  };

  users[newUser.id] = newUser;
  return res.status(201).json(newUser);
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

