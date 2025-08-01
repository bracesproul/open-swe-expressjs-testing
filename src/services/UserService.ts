// User interface definition
interface User {
  id: number;
  name: string;
  email: string;
  createdAt: Date;
}

// User data for creation/update operations
interface UserData {
  name: string;
  email: string;
}

// Validation result interface
interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export class UserService {
  // In-memory database
  private users: { [key: number]: User } = {};
  private nextId = 1;

  /**
   * Validates user data for creation or update operations
   */
  validateUserData(data: any): ValidationResult {
    const errors: string[] = [];

    if (
      !data.name ||
      typeof data.name !== "string" ||
      data.name.trim() === ""
    ) {
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

  /**
   * Get all users
   */
  getAllUsers(): User[] {
    return Object.values(this.users);
  }

  /**
   * Get user by ID
   */
  getUserById(id: number): User | null {
    return this.users[id] || null;
  }

  /**
   * Create a new user
   */
  createUser(userData: UserData): User {
    const newUser: User = {
      id: this.nextId++,
      name: userData.name.trim(),
      email: userData.email.trim(),
      createdAt: new Date(),
    };

    this.users[newUser.id] = newUser;
    return newUser;
  }

  /**
   * Update an existing user
   */
  updateUser(id: number, userData: UserData): User | null {
    const user = this.users[id];
    if (!user) {
      return null;
    }

    // Update user (preserve id and createdAt)
    this.users[id] = {
      ...user,
      name: userData.name.trim(),
      email: userData.email.trim(),
    };

    return this.users[id];
  }

  /**
   * Delete a user by ID
   */
  deleteUser(id: number): boolean {
    if (!this.users[id]) {
      return false;
    }

    delete this.users[id];
    return true;
  }
}
