import { User } from "../models/User.js";

export class UserService {
  private users: { [key: number]: User } = {};
  private nextId = 1;

  constructor() {
    this.users = {};
    this.nextId = 1;
  }

  private validateUserData(data: any): { isValid: boolean; errors: string[] } {
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

  getAllUsers(): User[] {
    return Object.values(this.users);
  }

  getUserById(id: number): User | null {
    return this.users[id] || null;
  }

  createUser(data: any): { success: boolean; user?: User; errors?: string[] } {
    const { isValid, errors } = this.validateUserData(data);

    if (!isValid) {
      return { success: false, errors };
    }

    const newUser: User = {
      id: this.nextId++,
      name: data.name.trim(),
      email: data.email.trim(),
      createdAt: new Date(),
    };

    this.users[newUser.id] = newUser;
    return { success: true, user: newUser };
  }

  updateUser(
    id: number,
    data: any,
  ): { success: boolean; user?: User; errors?: string[] } {
    const existingUser = this.users[id];
    if (!existingUser) {
      return { success: false, errors: ["User not found"] };
    }

    const { isValid, errors } = this.validateUserData(data);

    if (!isValid) {
      return { success: false, errors };
    }

    // Update user (preserve id and createdAt)
    this.users[id] = {
      ...existingUser,
      name: data.name.trim(),
      email: data.email.trim(),
    };

    return { success: true, user: this.users[id] };
  }

  deleteUser(id: number): boolean {
    if (!this.users[id]) {
      return false;
    }

    delete this.users[id];
    return true;
  }
}
