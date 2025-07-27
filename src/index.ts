import express, { Request, Response } from "express";
import { User } from "./models/User.js";
import { UserService } from "./services/UserService.js";

// Create Express app
const app = express();
const PORT = 3000;

// Instantiate UserService
const userService = new UserService();

// Middleware
app.use(express.json());

// Routes

// GET / - Welcome endpoint
app.get("/", (_req: Request, res: Response) => {
  res.json({ message: "Welcome to the API" });
});

// GET /users - Get all users
app.get("/users", (_req: Request, res: Response) => {
  const userList = userService.getAllUsers();
  res.json(userList);
});

// GET /users/:id - Get user by ID
app.get("/users/:id", (req: Request, res: Response) => {
  const id = parseInt(req.params.id);

  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid user ID" });
  }

  const user = userService.getUserById(id);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  return res.json(user);
});

// POST /users - Create new user
app.post("/users", (req: Request, res: Response) => {
  const result = userService.createUser(req.body);

  if (!result.success) {
    return res
      .status(400)
      .json({ error: "Validation failed", details: result.errors });
  }

  return res.status(201).json(result.user);
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




