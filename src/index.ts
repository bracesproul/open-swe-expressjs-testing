import express, { Request, Response } from "express";
import { UserService } from "./services/UserService.js";

// Create UserService instance
const userService = new UserService();

// Routes

// GET / - Welcome endpoint
app.get("/", (_req: Request, res: Response) => {
  res.json({ message: "Welcome to the API" });
});

// GET /users - Get all users
app.get("/users", (_req: Request, res: Response) => {
  const users = userService.getAllUsers();
  res.json(users);
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
  try {
    const newUser = userService.createUser(req.body);
    return res.status(201).json(newUser);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errors = errorMessage.replace("Validation failed: ", "").split(", ");
    return res
      .status(400)
      .json({ error: "Validation failed", details: errors });
  }
});

// PUT /users/:id - Update user by ID
app.put("/users/:id", (req: Request, res: Response) => {
  const id = parseInt(req.params.id);

  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid user ID" });
  }

  try {
    const updatedUser = userService.updateUser(id, req.body);
    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }
    return res.json(updatedUser);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errors = errorMessage.replace("Validation failed: ", "").split(", ");
    return res
      .status(400)
      .json({ error: "Validation failed", details: errors });
  }
});

// DELETE /users/:id - Delete user by ID
app.delete("/users/:id", (req: Request, res: Response) => {
  const id = parseInt(req.params.id);

  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid user ID" });
  }

  const deleted = userService.deleteUser(id);
  if (!deleted) {
    return res.status(404).json({ error: "User not found" });
  }

  return res.status(204).send();
});

// Start server
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server is running on http://localhost:${PORT}`);
});

