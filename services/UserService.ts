// User interface definition
interface User {
  id: number;
  name: string;
  email: string;
  createdAt: Date;
}

export class UserService {
  // In-memory database
  private users: { [key: number]: User } = {};
  private nextId = 1;

  // Get all users
  getAllUsers(): User[] {
    return Object.values(this.users);
  }

  // Get user by ID
  getUserById(id: number): User | undefined {
    return this.users[id];
  }

  // Create new user
  createUser(data: { name: string; email: string }): User {
    const validation = this.validateUserData(data);
    if (!validation.isValid) {
      throw new Error(
        `Validation failed: ${validation.errors.join(", ")}`,
      );
    }

    const newUser: User = {
      id: this.nextId++,
      name: data.name.trim(),
      email: data.email.trim(),
      createdAt: new Date(),
    };

    this.users[newUser.id] = newUser;
    return newUser;
  }

  // Update user by ID
  updateUser(
    id: number,
    data: { name: string; email: string },
  ): User | undefined {
    const user = this.users[id];
    if (!user) {
      return undefined;
    }

    const validation = this.validateUserData(data);
    if (!validation.isValid) {
      throw new Error(
        `Validation failed: ${validation.errors.join(", ")}`,
      );
    }

    // Update user (preserve id and createdAt)
    this.users[id] = {
      ...user,
      name: data.name.trim(),
      email: data.email.trim(),
    };

    return this.users[id];
  }

  // Delete user by ID
  deleteUser(id: number): boolean {
    if (!this.users[id]) {
      return false;
    }
    delete this.users[id];
    return true;
  }

  // Helper function to validate user data
  validateUserData(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.name || typeof data.name !== "string" || data.name.trim() === "") {
      errors.push("Name is required and must be a non-empty string");
    }

    if (
      !data.email ||
