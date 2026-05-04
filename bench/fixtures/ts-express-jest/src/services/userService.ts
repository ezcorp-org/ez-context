interface User {
  id: string;
  name: string;
  email: string;
}

export class UserService {
  private users: User[] = [];

  async findAll(): Promise<User[]> {
    return this.users;
  }

  async findById(id: string): Promise<User | undefined> {
    return this.users.find((u) => u.id === id);
  }

  async create(data: Omit<User, "id">): Promise<User> {
    const user: User = {
      id: crypto.randomUUID(),
      ...data,
    };
    this.users.push(user);
    return user;
  }
}
