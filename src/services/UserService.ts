// User interface definition
export interface User {
  id: number;
  name: string;
  email: string;
  createdAt: Date;
}

export class UserService {
  // In-memory database
  private users: { [key: number]: User } = {};
  private nextId = 1;

  // Helper function to validate user data
  private validateUserData(data: any): { isValid: boolean; errors: string[] } {
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

  // Get all users
  getAllUsers(): User[] {
    return Object.values(this.users);
  }

  // Get user by ID
  getUserById(id: number): User | null {
    return this.users[id] || null;
  }

  // Create new user
  createUser(data: any): { user?: User; errors?: string[] } {
    const { isValid, errors } = this.validateUserData(data);

    if (!isValid) {
      return { errors };
    }

    const newUser: User = {
      id: this.nextId++,
      name: data.name.trim(),
      email: data.email.trim(),
      createdAt: new Date(),
    };

    this.users[newUser.id] = newUser;
    return { user: newUser };
  }

  // Update user by ID
  updateUser(id: number, data: any): { user?: User; errors?: string[] } {
    const existingUser = this.users[id];
    if (!existingUser) {
      return { errors: ["User not found"] };
    }

    const { isValid, errors } = this.validateUserData(data);

    if (!isValid) {
      return { errors };
    }

    // Update user (preserve id and createdAt)
    this.users[id] = {
      ...existingUser,
      name: data.name.trim(),
      email: data.email.trim(),
    };

    return { user: this.users[id] };
  }

  // Delete user by ID
  deleteUser(id: number): boolean {
    if (!this.users[id]) {
      return false;
    }

    delete this.users[id];
    return true;
  }
}
